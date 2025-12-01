# 数据库 Schema 说明

本文档描述了个人页面项目使用的数据库表结构和字段定义。

## 概述

项目使用 Supabase 作为后端数据库，主要包含两个表：
- `cards`: 存储画布上的卡片（文章、图片、GitHub 仓库）
- `drawings`: 存储画布上的涂鸦路径

## cards 表

存储画布上的所有卡片项，支持三种类型：文章（article）、图片（image）和 GitHub 仓库（github）。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 卡片唯一标识符 | 主键 |
| `type` | `text` | 卡片类型 | `'article'` \| `'image'` \| `'github'` |
| `position_x` | `numeric` | 卡片在画布上的 X 坐标 | 默认 0 |
| `position_y` | `numeric` | 卡片在画布上的 Y 坐标 | 默认 0 |
| `width` | `numeric` | 卡片宽度（像素） | 默认 600 |
| `height` | `numeric` | 卡片高度（像素） | 默认 400 |
| `locked` | `boolean` | 是否锁定（锁定后不可拖拽） | 默认 false |
| `data` | `jsonb` | 卡片数据（JSON 格式） | 必填 |
| `updated_by_session` | `text` | 最后更新该卡片的会话 ID | 可选 |
| `created_at` | `timestamp` | 创建时间 | 自动生成 |
| `updated_at` | `timestamp` | 更新时间 | 自动更新 |

### data 字段结构

`data` 字段是一个 JSONB 对象，根据不同的 `type` 包含不同的字段：

#### 通用字段（所有类型）

```json
{
  "title": "string",      // 卡片标题
  "visible": boolean      // 是否可见（用于软删除，默认 true）
}
```

#### article 类型

```json
{
  "title": "string",      // 文章标题（可选，会从 content 的第一个 H1 提取）
  "content": "string",    // Markdown 格式的文章内容
  "visible": boolean      // 是否可见
}
```

#### image 类型

```json
{
  "title": "string",      // 图片标题（可选，默认为 'IMAGE_VIEW'）
  "url": "string",        // 图片 URL
  "visible": boolean      // 是否可见
}
```

#### github 类型

```json
{
  "title": "string",      // 仓库标题（可选，会从 repo 字段提取）
  "repo": "string",       // 仓库路径，格式：owner/repo
  "url": "string",        // 仓库 URL
  "language": "string",   // 主要编程语言
  "stars": number,        // Star 数量
  "forks": number,        // Fork 数量
  "description": "string", // 仓库描述
  "visible": boolean      // 是否可见
}
```

### 操作说明

- **创建/更新**: 使用 `upsert` 操作，基于 `id` 进行冲突处理
- **删除**: 软删除，通过设置 `data.visible = false` 实现
- **查询**: 按 `created_at` 升序排序，只返回 `visible !== false` 的卡片

## drawings 表

存储画布上的涂鸦路径数据。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 涂鸦路径唯一标识符 | 主键，自动生成 |
| `path_svg` | `text` | SVG 路径字符串 | 必填 |
| `color` | `text` | 画笔颜色（十六进制） | 默认 `'#00ffff'` |
| `stroke_width` | `numeric` | 画笔宽度（像素） | 默认 3 |
| `created_at` | `timestamp` | 创建时间 | 自动生成 |

### path_svg 格式

`path_svg` 字段存储 SVG 路径命令字符串，格式为：
```
M x1 y1 L x2 y2 L x3 y3 ...
```

其中：
- `M` 表示 MoveTo（移动到起点）
- `L` 表示 LineTo（画线到该点）
- 坐标值之间用空格分隔

### 数据转换

应用层使用点数组格式 `Array<{ x: number; y: number }>`，在保存和加载时会自动转换：

- **保存**: 点数组 → SVG 路径字符串
- **加载**: SVG 路径字符串 → 点数组

### 操作说明

- **创建**: 插入新记录，返回生成的 `id`
- **删除**: 硬删除，直接从数据库删除记录
- **查询**: 按 `created_at` 升序排序

## 索引建议

为了提高查询性能，建议创建以下索引：

```sql
-- cards 表索引
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_created_at ON cards(created_at);
CREATE INDEX idx_cards_data_visible ON cards USING GIN ((data->>'visible'));

-- drawings 表索引
CREATE INDEX idx_drawings_created_at ON drawings(created_at);
```

## visitors 表

存储访问者信息，支持通过 `setuname` 命令绑定 uid 和 uname。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 访问者记录 ID | 主键 |
| `uid` | `uuid` | localStorage 中的 UUID | 唯一约束 |
| `uname` | `text` | 用户自定义名称 | 可为空 |
| `first_seen_at` | `timestamp` | 首次访问时间 | 自动生成 |
| `last_seen_at` | `timestamp` | 最后访问时间 | 自动更新 |
| `visit_count` | `integer` | 访问次数 | 默认 1 |
| `created_at` | `timestamp` | 创建时间 | 自动生成 |
| `updated_at` | `timestamp` | 更新时间 | 自动更新 |

## sessions 表

跟踪在线会话，用于实时统计在线人数。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 会话 ID | 主键 |
| `visitor_uid` | `uuid` | 访问者 UID | 外键 → visitors(uid) |
| `last_heartbeat` | `timestamp` | 最后心跳时间 | 默认 NOW() |
| `created_at` | `timestamp` | 创建时间 | 自动生成 |

**在线判断**: 如果 `last_heartbeat` 在 2 分钟内，视为在线。

## visits 表

