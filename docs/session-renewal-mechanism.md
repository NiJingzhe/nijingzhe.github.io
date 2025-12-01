# Session 续期机制说明

## 问题背景

当用户在页面上停留很久没有动作时，可能出现以下情况：

1. **浏览器 Tab 不活跃**：浏览器会暂停或减慢不活跃 Tab 的定时器执行
2. **Session 过期**：定时心跳（30秒一次）可能暂停，导致 session 在 2 分钟后过期（数据库端设置）
3. **Cursor 同步失败**：用户回来后移动鼠标，cursor 更新时发现 session 不存在，导致外键约束错误

## 解决方案

### 1. 主动续期机制

实现了两种主动续期场景：

#### 1.1 页面可见性变化时续期

当页面从隐藏变为可见时（用户切回 Tab），检查距离上次心跳是否超过 90 秒，如果超过则立即续期 session。

```typescript
const handleVisibilityChange = async () => {
  if (!document.hidden && userId) {
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTimeRef.current;
    if (timeSinceLastHeartbeat > 90 * 1000) {
      console.log('[Session] Page became visible, renewing session');
      const newSessionId = await updateSessionHeartbeat(userId);
      if (newSessionId) {
        setSessionId(newSessionId);
        sessionIdRef.current = newSessionId;
        lastHeartbeatTimeRef.current = Date.now();
      }
    }
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);
```

#### 1.2 鼠标移动时预防性续期

在 cursor 更新定时器中（每 100ms），检查距离上次心跳是否超过 90 秒，如果超过则在更新 cursor 前先续期 session。

```typescript
// 在 cursor 更新定时器中
const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTimeRef.current;
if (timeSinceLastHeartbeat > 90 * 1000) {
  console.log('[Session] Long time since last heartbeat, proactively renewing session');
  const newSessionId = await updateSessionHeartbeat(uid);
  if (newSessionId) {
    setSessionId(newSessionId);
    sessionIdRef.current = newSessionId;
    currentSessionId = newSessionId;
    lastHeartbeatTimeRef.current = Date.now();
  }
}
```

### 2. 失败重试机制（已有）

当 cursor 更新失败且错误码为 `23503`（外键约束错误）时，自动重新创建 session 并重试：

```typescript
catch (error: any) {
  if (error?.code === '23503' && error?.message?.includes('sessions')) {
    console.warn('[Session] Session not found during cursor update, recreating session');
    const newSessionId = await updateSessionHeartbeat(uid);
    if (newSessionId) {
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;
      lastHeartbeatTimeRef.current = Date.now();
      // 重试 cursor 更新
      await upsertCursor(uid, newSessionId, x, y, canvasX, canvasY, currentScale);
    }
  }
}
```

## 关键参数

- **Session 过期时间**：2 分钟（数据库端 `cleanup_expired_sessions` 函数）
- **心跳间隔**：30 秒（定期更新 session）
- **主动续期阈值**：90 秒（距离上次心跳超过此时间则主动续期，留 30 秒缓冲）
- **Cursor 更新间隔**：100 毫秒（只在位置变化时实际更新）

## 工作流程

### 正常情况
```
用户活跃
  ↓
心跳定时器每 30 秒更新 session
  ↓
lastHeartbeatTimeRef 记录心跳时间
  ↓
session 保持活跃
```

### 页面不活跃场景
```
用户切走 Tab
  ↓
浏览器暂停定时器
  ↓
心跳停止，session 2 分钟后过期
  ↓
用户切回 Tab
  ↓
visibilitychange 事件触发
  ↓
检查：now - lastHeartbeatTime > 90s
  ↓
立即续期 session
  ↓
更新 lastHeartbeatTimeRef
  ↓
后续 cursor 更新正常
```

### 鼠标移动触发场景
```
用户长时间不动鼠标
  ↓
移动鼠标
  ↓
cursor 更新定时器触发
  ↓
检查：now - lastHeartbeatTime > 90s
  ↓
主动续期 session（在 cursor 更新前）
  ↓
使用新 sessionId 更新 cursor
  ↓
避免外键约束错误
```

### 兜底重试场景（最坏情况）
```
cursor 更新失败
  ↓
检测到外键约束错误（session 不存在）
  ↓
立即重新创建 session
  ↓
重试 cursor 更新
  ↓
记录新的心跳时间
```

## 优势

1. **主动预防**：在操作前就检查并续期，而不是等失败后重试
2. **多层保障**：页面可见性 + 鼠标移动 + 失败重试，三层机制确保可靠性
3. **用户体验**：用户感知不到 session 续期过程，操作流畅
4. **日志友好**：关键操作都有 `[Session]` 前缀日志，便于调试

## 调试

在浏览器控制台查看 session 相关日志：

```
[Session] Page became visible, renewing session
[Session] Session renewed on visibility change
[Session] Long time since last heartbeat, proactively renewing session
[Session] Session proactively renewed
[Session] Session not found during cursor update, recreating session
[Session] Session recreated and cursor updated
```

## 注意事项

1. **阈值选择**：90 秒阈值留有 30 秒缓冲时间，确保在 session 过期（120 秒）前续期
2. **避免频繁续期**：只在距离上次心跳超过阈值时才续期，避免不必要的数据库操作
3. **Ref 使用**：使用 `lastHeartbeatTimeRef` 确保定时器中访问的是最新值
4. **清理监听器**：组件卸载时移除 `visibilitychange` 监听器，避免内存泄漏
