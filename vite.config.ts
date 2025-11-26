import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // GitHub Pages 用户页面使用根路径，项目页面使用 '/repository-name/'
  // 注意：Vite 的代理配置对动态 URL 支持有限
  // 如果需要代理功能，建议使用独立的代理服务器（见 PROXY_SOLUTIONS.md）
  // 或者使用第三方代理服务
})
