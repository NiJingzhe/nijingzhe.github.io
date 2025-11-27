# LilDino$aur 的数字花园

> "港口上方的天空是电视的颜色，调到了死频道。"

一个仿照 **vim 操作逻辑**的无限画布空间，用于自由组织文章、图片和 GitHub 仓库卡片。通过键盘快捷键高效操作，打造个性化的数字知识花园。

## ✨ 特性

### 🎨 无限画布
- **自由布局**：在无限画布上自由放置和移动卡片
- **缩放与平移**：支持鼠标拖拽平移、滚轮缩放、键盘快捷键缩放
- **移动端支持**：支持双指缩放手势

### 📝 多种卡片类型
- **文章卡片**：支持 Markdown 编辑，实时预览，支持 LaTeX 数学公式和代码高亮
- **GitHub 仓库卡片**：通过仓库 URL 自动获取仓库信息并展示
- **图片卡片**：支持图片展示和查看

### ⌨️ Vim 模式系统
- **Normal Mode**：默认模式，用于导航和操作
- **Edit Mode**：编辑卡片内容
- **Draw Mode**：在画布上自由绘制
- **Command Mode**：执行命令（新建卡片、保存等）

### 🎨 绘图功能
- **自由绘制**：在画布上绘制任意图形
- **轨迹优化**：自动平滑轨迹并减少点数，提升性能
- **撤销/重做**：支持绘图历史记录
- **擦除模式**：支持擦除已绘制的内容

### 🔒 卡片锁定
- **锁定保护**：锁定后的卡片无法被拖动、调整大小或删除
- **密码解锁**：通过密码验证解锁锁定的卡片

### 💾 数据持久化
- **Supabase 存储**：所有数据自动保存到 Supabase 数据库
- **异步保存**：使用队列和 `requestIdleCallback` 优化保存性能，不阻塞 UI
- **自动同步**：数据变更自动保存，无需手动操作

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 环境变量配置

创建 `.env.local` 文件：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_UNLOCK_PASSWORD=your_unlock_password
```

### 本地开发

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 预览构建结果

```bash
pnpm preview
```

## 📖 操作指南

### Normal Mode (默认模式)

#### 导航
- `h` `j` `k` `l` - 在卡片间导航（左/下/上/右）
- 方向键 - 微调选中卡片位置

#### 编辑与操作
- `i` - 进入编辑模式（编辑当前卡片）
- `d` - 进入绘图模式（在画布上绘制）
- `D` - 删除当前卡片
- `:` - 进入命令模式

#### 视图控制
- `zi` - 放大画布
- `zo` - 缩小画布
- 鼠标拖拽 - 平移画布
- 滚轮 - 缩放画布

### Edit Mode (编辑模式)

- `ESC` - 退出编辑模式，返回 Normal Mode
- 在文章卡片中支持完整的 Markdown 编辑和预览

### Draw Mode (绘图模式)

- 鼠标拖拽 - 在画布上绘制
- `ESC` - 退出绘图模式，返回 Normal Mode
- `u` - 撤销上一步绘制
- `Ctrl+r` - 重做

### Command Mode (命令模式)

- `:na` 或 `:newarticle` - 新建文章卡片
- `:nr` 或 `:newrepo` - 新建 GitHub 仓库卡片
- `:ni` 或 `:newimage` - 新建图片卡片
- `:w` 或 `:save` - 手动保存
- `ESC` - 取消命令，返回 Normal Mode

### 卡片操作

- **拖动**：在 Normal Mode 下，点击并拖动卡片标题栏
- **调整大小**：拖动卡片右下角的调整大小手柄
- **锁定/解锁**：点击卡片标题栏的锁定图标（需要密码解锁）
- **删除**：在 Normal Mode 下按 `D` 键，或点击卡片标题栏的关闭按钮

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 6
- **样式**：Tailwind CSS 4
- **后端存储**：Supabase
- **Markdown 渲染**：自定义 RetroMarkdown 组件
- **数学公式**：KaTeX
- **代码高亮**：react-syntax-highlighter
- **图标**：lucide-react

## 📁 项目结构

```
personal_page/
├── src/
│   ├── components/          # React 组件
│   │   ├── Canvas.tsx       # 画布组件
│   │   ├── CanvasItem.tsx   # 卡片组件
│   │   ├── ArticleEditor.tsx # Markdown 编辑器
│   │   ├── Dock.tsx         # 绘图工具栏
│   │   └── ...
│   ├── utils/               # 工具函数
│   │   ├── db.ts            # Supabase 数据库操作
│   │   ├── githubApi.ts    # GitHub API 调用
│   │   └── pathFilter.ts   # 轨迹滤波工具
│   ├── types/               # TypeScript 类型定义
│   └── App.tsx              # 主应用组件
├── .github/workflows/       # GitHub Actions 工作流
└── supabase/                # Supabase 配置
```

## 🚢 部署

项目使用 GitHub Actions 自动部署到 GitHub Pages。详细部署说明请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)。

### 部署前准备

1. 在 GitHub 仓库的 Secrets 中设置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_UNLOCK_PASSWORD`

2. 启用 GitHub Pages（使用 GitHub Actions 作为源）

3. 推送到 `main` 分支即可自动部署

## 🎯 核心功能实现

### 异步保存优化

使用队列和 `requestIdleCallback` 实现异步保存，避免阻塞主线程：

- 防抖机制：500ms 防抖延迟
- 队列处理：批量处理保存请求
- 空闲执行：在浏览器空闲时执行保存操作

### 轨迹滤波

使用移动平均滤波和自适应 Douglas-Peucker 算法优化绘制轨迹：

- 平滑轨迹：减少抖动
- 自适应简化：根据曲率保留关键点
- 性能优化：减少存储和渲染的数据量

### Vim 模式系统

完整实现了 vim 的操作逻辑：

- 模式切换：Normal → Edit/Draw/Command
- 键盘导航：hjkl 方向键导航
- 命令系统：支持多种命令快捷方式

## 📝 开发

### 项目结构

- `src/components/` - 所有 React 组件
- `src/utils/` - 工具函数和 API 调用
- `src/types/` - TypeScript 类型定义
- `.github/workflows/` - CI/CD 配置

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 React Hooks 最佳实践
- 使用 ESLint 进行代码检查

## 📄 许可证

MIT

## 🙏 致谢

灵感来源于 vim 编辑器和数字花园的概念。

---

**享受你的数字花园之旅！** 🌱
