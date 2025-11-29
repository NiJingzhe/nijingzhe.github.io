# Supabase Realtime 配置说明

## 概述

Supabase Realtime 允许你监听数据库变化并实时同步数据。对于在线人数统计和访问量统计功能，我们需要监听 `sessions` 和 `visits` 表的变化。

## 表级别 Realtime 配置

### 1. 在 Supabase Dashboard 中启用 Realtime

1. 登录 Supabase Dashboard
2. 进入你的项目
3. 导航到 **Database** → **Replication**
4. 为以下表启用 Realtime：
   - `sessions` - 用于在线人数统计
   - `visits` - 用于访问量统计（可选，如果需要实时访问量）
   - `visitors` - 用于访问者信息更新（可选）

### 2. 通过 SQL 启用 Realtime（推荐）

在 Supabase SQL Editor 中执行以下 SQL：

```sql
-- 为 sessions 表启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- 为 visits 表启用 Realtime（可选）
ALTER PUBLICATION supabase_realtime ADD TABLE visits;

-- 为 visitors 表启用 Realtime（可选，用于 uname 更新）
ALTER PUBLICATION supabase_realtime ADD TABLE visitors;
```

### 3. 验证配置

执行以下 SQL 检查哪些表已启用 Realtime：

```sql
SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

应该能看到 `sessions`、`visits`、`visitors` 表。

## 客户端订阅配置

### 订阅事件类型

Supabase Realtime 支持以下事件类型：

- `INSERT` - 新记录插入
- `UPDATE` - 记录更新
- `DELETE` - 记录删除
- `*` - 所有事件

### 订阅过滤器

可以添加过滤器来只监听特定条件的数据：

```typescript
// 只监听特定 visitor_uid 的会话
supabase
  .channel('sessions')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sessions',
    filter: 'visitor_uid=eq.' + visitorUid
  }, callback)
  .subscribe();
```

## 性能优化建议

### 1. 使用适当的过滤器

只订阅需要的数据，减少网络传输：

```typescript
// 只订阅活跃会话（2 分钟内）
supabase
  .channel('sessions')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sessions',
    filter: 'last_heartbeat=gt.' + twoMinutesAgo
  }, callback)
  .subscribe();
```

### 2. 限制订阅数量

避免创建过多的订阅通道，复用通道：

```typescript
// 在一个通道中订阅多个表
const channel = supabase.channel('app-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, handleSessions)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, handleVisits)
  .subscribe();
```

### 3. 及时清理订阅

组件卸载时取消订阅：

```typescript
useEffect(() => {
  const channel = supabase.channel('sessions').subscribe();
  
  return () => {
    channel.unsubscribe();
  };
}, []);
```

## 安全考虑

### Row Level Security (RLS)

如果启用了 RLS，需要确保 Realtime 订阅能够访问数据：

```sql
-- 允许所有用户读取 sessions 表（用于在线人数统计）
CREATE POLICY "Allow read sessions for realtime" 
ON sessions FOR SELECT 
USING (true);

-- 允许所有用户读取 visits 表（用于访问量统计）
CREATE POLICY "Allow read visits for realtime" 
ON visits FOR SELECT 
USING (true);
```

**注意**: 如果不需要严格的权限控制，可以不启用 RLS（默认情况下 Supabase 的 anon key 可以访问 public schema 的表）。

## 测试 Realtime 连接

### 在浏览器控制台测试

```typescript
import supabase from './utils/supabase';

// 测试订阅
const channel = supabase
  .channel('test')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sessions'
  }, (payload) => {
    console.log('Realtime event:', payload);
  })
  .subscribe();

// 测试插入（在另一个标签页或 Supabase Dashboard 中）
// 应该能在控制台看到事件
```

## 常见问题

### 1. 订阅不工作

- 检查表是否已启用 Realtime
- 检查网络连接
- 查看浏览器控制台是否有错误
- 确认 Supabase 项目配置正确

### 2. 事件重复触发

- 检查是否有多个订阅通道
- 确保组件卸载时正确清理订阅

### 3. 性能问题

- 减少订阅的数据量
- 使用过滤器限制订阅范围
- 考虑使用轮询替代 Realtime（对于不频繁变化的数据）

