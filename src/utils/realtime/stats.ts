/**
 * 统计信息 Realtime 订阅
 * 处理在线人数和访问量的实时同步
 */

import supabase from '../supabase';
import { getOnlineCount, getTotalVisits, getTodayVisits } from '../db';

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

/**
 * 订阅访问量变化
 * @param callback 当访问量变化时调用的回调函数，参数为 { total: number, today: number }
 * @returns 取消订阅的函数
 */
export const subscribeVisits = (
  callback: (visits: { total: number; today: number }) => void
): (() => void) => {
  // 先获取一次当前访问量
  Promise.all([getTotalVisits(), getTodayVisits()])
    .then(([total, today]) => {
      callback({ total, today });
    })
    .catch((error) => {
      console.error('Error getting initial visits:', error);
      callback({ total: 0, today: 0 }); // 出错时返回 0
    });

  // 创建订阅通道
  const channel = supabase
    .channel('visits-count')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'visits'
      },
      async () => {
        // 当 visits 表发生变化时，重新获取访问量
        try {
          const [total, today] = await Promise.all([
            getTotalVisits(),
            getTodayVisits()
          ]);
          callback({ total, today });
        } catch (error) {
          console.error('Error getting visits:', error);
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};

