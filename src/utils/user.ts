/**
 * 用户管理工具
 * 处理用户识别、初始化、心跳等操作
 */

import {
  upsertVisitor,
  upsertSession,
  recordVisit,
  getVisitorByUid,
  updateVisitorName,
  checkUnameExists
} from './db';
import { adjectives, nouns } from '../consts/default_name_words';

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
      
      // 4. 获取用户名称（如果有），如果没有则生成默认用户名
      // 处理 null 和空字符串的情况
      const rawUname = visitor?.uname;
      let userName = (rawUname && rawUname.trim()) || null;
      
      // 5. 创建/更新访问者记录（如果用户不存在，先创建记录）
      await upsertVisitor(uid, userName);
      
      // 6. 如果用户没有名称（null 或空字符串），生成默认用户名并更新
      if (!userName) {
        userName = await generateDefaultUserName();
        // 将生成的默认用户名写入数据库
        await updateVisitorName(uid, userName);
      }
      
      // 7. 创建或复用会话
      const sessionId = await upsertSession(uid);
      
      if (!sessionId) {
        throw new Error('Failed to create session');
      }
      
      // 8. 记录访问（recordVisit 内部会检查距离上次访问是否超过1小时）
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

/**
 * 生成默认用户名
 * 从形容词和名词列表中随机组合，检查是否重复
 * 最多重试5次，如果都重复则使用重复的名字
 */
export const generateDefaultUserName = async (): Promise<string> => {
  const maxRetries = 5;
  let lastGeneratedName = '';
  
  for (let i = 0; i < maxRetries; i++) {
    // 随机选择形容词和名词
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const uname = `${adjective}${noun}`;
    lastGeneratedName = uname;
    
    try {
      // 检查是否重复
      const exists = await checkUnameExists(uname);
      if (!exists) {
        return uname;
      }
    } catch (error) {
      console.error('Error checking uname existence:', error);
      // 如果检查出错，直接返回这个名字
      return uname;
    }
  }
  
  // 如果5次都重复，返回最后一次生成的名字
  return lastGeneratedName;
};

