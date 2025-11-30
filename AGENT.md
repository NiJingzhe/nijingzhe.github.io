# AGENT.md — Extended AI Agent Reference

> 本文件作为 `.github/copilot-instructions.md` 的补充，提供更详细的任务分解与代码导航指南。

---

## 1. 项目概览

| 层          | 技术                              | 入口 / 关键文件                                       |
|-------------|-----------------------------------|------------------------------------------------------|
| 前端框架     | React 18 + TypeScript             | `src/main.tsx` → `src/App.tsx`                       |
| 样式        | Tailwind CSS 4 (Vite plugin)      | `src/index.css`, `src/App.css`                       |
| 构建        | Vite 6                            | `vite.config.ts`                                     |
| 后端/数据库  | Supabase (Postgres + Realtime)    | `src/utils/supabase.ts`, `supabase/config.toml`      |
| 部署        | GitHub Actions → GitHub Pages     | `.github/workflows/deploy.yml`                       |

---

## 2. 核心模块职责

### 2.1 组件 (`src/components/`)

| 文件                     | 作用                                                                 |
|--------------------------|----------------------------------------------------------------------|
| `Canvas.tsx`             | 无限画布，负责缩放/平移、承载卡片与绘图层                             |
| `CanvasItem.tsx`         | 单张卡片容器，处理拖动、缩放、锁定状态                                |
| `ArticleEditor.tsx`      | Markdown 编辑器，内部调用 `RetroMarkdown` 渲染预览                   |
| `RetroMarkdown.tsx`      | 自定义 Markdown 渲染，支持 KaTeX、代码高亮                           |
| `CanvasDrawingLayer.tsx` | 绘图画布，处理路径采集与擦除                                         |
| `Dock.tsx`               | 绘图模式工具栏（颜色/笔宽/撤销/重做）                                |
| `CursorLayer.tsx` / `CursorManager.tsx` | 多人光标显示                                        |
| `GitHubCard.tsx`         | GitHub 仓库信息卡片                                                  |
| `StatusBar.tsx`          | 底部状态栏（在线人数、访问量、Vim 模式）                             |

### 2.2 工具函数 (`src/utils/`)

| 文件                | 作用                                                                 |
|---------------------|----------------------------------------------------------------------|
| `db.ts`             | Supabase CRUD：`loadCards`, `saveCard`, `deleteCard`, `loadDrawings`, `saveDrawing`, `deleteDrawing` 等 |
| `supabase.ts`       | Supabase 客户端初始化                                                |
| `editLock.ts`       | 编辑锁生命周期：`acquireLock`, `renewLock`, `releaseLock`, `isCardLocked` |
| `githubApi.ts`      | 调用 GitHub REST API 获取仓库信息                                    |
| `pathFilter.ts`     | 绘图轨迹滤波（移动平均 + Douglas-Peucker）                           |
| `cleanup.ts`        | 应用启动时清理过期会话、光标、编辑锁                                 |
| `user.ts`           | 用户/会话管理（`initializeUser`, `updateSessionHeartbeat`）          |

### 2.3 Realtime 订阅 (`src/utils/realtime/`)

| 文件              | 订阅内容                     |
|-------------------|------------------------------|
| `cards.ts`        | 卡片增删改                   |
| `cursors.ts`      | 多人光标位置                 |
| `editLocks.ts`    | 编辑锁状态                   |
| `stats.ts`        | 在线人数、访问量             |
| `index.ts`        | 导出所有订阅函数             |

---

## 3. 数据流与状态

```
┌────────────────────────────────────────────────────────────────────┐
│                            App.tsx                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ State: items[], drawPaths[], vimMode, editingCardId, ...     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│        │                          ▲                                │
│        │ setItems / setDrawPaths  │ subscribeCards / subscribeCursors│
│        ▼                          │                                │
│  ┌─────────────┐            ┌─────────────┐                        │
│  │  db.ts      │◀──────────▶│  Supabase   │                        │
│  │  saveCard() │            │  (Realtime) │                        │
│  └─────────────┘            └─────────────┘                        │
└────────────────────────────────────────────────────────────────────┘
```

### 关键防护标志（避免循环保存）

| Ref                          | 用途                                                   |
|------------------------------|--------------------------------------------------------|
| `initializingCardIdsRef`     | 标记初始化期间创建的卡片，跳过 `updateItem` 触发的保存 |
| `isSyncingRemoteUpdateRef`   | 标记正在应用远程更新，跳过本地保存                     |
| `pendingSaveQueueRef`        | 批量保存队列，配合 `requestIdleCallback` 延迟写入      |

---

## 4. Vim 模式系统

