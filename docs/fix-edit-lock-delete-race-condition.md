# 修复编辑锁 DELETE 事件时序竞态问题

## 问题描述

按下 ESC 释放编辑锁后，保存操作（debounced 500ms）报错："保存时发现锁已被其他人持有"。

## 根本原因

时序竞态问题：

1. **用户按下 ESC**
   - `releaseLock()` 成功删除数据库中的锁
   - `currentEditLockRef.current` 被清除
   - 但 `editLocks` 状态还未更新（等待 realtime 事件）

2. **DELETE realtime 事件触发**
   - Supabase 的 DELETE 事件 `oldRecord` 默认只包含主键 `id`，不包含 `card_id`
   - 代码无法从 `oldRecord` 获取 `card_id`
   - 回退逻辑：重新调用 `fetchCurrentLock(cardId)` 查询数据库

3. **回退查询返回空**
   - 此时锁已在数据库中删除
   - `fetchCurrentLock()` 返回 null
   - `isLockHeldByUser()` 返回 `false`
   - **但 `debouncedSaveCard` 的 500ms 计时器还在运行！**

4. **保存操作触发**
   - debounce 计时器到期，调用保存逻辑
   - 原有逻辑：检查 `currentEditLockRef.current === card.id` 且 `isLockHeldByUser()` 必须为 true
   - 此时 `currentEditLockRef.current` 已被清空（null），但原代码没有区分"退出编辑模式"和"编辑冲突"两种情况
   - 报错："保存时发现锁已被其他人持有"

## 修复方案

### 核心思路：区分"退出编辑模式的最后保存"和"编辑冲突"

修改保存前的锁检查逻辑，增加状态判断：

```typescript
// App.tsx - debouncedSaveCard
const isStillEditing = currentEditLockRef.current === card.id;

if (isStillEditing) {
  // 仍在编辑模式中，必须持有锁才能保存
  const isHeld = await isLockHeldByCurrentUser(card.id, userId);
  if (!isHeld) {
    // 锁被其他人抢占 → 真正的编辑冲突
    setConflictCardId(card.id);
    return;
  }
} else {
  // 已退出编辑模式（currentEditLockRef 已清空），这是最后一次保存
  // 允许保存，即使锁可能已经释放
  console.log(`[App] 退出编辑模式的最后一次保存 - cardId: ${card.id}`);
}
```

### 为什么这样修复是正确的？

1. **保留编辑冲突检测能力**
   - 如果用户仍在编辑模式（`currentEditLockRef.current === card.id`），必须检查锁
   - 锁被抢占时，正确显示冲突对话框

2. **允许退出时的最后保存**
   - 按下 ESC 后，`currentEditLockRef.current` 立即被清空
   - debounce 触发时检测到已退出编辑模式
   - 这是"善意的最后保存"，应该允许

3. **不依赖 realtime 事件时序**
   - 不需要立即删除 `editLocks` 状态
   - 让 realtime 事件自然更新，保持状态一致性
   - 避免手动同步状态带来的复杂性

## 为什么不能立即删除本地锁状态？

**错误方案：** 释放锁后立即 `setEditLocks(prev => { next.delete(cardId); return next; })`

**问题：**
```
时间线：
T0: 用户 A 正在编辑卡片
T1: 用户 B 抢占了锁（用户 A 的锁续期失败或被强制释放）
T2: 用户 A 按下 ESC，调用 releaseLock()
T3: 立即删除本地锁状态 → editLocks.delete(cardId)
T4: 本地状态显示"无人编辑"
T5: Realtime 事件到达，尝试设置"用户 B 持有锁"
     但因为本地状态已被删除，可能无法正确显示冲突
```

**正确方案：** 通过 `currentEditLockRef` 判断是否仍在编辑模式，保留 `editLocks` 状态用于显示其他用户的锁。

### 辅助改进：增强日志

在 `editLocks.ts` 的 DELETE 事件处理中添加详细日志，帮助诊断 `oldRecord` 的实际结构（已实现）。

## Supabase REPLICA IDENTITY 说明

**为什么 DELETE 事件的 `oldRecord` 没有完整数据？**

Supabase (PostgreSQL) 的 Realtime 订阅默认使用 `REPLICA IDENTITY DEFAULT`，这意味着：
- INSERT/UPDATE 事件会返回完整的 `new` 记录
- DELETE 事件的 `old` 记录只包含主键字段

**如何获取完整的 DELETE 记录？**

需要修改表的 `REPLICA IDENTITY` 设置：

```sql
-- 选项 1：返回所有字段（推荐用于小表）
ALTER TABLE edit_locks REPLICA IDENTITY FULL;

-- 选项 2：只返回非空字段
ALTER TABLE edit_locks REPLICA IDENTITY USING INDEX edit_locks_pkey;
```

**注意事项：**
- `REPLICA IDENTITY FULL` 会增加 WAL（Write-Ahead Log）大小
- 对于高并发的表，可能影响性能
- 当前通过 `currentEditLockRef` 判断编辑状态的方案已足够，暂不需要修改数据库配置

## 测试验证

### 测试场景 1：正常退出编辑模式

1. 进入编辑模式（点击卡片）
2. 修改内容（触发 debounce 计时器）
3. 立即按 ESC（在 500ms 内）
4. 观察控制台日志：
   - ✅ 应该看到 "退出编辑模式的最后一次保存"
   - ✅ 不应该看到 "保存时发现锁已被其他人持有"
   - ✅ 内容应该正常保存

### 测试场景 2：编辑冲突检测

1. 用户 A 进入编辑模式
2. 用户 B 强制刷新页面，抢占锁（或等待用户 A 的锁过期）
3. 用户 A 继续编辑并尝试保存
4. 观察：
   - ✅ 应该看到编辑冲突对话框
   - ✅ 日志显示 "保存时发现锁已被其他人持有"

## 相关文件

- `src/App.tsx` - 释放锁并立即更新状态
- `src/utils/realtime/editLocks.ts` - DELETE 事件处理
- `src/utils/editLock.ts` - 锁检查逻辑

## 日期

2025-12-01
