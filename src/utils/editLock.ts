/**
 * 编辑锁管理工具
 * 提供编辑锁的获取、续期、释放和检查功能
 */

import {
  acquireEditLock,
  releaseEditLock,
  getEditLock,
  isCardLockedByUser,
  type EditLock
} from './db';

/**
 * 获取编辑锁
 * @param cardId 卡片 ID
 * @param visitorUid 访问者 UID
 * @param sessionId 会话 ID
 * @param lockDurationMinutes 锁持续时间（分钟），默认 10 分钟
 * @returns 是否成功获取锁
 */
export const acquireLock = async (
  cardId: string,
  visitorUid: string,
  sessionId: string | null,
  lockDurationMinutes: number = 10
): Promise<boolean> => {
  console.log(`[Lock] 尝试获取锁 - cardId: ${cardId}, visitorUid: ${visitorUid}, sessionId: ${sessionId}, duration: ${lockDurationMinutes}分钟`);
  try {
    const result = await acquireEditLock(cardId, visitorUid, sessionId, lockDurationMinutes);
    const success = result !== null && result !== '';
    console.log(`[Lock] 获取锁${success ? '成功' : '失败'} - cardId: ${cardId}, visitorUid: ${visitorUid}, lockId: ${result || 'null'}`);
    // acquireEditLock 返回锁 ID 字符串，如果成功则返回 true
    return success;
  } catch (error) {
    console.error(`[Lock] 获取锁异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    return false;
  }
};

/**
 * 续期编辑锁（通过重新获取实现）
 * @param cardId 卡片 ID
 * @param visitorUid 访问者 UID
 * @param sessionId 会话 ID
 * @param lockDurationMinutes 锁持续时间（分钟），默认 10 分钟
 * @returns 是否成功续期
 */
export const renewLock = async (
  cardId: string,
  visitorUid: string,
  sessionId: string | null,
  lockDurationMinutes: number = 10
): Promise<boolean> => {
  console.log(`[Lock] 尝试续期锁 - cardId: ${cardId}, visitorUid: ${visitorUid}, sessionId: ${sessionId}, duration: ${lockDurationMinutes}分钟`);
  try {
    // 续期就是重新获取锁，如果锁已被其他人持有，会失败
    const result = await acquireEditLock(cardId, visitorUid, sessionId, lockDurationMinutes);
    const success = result !== null && result !== '';
    console.log(`[Lock] 续期锁${success ? '成功' : '失败'} - cardId: ${cardId}, visitorUid: ${visitorUid}, lockId: ${result || 'null'}`);
    return success;
  } catch (error) {
    console.error(`[Lock] 续期锁异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    return false;
  }
};

/**
 * 释放编辑锁
 * @param cardId 卡片 ID
 * @param visitorUid 访问者 UID
 * @returns 是否成功释放
 */
export const releaseLock = async (
  cardId: string,
  visitorUid: string
): Promise<boolean> => {
  console.log(`[Lock] 尝试释放锁 - cardId: ${cardId}, visitorUid: ${visitorUid}`);
  try {
    const result = await releaseEditLock(cardId, visitorUid);
    console.log(`[Lock] 释放锁${result ? '成功' : '失败'} - cardId: ${cardId}, visitorUid: ${visitorUid}`);
    return result;
  } catch (error) {
    console.error(`[Lock] 释放锁异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    return false;
  }
};

/**
 * 检查锁是否被当前用户持有
 * @param cardId 卡片 ID
 * @param visitorUid 访问者 UID
 * @returns 是否被当前用户持有
 */
export const isLockHeldByCurrentUser = async (
  cardId: string,
  visitorUid: string
): Promise<boolean> => {
  console.log(`[Lock] 检查锁所有权 - cardId: ${cardId}, visitorUid: ${visitorUid}`);
  try {
    const result = await isCardLockedByUser(cardId, visitorUid);
    console.log(`[Lock] 锁所有权检查结果 - cardId: ${cardId}, visitorUid: ${visitorUid}, isHeld: ${result}`);
    return result;
  } catch (error) {
    console.error(`[Lock] 检查锁所有权异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    return false;
  }
};

/**
 * 检查卡片是否被锁定（被任何人）
 * @param cardId 卡片 ID
 * @returns 是否被锁定
 */
export const isCardLocked = async (cardId: string): Promise<boolean> => {
  console.log(`[Lock] 检查卡片是否被锁定 - cardId: ${cardId}`);
  try {
    const lock = await getEditLock(cardId);
    const isLocked = lock !== null;
    if (isLocked) {
      console.log(`[Lock] 卡片已被锁定 - cardId: ${cardId}, lockOwner: ${lock.visitor_uid}, lockedAt: ${lock.locked_at}, expiresAt: ${lock.expires_at}`);
    } else {
      console.log(`[Lock] 卡片未被锁定 - cardId: ${cardId}`);
    }
    return isLocked;
  } catch (error) {
    console.error(`[Lock] 检查卡片锁定状态异常 - cardId: ${cardId}:`, error);
    return false;
  }
};

/**
 * 获取卡片的编辑锁信息
 * @param cardId 卡片 ID
 * @returns 编辑锁信息，如果不存在则返回 null
 */
export const getLockInfo = async (cardId: string): Promise<EditLock | null> => {
  console.log(`[Lock] 获取锁信息 - cardId: ${cardId}`);
  try {
    const lock = await getEditLock(cardId);
    if (lock) {
      console.log(`[Lock] 锁信息 - cardId: ${cardId}, lockId: ${lock.id}, owner: ${lock.visitor_uid}, sessionId: ${lock.session_id}, lockedAt: ${lock.locked_at}, expiresAt: ${lock.expires_at}`);
    } else {
      console.log(`[Lock] 未找到锁信息 - cardId: ${cardId}`);
    }
    return lock;
  } catch (error) {
    console.error(`[Lock] 获取锁信息异常 - cardId: ${cardId}:`, error);
    return null;
  }
};