记录每次访问，用于访问量统计。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 访问记录 ID | 主键 |
| `visitor_uid` | `uuid` | 访问者 UID | 外键 → visitors(uid) |
| `session_id` | `uuid` | 会话 ID | 外键 → sessions(id) |
| `visited_at` | `timestamp` | 访问时间 | 默认 NOW() |
| `user_agent` | `text` | 用户代理 | 可为空 |
| `referrer` | `text` | 来源页面 | 可为空 |

## cursors 表

实时存储所有访问者的光标位置，支持光标可视化。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 光标记录 ID | 主键 |
| `visitor_uid` | `uuid` | 访问者 UID | 外键 → visitors(uid) |
| `session_id` | `uuid` | 会话 ID | 外键 → sessions(id) |
| `x` | `numeric` | 画布坐标 X | 必填 |
| `y` | `numeric` | 画布坐标 Y | 必填 |
| `canvas_x` | `numeric` | 画布偏移 X | 可为空 |
| `canvas_y` | `numeric` | 画布偏移 Y | 可为空 |
| `canvas_scale` | `numeric` | 画布缩放比例 | 默认 1 |
| `updated_at` | `timestamp` | 更新时间 | 自动更新 |

**唯一约束**: `(visitor_uid, session_id)` 组合唯一，每个会话一条记录。

## edit_locks 表

管理卡片编辑权限，防止并发编辑冲突。

### 表结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | `uuid` | 锁 ID | 主键 |
| `card_id` | `uuid` | 卡片 ID | 外键 → cards(id)，唯一约束 |
| `visitor_uid` | `uuid` | 访问者 UID | 外键 → visitors(uid) |
| `session_id` | `uuid` | 会话 ID | 外键 → sessions(id) |
| `locked_at` | `timestamp` | 锁定时间 | 默认 NOW() |
| `expires_at` | `timestamp` | 过期时间 | 必填 |
| `created_at` | `timestamp` | 创建时间 | 自动生成 |

**唯一约束**: `card_id` 唯一，确保一张卡片同时只能被一个用户编辑。

## 数据清理机制

为了保持数据库性能，需要定期清理过期数据：

- **过期会话**: 超过 2 分钟未心跳的会话
- **过期光标**: 超过 5 分钟未更新的光标
- **过期编辑锁**: 超过 `expires_at` 时间的锁

### 清理触发方式

提供了多种清理触发方式（见 `src/utils/cleanup.ts`）：

1. **应用启动时清理** - 在应用初始化时执行一次
2. **定期清理** - 使用 `setInterval` 定期执行（推荐每 5 分钟）
3. **页面可见性变化时清理** - 用户切换回页面时触发
4. **用户操作时清理** - 在用户操作时触发（带节流）
5. **综合方案** - 结合多种方式，确保数据及时清理

**推荐使用综合方案**：

```typescript
import { setupComprehensiveCleanup } from './utils/cleanup';

useEffect(() => {
  const cleanup = setupComprehensiveCleanup();
  return cleanup; // 组件卸载时清理
}, []);
```

### 清理函数

- `cleanupExpiredSessions()` - 清理过期会话
- `cleanupExpiredCursors()` - 清理过期光标
- `cleanupExpiredEditLocks()` - 清理过期编辑锁
- `cleanupExpiredData()` - 综合清理（推荐）

## 索引建议

为了提高查询性能，建议创建以下索引：

```sql
-- cards 表索引
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_created_at ON cards(created_at);
CREATE INDEX idx_cards_data_visible ON cards USING GIN ((data->>'visible'));

-- drawings 表索引
CREATE INDEX idx_drawings_created_at ON drawings(created_at);

-- visitors 表索引
CREATE INDEX idx_visitors_uid ON visitors(uid);
CREATE INDEX idx_visitors_uname ON visitors(uname) WHERE uname IS NOT NULL;
CREATE INDEX idx_visitors_last_seen_at ON visitors(last_seen_at);

-- sessions 表索引
CREATE INDEX idx_sessions_visitor_uid ON sessions(visitor_uid);
CREATE INDEX idx_sessions_last_heartbeat ON sessions(last_heartbeat);

-- visits 表索引
CREATE INDEX idx_visits_visitor_uid ON visits(visitor_uid);
CREATE INDEX idx_visits_visited_at ON visits(visited_at);

-- cursors 表索引
CREATE UNIQUE INDEX idx_cursors_visitor_session ON cursors(visitor_uid, session_id);
CREATE INDEX idx_cursors_updated_at ON cursors(updated_at);

-- edit_locks 表索引
CREATE UNIQUE INDEX idx_edit_locks_card_id ON edit_locks(card_id);
CREATE INDEX idx_edit_locks_expires_at ON edit_locks(expires_at);
```

## 注意事项

1. **软删除机制**: `cards` 表使用软删除，通过 `data.visible` 字段控制，不会真正删除数据
2. **类型安全**: `type` 字段只接受 `'article'`、`'image'`、`'github'` 三种值
3. **坐标系统**: `position_x` 和 `position_y` 使用画布坐标系，单位为像素
4. **时间戳**: `created_at` 和 `updated_at` 由数据库自动管理
5. **UUID**: 所有 `id` 字段使用 UUID 格式，确保全局唯一性
6. **数据清理**: 必须定期清理过期数据，否则会导致表膨胀和性能下降
7. **心跳机制**: 会话心跳建议每 30-60 秒更新一次
8. **光标更新**: 光标位置更新建议使用节流（100-200ms），避免过于频繁的数据库写入

