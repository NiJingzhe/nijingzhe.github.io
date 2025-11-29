/**
 * 光标位置 Realtime 订阅
 * 处理光标位置的实时同步
 */

import supabase from '../supabase';
import { getActiveCursors, type Cursor } from '../db';

/**
 * 订阅光标位置变化
 * @param callback 当光标位置变化时调用的回调函数，参数为光标数组
 * @returns 取消订阅的函数
 */
export const subscribeCursors = (
  callback: (cursors: Cursor[]) => void
): (() => void) => {
  // 先获取一次当前活跃光标
  getActiveCursors()
    .then((cursors) => {
      callback(cursors);
    })
    .catch((error) => {
      console.error('Error getting initial cursors:', error);
      callback([]);
    });

  // 创建订阅通道
  const channel = supabase
    .channel('cursors-updates')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'cursors'
      },
      async () => {
        // 当 cursors 表发生变化时，重新获取所有活跃光标
        try {
          const cursors = await getActiveCursors();
          callback(cursors);
        } catch (error) {
          console.error('Error getting cursors:', error);
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};

