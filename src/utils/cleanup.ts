/**
 * 数据清理工具
 * 
 * 提供多种方式触发清理过期数据（会话、光标、编辑锁、软删除的卡片）
 */

import { cleanupExpiredData, cleanupSoftDeletedCards } from './db';

/**
 * 方案 1: 应用启动时清理
 * 在 App.tsx 的 useEffect 中调用
 */
export const cleanupOnAppStart = async (): Promise<void> => {
  try {
    await cleanupExpiredData();
    // 清理 1 天前软删除的卡片（频率较低，只在启动时执行）
    // 注意：可以通过环境变量或配置调整清理天数，测试时可以设置为 0 来立即清理所有软删除的卡片
    const softDeleteDays = 1; // 清理 1 天前软删除的卡片
    const deletedCount = await cleanupSoftDeletedCards(softDeleteDays);
    console.log('Cleanup completed on app start', { deletedCards: deletedCount });
  } catch (error) {
    console.error('Failed to cleanup on app start:', error);
  }
};

/**
 * 方案 2: 定期清理（推荐）
 * 使用 setInterval 定期执行清理
 * 
 * 使用示例：
 * useEffect(() => {
 *   const interval = startPeriodicCleanup(5 * 60 * 1000); // 每 5 分钟清理一次
 *   return () => clearInterval(interval);
 * }, []);
 */
export const startPeriodicCleanup = (intervalMs: number = 5 * 60 * 1000): ReturnType<typeof setInterval> => {
  // 立即执行一次
  cleanupExpiredData().catch(console.error);

  // 然后定期执行
  return setInterval(() => {
    cleanupExpiredData().catch(console.error);
    // 定期清理软删除的卡片（每天执行一次，通过检查时间戳实现）
    // 这里简化处理，每次清理时都检查，但数据库端函数会判断是否真的需要清理
    cleanupSoftDeletedCards(1).catch(console.error);
  }, intervalMs);
};

/**
 * 方案 3: 页面可见性变化时清理
 * 当用户切换回页面时触发清理
 * 
 * 使用示例：
 * useEffect(() => {
 *   const handleVisibilityChange = () => {
 *     if (!document.hidden) {
 *       cleanupOnVisibilityChange();
 *     }
 *   };
 *   document.addEventListener('visibilitychange', handleVisibilityChange);
 *   return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
 * }, []);
 */
export const cleanupOnVisibilityChange = async (): Promise<void> => {
  try {
    await cleanupExpiredData();
    console.log('Cleanup completed on visibility change');
  } catch (error) {
    console.error('Failed to cleanup on visibility change:', error);
  }
};

/**
 * 方案 4: 用户操作时清理（节流）
 * 在用户执行某些操作时触发清理，但使用节流避免过于频繁
 */
let lastCleanupTime = 0;
const CLEANUP_THROTTLE_MS = 2 * 60 * 1000; // 2 分钟内最多清理一次

export const cleanupOnUserAction = async (): Promise<void> => {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_THROTTLE_MS) {
    return; // 节流：如果距离上次清理时间太短，跳过
  }

  lastCleanupTime = now;
  try {
    await cleanupExpiredData();
    console.log('Cleanup completed on user action');
  } catch (error) {
    console.error('Failed to cleanup on user action:', error);
  }
};

/**
 * 方案 5: 综合方案（推荐用于生产环境）
 * 结合多种触发方式，确保数据及时清理
 * 
 * 使用示例：
 * useEffect(() => {
 *   // 启动时清理
 *   cleanupOnAppStart();
 *   
 *   // 定期清理（每 5 分钟）
 *   const interval = startPeriodicCleanup(5 * 60 * 1000);
 *   
 *   // 页面可见性变化时清理
 *   const handleVisibilityChange = () => {
 *     if (!document.hidden) {
 *       cleanupOnVisibilityChange();
 *     }
 *   };
 *   document.addEventListener('visibilitychange', handleVisibilityChange);
 *   
 *   return () => {
 *     clearInterval(interval);
 *     document.removeEventListener('visibilitychange', handleVisibilityChange);
 *   };
 * }, []);
 */
export const setupComprehensiveCleanup = (): (() => void) => {
  // 启动时清理
  cleanupOnAppStart();

  // 定期清理（每 5 分钟）
  const interval = startPeriodicCleanup(5 * 60 * 1000);

  // 页面可见性变化时清理
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      cleanupOnVisibilityChange();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 返回清理函数
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

