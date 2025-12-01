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

// 编辑锁数据库记录类型
interface EditLockRecord {
  id: string;
  card_id: string;
  visitor_uid: string;
  session_id: string | null;
  locked_at: string;
  expires_at: string;
}

/**
 * 订阅编辑锁变化
 * @param callback 当编辑锁变化时调用的回调函数，参数为编辑锁 Map（cardId -> EditLockInfo）
 * @returns 取消订阅的函数
 */
export const subscribeEditLocks = (
  callback: (locks: Map<string, EditLockInfo>) => void
): (() => void) => {
  // 维护当前锁状态
  let currentLocks = new Map<string, EditLockInfo>();
  // 维护 lockId -> cardId 的映射，用于 DELETE 事件
  const lockIdToCardId = new Map<string, string>();

  // 获取用户名并更新锁信息
  const updateLockWithName = async (
    cardId: string,
    visitorUid: string,
    lockedAt: string
  ): Promise<void> => {
    try {
      const visitor = await getVisitorByUid(visitorUid);
      const lockInfo: EditLockInfo = {
        visitor_uid: visitorUid,
        uname: visitor?.uname || null,
        locked_at: lockedAt
      };
      currentLocks.set(cardId, lockInfo);
      // 通知更新
      callback(new Map(currentLocks));
    } catch (error) {
      console.error(`Error getting visitor for lock ${cardId}:`, error);
      // 即使获取用户名失败，也添加锁信息
      const lockInfo: EditLockInfo = {
        visitor_uid: visitorUid,
        uname: null,
        locked_at: lockedAt
      };
      currentLocks.set(cardId, lockInfo);
      callback(new Map(currentLocks));
    }
  };

  // 获取所有活跃编辑锁并获取用户名
  const fetchLocksWithNames = async (): Promise<Map<string, EditLockInfo>> => {
    try {
      const locks = await getActiveEditLocks();
      const locksMap = new Map<string, EditLockInfo>();
      
      // 并行获取所有用户名
      await Promise.all(
        locks.map(async (lock) => {
          // 建立 lockId -> cardId 映射
          lockIdToCardId.set(lock.id, lock.card_id);
          
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

  // 处理增量更新
  const handleLockChange = async (payload: any): Promise<void> => {
    const now = new Date().toISOString();
    // Supabase Realtime 的 payload 结构：{ eventType: 'INSERT'|'UPDATE'|'DELETE', new: {...}, old: {...} }
    const eventType = payload.eventType || payload.type;
    const newRecord = payload.new as EditLockRecord | null | undefined;
    const oldRecord = payload.old as EditLockRecord | null | undefined;
    
    console.log(`[Realtime] 处理锁变化 - eventType: ${eventType}`, { newRecord, oldRecord });
    
    if (eventType === 'INSERT' && newRecord) {
      const lock = newRecord;
      // 检查锁是否过期
      if (lock.expires_at > now) {
        console.log(`[Realtime] 检测到新锁 - cardId: ${lock.card_id}, lockId: ${lock.id}, visitorUid: ${lock.visitor_uid}`);
        // 记录 lockId -> cardId 映射，用于 DELETE 事件
        lockIdToCardId.set(lock.id, lock.card_id);
        
        // 先快速更新锁状态（不包含用户名），立即通知
        const lockInfo: EditLockInfo = {
          visitor_uid: lock.visitor_uid,
          uname: null, // 先设为 null，异步获取
          locked_at: lock.locked_at
        };
        currentLocks.set(lock.card_id, lockInfo);
        callback(new Map(currentLocks));
        
        // 异步获取用户名并更新
        updateLockWithName(lock.card_id, lock.visitor_uid, lock.locked_at);
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      const lock = newRecord;
      // 检查锁是否过期
      if (lock.expires_at > now) {
        console.log(`[Realtime] 检测到锁更新 - cardId: ${lock.card_id}, lockId: ${lock.id}, visitorUid: ${lock.visitor_uid}`);
        // 更新 lockId -> cardId 映射
        lockIdToCardId.set(lock.id, lock.card_id);
        
        // 先快速更新锁状态
        const lockInfo: EditLockInfo = {
          visitor_uid: lock.visitor_uid,
          uname: currentLocks.get(lock.card_id)?.uname || null, // 保留现有用户名
          locked_at: lock.locked_at
        };
        currentLocks.set(lock.card_id, lockInfo);
        callback(new Map(currentLocks));
        
        // 如果用户名还没有，异步获取
        if (!lockInfo.uname) {
          updateLockWithName(lock.card_id, lock.visitor_uid, lock.locked_at);
        }
      } else {
        // 锁已过期，移除
        console.log(`[Realtime] 检测到锁过期 - cardId: ${lock.card_id}, lockId: ${lock.id}`);
        lockIdToCardId.delete(lock.id);
        currentLocks.delete(lock.card_id);
        callback(new Map(currentLocks));
      }
    } else if (eventType === 'DELETE') {
      // DELETE 事件：oldRecord 只包含主键 id，不包含 card_id
      // 需要通过 lockIdToCardId 映射来找到对应的 cardId
      let cardId: string | undefined;
      let lockId: string | undefined;
      
      if (oldRecord) {
        lockId = oldRecord.id;
        console.log('[Realtime] DELETE 事件 oldRecord 内容:', {
          lockId,
          hasCardId: !!oldRecord.card_id,
          keys: Object.keys(oldRecord),
          oldRecord
        });
        
        // 从映射中查找 cardId
        if (lockId) {
          cardId = lockIdToCardId.get(lockId);
          console.log(`[Realtime] 从映射中查找 cardId - lockId: ${lockId}, cardId: ${cardId}`);
        }
      }
      
      // 如果找到了 cardId，删除对应的锁
      if (cardId) {
        console.log(`[Realtime] 检测到锁删除 - cardId: ${cardId}, lockId: ${lockId}`);
        currentLocks.delete(cardId);
        if (lockId) {
          lockIdToCardId.delete(lockId);
        }
        callback(new Map(currentLocks));
      } else {
        console.warn('[Realtime] DELETE 事件无法找到对应的 cardId', {
          lockId,
          hasOldRecord: !!oldRecord,
          mappingSize: lockIdToCardId.size,
          currentLocksCount: currentLocks.size
        });
        // 无法确定哪个锁被删除，保持当前状态不变
        // 锁会自动过期，不影响功能
      }
    }
  };

  // 先获取一次当前编辑锁
  console.log('[Realtime] 订阅编辑锁变化，获取初始锁列表');
  fetchLocksWithNames()
    .then((locks) => {
      currentLocks = locks;
      console.log(`[Realtime] 获取到初始编辑锁列表，数量: ${locks.size}`, Array.from(locks.entries()).map(([cardId, info]) => ({ cardId, ...info })));
      callback(locks);
    })
    .catch((error) => {
      console.error('[Realtime] 获取初始编辑锁列表异常:', error);
      currentLocks = new Map();
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
      async (payload) => {
        // 使用事件 payload 进行增量更新
        console.log('[Realtime] 检测到编辑锁表变化', {
          eventType: payload.eventType || payload.type,
          hasNew: !!payload.new,
          hasOld: !!payload.old,
          newRecord: payload.new,
          oldRecord: payload.old
        });
        try {
          await handleLockChange(payload);
        } catch (error) {
          console.error('[Realtime] 处理编辑锁变化异常:', error);
          // 如果增量更新失败，回退到重新获取所有锁
          try {
            const locks = await fetchLocksWithNames();
            currentLocks = locks;
            callback(locks);
          } catch (fetchError) {
            console.error('[Realtime] 重新获取编辑锁列表异常:', fetchError);
          }
        }
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    channel.unsubscribe();
  };
};

