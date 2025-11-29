/**
 * Realtime 订阅管理
 * 处理 Supabase Realtime 订阅，实时同步数据
 */

import supabase from './supabase';
import { getOnlineCount, getTotalVisits, getTodayVisits, getActiveCursors, getActiveEditLocks, getVisitorByUid, loadCards } from './db';
import type { Cursor, EditLock } from './db';
import type { CanvasItemData } from '../types';

// 编辑锁信息类型
export interface EditLockInfo {
  visitor_uid: string;
  uname: string | null;
  locked_at: string;
}

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
  fetchLocksWithNames()
    .then((locks) => {
      callback(locks);
    })
    .catch((error) => {
      console.error('Error getting initial edit locks:', error);
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
        try {
          const locks = await fetchLocksWithNames();
          callback(locks);
        } catch (error) {
          console.error('Error getting edit locks:', error);
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
 * 订阅卡片变化
 * @param callback 当卡片变化时调用的回调函数，参数为卡片数组
 * @returns 取消订阅的函数
 */
export const subscribeCards = (
  callback: (cards: CanvasItemData[]) => void
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
      async () => {
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

