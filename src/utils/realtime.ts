/**
 * Realtime 订阅管理
 * 处理 Supabase Realtime 订阅，实时同步数据
 */

import supabase from './supabase';
import { getOnlineCount } from './db';

/**
 * 订阅在线人数变化
 * @param callback 当在线人数变化时调用的回调函数
 * @returns 取消订阅的函数
 */
export const subscribeOnlineCount = (
  callback: (count: number) => void
): (() => void) => {
  // 先获取一次当前在线人数
  getOnlineCount()
    .then((count) => {
      console.log('Initial online count:', count); // 调试日志
      callback(count);
    })
    .catch((error) => {
      console.error('Error getting initial online count:', error);
      callback(0); // 出错时返回 0
    });
  
  // 创建订阅通道
  const channel = supabase
    .channel('online-count')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'sessions'
      },
      async () => {
        // 当 sessions 表发生变化时，重新获取在线人数
        try {
          const count = await getOnlineCount();
          console.log('Realtime update - online count:', count); // 调试日志
          callback(count);
        } catch (error) {
          console.error('Error getting online count:', error);
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};

/**
 * 获取当前在线人数
 */
export const getCurrentOnlineCount = async (): Promise<number> => {
  try {
    return await getOnlineCount();
  } catch (error) {
    console.error('Error getting current online count:', error);
    return 0;
  }
};

