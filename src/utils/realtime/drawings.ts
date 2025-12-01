/**
 * 绘制路径 Realtime 订阅
 * 处理绘制路径的实时同步
 */

import supabase from '../supabase';
import { loadDrawings } from '../db';
import type { DrawPath } from '../../types';

/**
 * 订阅绘制路径变化
 * @param callback 当绘制路径变化时调用的回调函数，参数为绘制路径数组
 * @returns 取消订阅的函数
 */
export const subscribeDrawings = (
  callback: (drawings: DrawPath[]) => void
): (() => void) => {
  // 先获取一次当前绘制路径
  loadDrawings()
    .then((drawings) => {
      callback(drawings);
    })
    .catch((error) => {
      console.error('Error getting initial drawings:', error);
      callback([]);
    });

  // 创建订阅通道
  const channel = supabase
    .channel('drawings-updates')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'drawings'
      },
      async () => {
        // 当 drawings 表发生变化时，重新获取所有绘制路径
        try {
          const drawings = await loadDrawings();
          callback(drawings);
        } catch (error) {
          console.error('Error getting drawings:', error);
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};