| 模式      | 触发             | 退出              | 主要操作                                     |
|-----------|------------------|-------------------|----------------------------------------------|
| `normal`  | 默认 / `ESC`     | —                 | `hjkl` 导航、`zi`/`zo` 缩放、`D` 删除、`:` 命令 |
| `edit`    | `i`              | `ESC`             | 编辑选中卡片内容                             |
| `draw`    | `d`              | `ESC`             | 在画布上绘制 / 擦除                          |
| `command` | `:`              | `ESC` / 执行命令  | `:na` 新建文章、`:nr` 新建仓库卡片、`:ni` 新建图片、`:w` 保存 |

状态管理在 `App.tsx` 中通过 `vimMode` state 和 `useEffect` 键盘事件监听实现。

---

## 5. 常见任务分解

### 5.1 新增卡片类型

1. 在 `src/types/index.ts` 中扩展 `CanvasItemData['type']` 联合类型。
2. 在 `src/components/` 创建对应的卡片组件（参考 `GitHubCard.tsx`）。
3. 在 `CanvasItem.tsx` 的渲染分支中添加新类型的 case。
4. 在 `App.tsx` 的 `executeCommand` 中添加创建命令（如 `:nx`）。
5. 更新 `db.ts` 的序列化/反序列化逻辑（如有新字段）。

### 5.2 修改保存逻辑

1. 阅读 `App.tsx` 中 `saveCardTimerRef` 和 `pendingSaveQueueRef` 的使用。
2. 任何新增的异步保存都应复用 debounce + queue 模式。
3. 确保在远程更新回调中设置 `isSyncingRemoteUpdateRef = true`，避免循环写入。

### 5.3 添加 Realtime 订阅

1. 在 `src/utils/realtime/` 创建新文件（如 `newTopic.ts`），导出 `subscribeNewTopic` 函数。
2. 在 `index.ts` 中 re-export。
3. 在 `App.tsx` 的 `initUserAndStats` 中调用并存储 `unsubscribe` 句柄。
4. 在 `useEffect` cleanup 中调用 `unsubscribe()`。

### 5.4 数据库 Schema 变更

1. 在 Supabase Dashboard 或 migration 文件中修改表结构。
2. 更新 `src/utils/db.ts` 中相关查询和类型。
3. 如果涉及 Realtime，检查 `supabase/config.toml` 的 `realtime.tables` 配置。
4. 本地测试后提交 migration，CI 会自动部署到 Pages（但 DB 需手动迁移）。

---

## 6. 环境与 CI

### 6.1 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建（TypeScript + Vite）
pnpm build

# 预览构建产物
pnpm preview
```

### 6.2 环境变量

| 变量名                   | 用途                      | 本地位置       | CI 位置               |
|--------------------------|---------------------------|----------------|-----------------------|
| `VITE_SUPABASE_URL`      | Supabase 项目 URL         | `.env.local`   | GitHub Secrets        |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名 Key         | `.env.local`   | GitHub Secrets        |
| `VITE_UNLOCK_PASSWORD`   | 卡片解锁密码              | `.env.local`   | GitHub Secrets        |

### 6.3 部署流程

1. 推送到 `main` 分支。
2. GitHub Actions (`.github/workflows/deploy.yml`) 执行 `pnpm build`。
3. 构建产物发布到 GitHub Pages（`base: '/'`）。

---

## 7. 代码风格与检查

- TypeScript 严格模式（`tsconfig.json` 中 `strict: true`）。
- ESLint 配置位于 `eslint.config.js`；运行 `pnpm lint`（如有脚本）或直接 `npx eslint .`。
- 提交前确保 `pnpm build` 通过（CI 强制检查）。

---

## 8. 文档与参考

| 文档                              | 位置                                  |
|-----------------------------------|---------------------------------------|
| 数据库 Schema                     | `docs/database-schema.md`             |
| Supabase Realtime 配置            | `docs/supabase-realtime-config.md`    |
| 清理机制                          | `docs/cleanup-mechanism.md`           |
| 实现计划                          | `docs/implementation-plan.md`         |
| XSS 测试向量                      | `docs/test-xss-vectors.md`            |
| 部署说明                          | `DEPLOYMENT.md`                       |

---

## 9. 疑难排查

| 现象                              | 可能原因                              | 排查步骤                              |
|-----------------------------------|---------------------------------------|---------------------------------------|
| 卡片保存后立即被覆盖              | 远程更新回调未设置 `isSyncingRemoteUpdateRef` | 检查 `subscribeCards` 回调逻辑        |
| 编辑时锁被抢占                    | 锁续期失败或超时                      | 检查 `renewLock` 定时器是否正常运行   |
| 构建失败                          | TypeScript 类型错误                   | 运行 `pnpm build` 查看具体错误        |
| Realtime 不生效                   | 表未加入 `realtime.tables`            | 检查 `supabase/config.toml`           |

---

*— End of AGENT.md —*
