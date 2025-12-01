# 修复 Realtime 更新导致本地修改丢失的问题

## 问题描述

在之前的实现中存在一个严重的并发问题:

1. 用户修改卡片内容
2. 触发自动保存(防抖后保存到数据库)
3. 数据库更新触发 Supabase Realtime 事件
4. `subscribeCards` 回调接收到事件,重新加载所有卡片
5. **问题**: 用户在步骤 2-4 之间继续输入的内容会被数据库返回的旧数据覆盖

### 问题根源

Realtime 订阅会接收到**所有**数据库变更事件,包括由当前用户/会话发起的变更。如果不过滤自己的更新,就会出现:

```
时刻 T0: 本地状态 = "Hello"
时刻 T1: 用户继续输入 → 本地状态 = "Hello World"
时刻 T2: T0 时刻的保存请求完成,触发 realtime 事件
时刻 T3: subscribeCards 回调执行,将本地状态重置为 "Hello"
结果: 用户输入的 " World" 丢失!
```

## 解决方案

### 核心思路

在 Realtime 订阅回调中过滤掉由当前会话发起的更新,避免用本地已经更新的数据覆盖自己。

### 实现细节

#### 1. 数据库 Schema 变更

在 `cards` 表中添加 `updated_by_session` 字段:

```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS updated_by_session TEXT;
CREATE INDEX IF NOT EXISTS idx_cards_updated_by_session ON cards(updated_by_session);
```

#### 2. 修改 `saveCard` 函数

```typescript
export const saveCard = async (card: CanvasItemData, sessionId?: string | null): Promise<void> => {
  // ...
  const { error: cardError } = await supabase
    .from('cards')
    .upsert({
      // ... 其他字段
      updated_by_session: sessionId || null, // 记录发起更新的会话 ID
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    });
  // ...
};
```

#### 3. 修改 `subscribeCards` 函数

```typescript
export const subscribeCards = (
  callback: (cards: CanvasItemData[]) => void,
  currentSessionId?: string | null
): (() => void) => {
  const channel = supabase
    .channel('cards-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cards' },
      async (payload) => {
        // 关键: 过滤掉自己发起的更新
        const updatedBySession = payload.new?.updated_by_session;
        if (currentSessionId && updatedBySession === currentSessionId) {
          console.log('[subscribeCards] 忽略自己发起的更新', payload.new?.id);
          return; // 不执行 callback,保留本地状态
        }
        
        // 只处理其他会话的更新
        const cards = await loadCards();
        callback(cards);
      }
    )
    .subscribe();
  // ...
};
```

#### 4. 更新 `App.tsx` 中的调用

```typescript
// 在所有 saveCard 调用处传入 sessionId
await saveCard(card, sessionId);

// 订阅卡片变化时传入当前 sessionId
unsubscribeCards = subscribeCards((cards) => {
  // ...
}, sid); // 传入 sessionId 用于过滤
```

## 工作流程对比

### 修复前

```
用户输入 → 本地状态更新 → 防抖保存 → DB 更新 
                ↓                           ↓
          继续输入 (累积更改)      触发 realtime 事件
                ↓                           ↓
          本地状态 = "新内容"      subscribeCards 回调
                                            ↓
                                   重新加载卡片 (旧数据)
                                            ↓
                                   ❌ 覆盖本地状态 → 丢失用户输入!
```

### 修复后

```
用户输入 → 本地状态更新 → 防抖保存(附带 sessionId) → DB 更新 
                ↓                                          ↓
          继续输入 (累积更改)                  触发 realtime 事件(包含 sessionId)
                ↓                                          ↓
          本地状态 = "新内容"                    subscribeCards 回调
                                                           ↓
                                            检查 payload.new.updated_by_session
                                                           ↓
                                            发现是自己的 sessionId
                                                           ↓
                                            ✅ 忽略该事件,保留本地状态
```

## 边界情况处理

### 1. sessionId 为空的情况

```typescript
if (currentSessionId && updatedBySession === currentSessionId) {
  return; // 只在两者都存在且相等时过滤
}
```

- 如果 `currentSessionId` 为空(用户未初始化),不过滤任何事件
- 如果 `updatedBySession` 为空(老数据或系统创建),允许事件通过

### 2. 多标签页/多设备场景

- 每个标签页/设备有独立的 sessionId
- 其他标签页的更新会正常同步(sessionId 不同)
- 同一标签页内的更新会被过滤

### 3. `isSyncingRemoteUpdateRef` 标志的保留

虽然添加了 sessionId 过滤,但保留 `isSyncingRemoteUpdateRef` 标志作为**额外防护层**:

```typescript
if (!initializingCardIdsRef.current.has(id) && !isSyncingRemoteUpdateRef.current) {
  debouncedSaveCard(updatedItem);
}
```

这个标志防止在处理远程更新时触发新的保存请求,形成双重保护。

## 性能考虑

### 索引优化

```sql
CREATE INDEX IF NOT EXISTS idx_cards_updated_by_session ON cards(updated_by_session);
```

虽然当前不使用 `updated_by_session` 进行查询过滤,但添加索引为未来优化留出空间(例如查询"某个会话修改过的所有卡片")。

### 内存开销

- 每个卡片记录增加一个 TEXT 字段(UUID,约 36 字节)
- 在数百到数千张卡片的规模下,内存开销可忽略

## 测试验证

### 测试场景 1: 快速连续输入

```
1. 打开一个文章卡片
2. 快速连续输入文本(不暂停)
3. 观察输入过程中是否有回退或丢失
```

**预期结果**: 输入流畅,无内容丢失

### 测试场景 2: 多标签页同步

```
1. 打开两个标签页,加载同一个卡片
2. 在标签页 A 修改内容
3. 观察标签页 B 是否同步更新
```

**预期结果**: 标签页 B 能看到标签页 A 的修改

### 测试场景 3: 防抖期间的修改

```
1. 修改卡片内容
2. 在防抖延迟(0.5s)内继续修改
3. 等待保存完成和 realtime 事件触发
```

**预期结果**: 最终状态反映所有修改,无回退

## 相关文件

- `src/utils/db.ts`: `saveCard` 函数修改
- `src/utils/realtime/cards.ts`: `subscribeCards` 函数修改
- `src/App.tsx`: 调用方更新
- `supabase/migrations/20251201_add_updated_by_session.sql`: 数据库 migration
- `docs/database-schema.md`: Schema 文档更新

## 部署步骤

1. 在 Supabase Dashboard 中执行 migration SQL
2. 部署更新后的前端代码
3. 验证测试场景

## 总结

通过在数据库中记录更新来源(sessionId)并在 Realtime 订阅中过滤自己的更新,彻底解决了本地修改被远程事件覆盖的问题。这个方案:

✅ 保证用户输入不会丢失
✅ 保持多标签页/多设备的实时同步
✅ 性能开销最小
✅ 兼容现有代码结构
