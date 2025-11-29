/**
 * 用户管理工具
 * 处理用户识别、初始化、心跳等操作
 */

import {
  upsertVisitor,
  upsertSession,
  recordVisit,
  getVisitorByUid,
  updateVisitorName
} from './db';

const USER_ID_KEY = 'personal_page_user_id';

/**
 * 获取或创建用户 UUID
 * 先检查 localStorage 中是否已有 uid，如果没有则生成新的 UUID
 */
export const getOrCreateUserId = (): string => {
  // 先检查 localStorage 中是否已有 uid
  const existingUid = localStorage.getItem(USER_ID_KEY);
  
  if (existingUid) {
    // 验证 UUID 格式（基本格式检查）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(existingUid)) {
      return existingUid;
    } else {
      // 如果格式不正确，清除并重新生成
      console.warn('Invalid UUID format in localStorage, generating new one');
      localStorage.removeItem(USER_ID_KEY);
    }
  }
  
  // localStorage 中没有 uid 或格式不正确，生成新的 UUID
  const newUid = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, newUid);
  return newUid;
};

// 防止重复初始化的标志（模块级别）
let isInitializing = false;
let initializationPromise: Promise<{ uid: string; sessionId: string; userName: string | null }> | null = null;

/**
 * 初始化用户
 * 创建/更新访问者记录、创建会话、记录访问
 * 使用单例模式防止重复初始化
 */
export const initializeUser = async (): Promise<{ uid: string; sessionId: string; userName: string | null }> => {
  // 如果正在初始化，返回同一个 Promise
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    try {
      // 1. 先检查 localStorage 中是否有 UUID
      let uid = getOrCreateUserId();
      
      // 2. 检查数据库中是否存在这个用户
      let visitor = await getVisitorByUid(uid);
      
      // 3. 如果数据库中没有这个用户，生成新的 UUID 并清除旧的
      if (!visitor) {
        console.log('User not found in database, creating new user');
        // 清除 localStorage 中的旧 UUID
        localStorage.removeItem(USER_ID_KEY);
        // 生成新的 UUID
        uid = crypto.randomUUID();
        localStorage.setItem(USER_ID_KEY, uid);
        visitor = null; // 确保 visitor 为 null，后续会创建新用户
      }
      
      // 4. 获取用户名称（如果有）
      const userName = visitor?.uname || null;
      
      // 5. 创建/更新访问者记录
      await upsertVisitor(uid, userName);
      
      // 6. 创建或复用会话
      const sessionId = await upsertSession(uid);
      
      if (!sessionId) {
        throw new Error('Failed to create session');
      }
      
      // 7. 记录访问（recordVisit 内部会检查距离上次访问是否超过1小时）
      await recordVisit(
        uid,
        sessionId,
        navigator.userAgent || undefined,
        document.referrer || undefined
      );
      
      return { uid, sessionId, userName };
    } catch (error) {
      console.error('Error initializing user:', error);
      throw error;
    } finally {
      isInitializing = false;
      // 延迟清除 Promise，防止快速连续调用
      setTimeout(() => {
        initializationPromise = null;
      }, 1000);
    }
  })();

  return initializationPromise;
};

/**
 * 更新会话心跳
 * 每 30 秒调用一次，保持会话活跃
 */
export const updateSessionHeartbeat = async (visitorUid: string): Promise<string | null> => {
  try {
    const sessionId = await upsertSession(visitorUid);
    return sessionId;
  } catch (error) {
    console.error('Error updating session heartbeat:', error);
    return null;
  }
};

/**
 * 设置用户名称
 */
export const setUserName = async (uid: string, uname: string): Promise<void> => {
  try {
    // 验证 uname
    if (!uname || uname.trim().length === 0) {
      throw new Error('User name cannot be empty');
    }
    
    if (uname.length > 20) {
      throw new Error('User name must be 20 characters or less');
    }
    
    // 更新访问者名称
    await updateVisitorName(uid, uname.trim());
  } catch (error) {
    console.error('Error setting user name:', error);
    throw error;
  }
};

/**
 * 获取用户名称
 */
export const getUserName = async (uid: string): Promise<string | null> => {
  try {
    const visitor = await getVisitorByUid(uid);
    return visitor?.uname || null;
  } catch (error) {
    console.error('Error getting user name:', error);
    return null;
  }
};

