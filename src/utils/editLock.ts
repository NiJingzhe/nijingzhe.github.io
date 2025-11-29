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
  try {
    const result = await acquireEditLock(cardId, visitorUid, sessionId, lockDurationMinutes);
    // acquireEditLock 返回锁 ID 字符串，如果成功则返回 true
    return result !== null && result !== '';
  } catch (error) {
    console.error('Error acquiring lock:', error);
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
  try {
    // 续期就是重新获取锁，如果锁已被其他人持有，会失败
    const result = await acquireEditLock(cardId, visitorUid, sessionId, lockDurationMinutes);
    return result !== null && result !== '';
  } catch (error) {
    console.error('Error renewing lock:', error);
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
  try {
    return await releaseEditLock(cardId, visitorUid);
  } catch (error) {
    console.error('Error releasing lock:', error);
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
  try {
    return await isCardLockedByUser(cardId, visitorUid);
  } catch (error) {
    console.error('Error checking lock ownership:', error);
    return false;
  }
};

/**
 * 检查卡片是否被锁定（被任何人）
 * @param cardId 卡片 ID
 * @returns 是否被锁定
 */
export const isCardLocked = async (cardId: string): Promise<boolean> => {
  try {
    const lock = await getEditLock(cardId);
    return lock !== null;
  } catch (error) {
    console.error('Error checking if card is locked:', error);
    return false;
  }
};

/**
 * 获取卡片的编辑锁信息
 * @param cardId 卡片 ID
 * @returns 编辑锁信息，如果不存在则返回 null
 */
export const getLockInfo = async (cardId: string): Promise<EditLock | null> => {
  try {
    return await getEditLock(cardId);
  } catch (error) {
    console.error('Error getting lock info:', error);
    return null;
  }
};

