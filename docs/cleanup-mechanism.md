# 数据清理机制说明

## 工作原理

清理函数通过调用 Supabase RPC（Remote Procedure Call）来执行数据库端的清理逻辑。

### 工作流程

```
客户端 (TypeScript)
    ↓
调用 cleanupExpiredData()
    ↓
supabase.rpc('cleanup_expired_data')
    ↓
数据库端 PostgreSQL 函数
    ↓
执行 DELETE 语句
    ↓
删除所有过期数据
```

## 数据库端清理函数

在 SQL 脚本中定义的清理函数如下：

### 1. cleanup_expired_sessions()

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions 
  WHERE last_heartbeat < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;
```

**作用**: 删除所有超过 2 分钟未更新心跳的会话记录

### 2. cleanup_expired_cursors()

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_cursors()
RETURNS void AS $$
BEGIN
  DELETE FROM cursors 
  WHERE updated_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
```

**作用**: 删除所有超过 5 分钟未更新的光标记录

### 3. cleanup_expired_edit_locks()

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_edit_locks()
RETURNS void AS $$
BEGIN
  DELETE FROM edit_locks 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

**作用**: 删除所有已过期的编辑锁（`expires_at` 小于当前时间）

### 4. cleanup_soft_deleted_cards()

```sql
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_cards(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 删除 data->>'visible' = 'false' 且 updated_at 超过指定天数的卡片
  DELETE FROM cards
  WHERE (
    (data->>'visible')::text = 'false' 
    OR (data->>'visible')::boolean = false
  )
    AND updated_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**作用**: 删除所有软删除的卡片（`data.visible = false` 且 `updated_at` 超过指定天数，默认 30 天）

**参数**:
- `days_old`: 清理多少天前软删除的卡片，默认 30 天

**返回值**: 删除的卡片数量

### 5. cleanup_expired_data()（综合函数）

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  PERFORM cleanup_expired_sessions();
  PERFORM cleanup_expired_cursors();
  PERFORM cleanup_expired_edit_locks();
  -- 注意：软删除卡片的清理频率较低（30天），所以不在综合清理中自动执行
  -- 如需清理软删除卡片，请单独调用 cleanup_soft_deleted_cards()
END;
$$ LANGUAGE plpgsql;
```

**作用**: 依次调用上述三个清理函数，清理所有类型的过期数据（不包括软删除卡片）

## 客户端调用

### TypeScript 函数

```typescript
// 调用数据库端的 cleanup_expired_data 函数
export const cleanupExpiredData = async (): Promise<void> => {
  const { error } = await supabase.rpc('cleanup_expired_data');
  // 处理错误...
};

// 清理软删除的卡片（默认清理 30 天前的）
export const cleanupSoftDeletedCards = async (daysOld: number = 30): Promise<void> => {
  const { error } = await supabase.rpc('cleanup_soft_deleted_cards', {
    days_old: daysOld
  });
  // 处理错误...
};
```

### 执行过程

1. **客户端调用**: `cleanupExpiredData()` 被调用
2. **RPC 请求**: 通过 Supabase 客户端发送 RPC 请求到数据库
3. **数据库执行**: PostgreSQL 执行 `cleanup_expired_data()` 函数
4. **批量删除**: 数据库执行 DELETE 语句，删除所有符合条件的记录
5. **返回结果**: 函数执行完成（无返回值，只返回成功/失败状态）

## 清理范围

### 清理所有过期数据

是的，**清理函数会清理所有过期的数据**，不仅仅是当前用户的：

- **所有过期会话**: 删除所有超过 2 分钟未心跳的会话（不管属于哪个用户）
- **所有过期光标**: 删除所有超过 5 分钟未更新的光标（不管属于哪个用户）
- **所有过期编辑锁**: 删除所有已过期的编辑锁（不管属于哪个用户）
- **所有软删除的卡片**: 删除所有 `visible: false` 且超过指定天数（默认 30 天）的卡片

### 为什么清理所有数据？

1. **性能优化**: 定期清理过期数据可以防止表膨胀，保持数据库性能
2. **数据一致性**: 确保在线人数、光标显示等功能的准确性
3. **资源管理**: 及时释放不再使用的数据库资源

## 清理时机

### 推荐方案

使用 `setupComprehensiveCleanup()` 会：

1. **应用启动时**: 立即清理一次所有过期数据
2. **定期清理**: 每 5 分钟自动清理一次
3. **页面切换时**: 用户切换回页面时清理一次

### 清理频率

- **过期数据（会话、光标、编辑锁）**: 建议至少 2-5 分钟清理一次，最大间隔不超过 30 分钟
- **软删除的卡片**: 由于清理策略是删除 30 天前的软删除卡片，建议每天清理一次即可，或在应用启动时清理

## 性能考虑

### 数据库性能

- **索引优化**: 清理条件字段（`last_heartbeat`、`updated_at`、`expires_at`）都有索引，删除操作很快
- **批量删除**: 使用 `DELETE ... WHERE` 批量删除，比逐条删除效率高
- **事务安全**: 所有清理操作在事务中执行，保证数据一致性

### 客户端性能

- **异步执行**: 清理操作是异步的，不会阻塞 UI
- **错误处理**: 即使清理失败也不会影响应用正常运行
- **节流机制**: 某些触发方式（如用户操作触发）带有节流，避免过于频繁

## 监控和调试

### 查看清理效果

可以在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 查看过期会话数量（清理前）
SELECT COUNT(*) FROM sessions 
WHERE last_heartbeat < NOW() - INTERVAL '2 minutes';

-- 查看过期光标数量（清理前）
SELECT COUNT(*) FROM cursors 
WHERE updated_at < NOW() - INTERVAL '5 minutes';

-- 查看过期编辑锁数量（清理前）
SELECT COUNT(*) FROM edit_locks 
WHERE expires_at < NOW();

-- 查看软删除的卡片数量（清理前）
SELECT COUNT(*) FROM cards 
WHERE (data->>'visible')::text = 'false' 
  AND updated_at < NOW() - INTERVAL '30 days';

-- 手动执行清理
SELECT cleanup_expired_data();
SELECT cleanup_soft_deleted_cards(30); -- 清理 30 天前软删除的卡片

-- 再次查看数量（应该为 0）
```

### 日志记录

清理函数执行时会在浏览器控制台输出日志：

- 成功: `Cleanup completed on app start`
- 失败: `Error cleaning up expired data: [error details]`

## 注意事项

1. **清理是全局的**: 会清理所有用户的过期数据，不是只清理当前用户
2. **清理是安全的**: 只删除明确过期的数据，不会误删活跃数据
3. **清理是必要的**: 如果不定期清理，过期数据会累积，影响性能
4. **清理是异步的**: 不会阻塞应用运行，即使清理失败也不会影响功能

