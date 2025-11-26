import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 忽略 React DevTools 扩展的连接错误
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('disconnected port object') || 
        errorMessage.includes('Attempting to use a disconnected port')) {
      return; // 静默忽略 DevTools 连接错误
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
