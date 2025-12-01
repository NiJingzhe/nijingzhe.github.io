/**
 * 卡片 Realtime 订阅
 * 处理卡片的实时同步
 */

import supabase from '../supabase';
import { loadCards } from '../db';
import type { CanvasItemData } from '../../types';

/**
 * 订阅卡片变化
 * @param callback 当卡片变化时调用的回调函数，参数为卡片数组
 * @param currentSessionId 当前会话 ID，用于过滤自己发起的更新
 * @returns 取消订阅的函数
 */
export const subscribeCards = (
  callback: (cards: CanvasItemData[]) => void,
  currentSessionId?: string | null
): (() => void) => {
  // 先获取一次当前卡片
  loadCards()
    .then((cards) => {
      callback(cards);
    })
    .catch((error) => {
      console.error('Error getting initial cards:', error);
      callback([]);
    });

  // 创建订阅通道
  const channel = supabase
    .channel('cards-updates')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'cards'
      },
      async (payload) => {
        // 过滤掉由当前会话发起的更新，避免覆盖本地未保存的修改
        const updatedBySession = payload.new?.updated_by_session;
        if (currentSessionId && updatedBySession === currentSessionId) {
          console.log('[subscribeCards] 忽略自己发起的更新', payload.new?.id);
          return;
        }
        
        // 当 cards 表发生变化时，重新获取所有卡片
        try {
          const cards = await loadCards();
          callback(cards);
        } catch (error) {
          console.error('Error getting cards:', error);
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};

