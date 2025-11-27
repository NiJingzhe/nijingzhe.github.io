# GitHub Pages 部署指南

## 已完成的配置

1. ✅ 已创建 GitHub Actions 工作流 (`.github/workflows/deploy.yml`)
2. ✅ 已配置 Vite 构建设置
3. ✅ 代码已推送到 GitHub

## 下一步操作

### 1. 在 GitHub 上设置 Secrets

由于项目使用了 Supabase 和卡片锁定功能，需要在 GitHub 仓库中设置以下 Secrets：

1. 进入仓库：https://github.com/NiJingzhe/nijingzhe.github.io
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，添加以下三个 secrets：
   - `VITE_SUPABASE_URL`: 你的 Supabase 项目 URL
   - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase Anon Key
   - `VITE_UNLOCK_PASSWORD`: 卡片解锁密码

### 2. 启用 GitHub Pages

1. 进入仓库 **Settings** → **Pages**
2. 在 **Source** 部分，选择：
   - **Source**: `GitHub Actions`
3. 保存设置

### 3. 触发部署

有两种方式触发部署：

**方式一：自动部署（推荐）**
- 每次推送到 `main` 分支时，GitHub Actions 会自动构建并部署

**方式二：手动触发**
- 在仓库的 **Actions** 标签页，选择 "Deploy to GitHub Pages" 工作流
- 点击 **Run workflow** 按钮

### 4. 访问网站

部署完成后，你的网站将在以下地址可用：
- https://nijingzhe.github.io

## 注意事项

1. **首次部署可能需要几分钟**：GitHub Actions 需要构建项目
2. **检查部署状态**：在仓库的 **Actions** 标签页查看部署进度
3. **环境变量**：确保在 GitHub Secrets 中正确设置了 Supabase 的 URL 和 Key，以及解锁密码
4. **构建警告**：CSS 构建时可能有警告，但不影响功能

## 故障排除

如果部署失败：
1. 检查 **Actions** 标签页的错误信息
2. 确认 Secrets 已正确设置
3. 检查构建日志中的具体错误

