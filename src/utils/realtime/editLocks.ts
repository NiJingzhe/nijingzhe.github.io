/**
 * 编辑锁 Realtime 订阅
 * 处理编辑锁的实时同步
 */

import supabase from '../supabase';
import { getActiveEditLocks, getVisitorByUid } from '../db';

// 编辑锁信息类型
export interface EditLockInfo {
  visitor_uid: string;
  uname: string | null;
  locked_at: string;
}

/**
 * 订阅编辑锁变化
 * @param callback 当编辑锁变化时调用的回调函数，参数为编辑锁 Map（cardId -> EditLockInfo）
 * @returns 取消订阅的函数
 */
export const subscribeEditLocks = (
  callback: (locks: Map<string, EditLockInfo>) => void
): (() => void) => {
  // 获取所有活跃编辑锁并获取用户名
  const fetchLocksWithNames = async (): Promise<Map<string, EditLockInfo>> => {
    try {
      const locks = await getActiveEditLocks();
      const locksMap = new Map<string, EditLockInfo>();
      
      // 并行获取所有用户名
      await Promise.all(
        locks.map(async (lock) => {
          try {
            const visitor = await getVisitorByUid(lock.visitor_uid);
            locksMap.set(lock.card_id, {
              visitor_uid: lock.visitor_uid,
              uname: visitor?.uname || null,
              locked_at: lock.locked_at
            });
          } catch (error) {
            console.error(`Error getting visitor for lock ${lock.card_id}:`, error);
            // 即使获取用户名失败，也添加锁信息
            locksMap.set(lock.card_id, {
              visitor_uid: lock.visitor_uid,
              uname: null,
              locked_at: lock.locked_at
            });
          }
        })
      );
      
      return locksMap;
    } catch (error) {
      console.error('Error fetching edit locks:', error);
      return new Map();
    }
  };

  // 先获取一次当前编辑锁
  console.log('[Realtime] 订阅编辑锁变化，获取初始锁列表');
  fetchLocksWithNames()
    .then((locks) => {
      console.log(`[Realtime] 获取到初始编辑锁列表，数量: ${locks.size}`, Array.from(locks.entries()).map(([cardId, info]) => ({ cardId, ...info })));
      callback(locks);
    })
    .catch((error) => {
      console.error('[Realtime] 获取初始编辑锁列表异常:', error);
      callback(new Map());
    });

  // 创建订阅通道
  const channel = supabase
    .channel('edit-locks-updates')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'edit_locks'
      },
      async () => {
        // 当 edit_locks 表发生变化时，重新获取所有活跃编辑锁
        console.log('[Realtime] 检测到编辑锁表变化，重新获取锁列表');
        try {
          const locks = await fetchLocksWithNames();
          console.log(`[Realtime] 更新后的编辑锁列表，数量: ${locks.size}`, Array.from(locks.entries()).map(([cardId, info]) => ({ cardId, ...info })));
          callback(locks);
        } catch (error) {
          console.error('[Realtime] 获取编辑锁列表异常:', error);
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};

