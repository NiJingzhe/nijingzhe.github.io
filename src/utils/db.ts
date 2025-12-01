import supabase from './supabase';
import type { CanvasItemData, DrawPath } from '../types';
import type { GitHubCardData } from '../components/GitHubCard';
import { FileText, Github, Image as ImageIcon } from 'lucide-react';

// 类型定义
export interface Visitor {
  id: string;
  uid: string;
  uname: string | null;
  first_seen_at: string;
  last_seen_at: string;
  visit_count: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  visitor_uid: string;
  last_heartbeat: string;
  created_at: string;
}

export interface Visit {
  id: string;
  visitor_uid: string;
  session_id: string | null;
  visited_at: string;
  user_agent: string | null;
  referrer: string | null;
}

export interface Cursor {
  id: string;
  visitor_uid: string;
  session_id: string | null;
  x: number;
  y: number;
  canvas_x: number | null;
  canvas_y: number | null;
  canvas_scale: number;
  updated_at: string;
}

export interface EditLock {
  id: string;
  card_id: string;
  visitor_uid: string;
  session_id: string | null;
  locked_at: string;
  expires_at: string;
  created_at: string;
}

// 检查数据库中是否存在任何卡片
export const hasAnyCards = async (): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error checking cards:', error);
      return false;
    }

    return (count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking cards:', error);
    return false;
  }
};

// 从 markdown 内容中提取第一个 H1 作为 title
const extractH1Title = (content: string): string => {
  const h1Match = content.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : '';
};

// 将点数组转换为 SVG path 字符串
const pointsToPath = (points: Array<{ x: number; y: number }>): string => {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  }
  return `M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`;
};

// 将 SVG path 字符串转换为点数组
const pathToPoints = (pathSvg: string): Array<{ x: number; y: number }> => {
  const points: Array<{ x: number; y: number }> = [];
  
  // 移除所有空格和换行，然后按命令分割
  const normalized = pathSvg.trim().replace(/\s+/g, ' ');
  
  // 匹配 M (MoveTo) 和 L (LineTo) 命令
  const commands = normalized.match(/[ML]\s+[\d.\-]+\s+[\d.\-]+/g);
  
  if (!commands) {
    return points;
  }
  
  for (const command of commands) {
    const parts = command.trim().split(/\s+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }
  }
  
  return points;
};

// 加载所有卡片
export const loadCards = async (): Promise<CanvasItemData[]> => {
  try {
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error loading cards:', cardsError);
      return [];
    }

    if (!cardsData || cardsData.length === 0) {
      return [];
    }

    // 转换为 CanvasItemData 格式，并过滤掉已删除的卡片（visible: false）
    const items: CanvasItemData[] = cardsData
      .filter(card => {
        const data = card.data || {};
        return data.visible !== false; // 只保留可见的卡片
      })
      .map(card => {
        const data = card.data || {};
        let content: string | GitHubCardData;
        let title = (data.title as string) || '';

        if (card.type === 'article') {
          // article 类型：从 data 字段获取内容
          content = (data.content as string) || '';
          title = title || extractH1Title(content);
        } else if (card.type === 'github') {
          // github 类型：从 data 字段获取
          content = (data as GitHubCardData) || {
            repo: '',
            url: '',
            language: '',
            stars: 0,
            forks: 0,
            description: ''
          };
          title = title || (content.repo ? content.repo.split('/').pop() || '' : 'GIT_REPO');
        } else if (card.type === 'image') {
          // image 类型：从 data 字段获取 URL
          content = (data.url as string) || '';
          title = title || 'IMAGE_VIEW';
        } else {
          content = '';
        }

        return {
          id: card.id,
          type: card.type as 'article' | 'image' | 'github',
          title,
          icon: card.type === 'github' ? Github : card.type === 'image' ? ImageIcon : FileText,
          x: card.position_x || 0,
          y: card.position_y || 0,
          width: card.width || 600,
          height: card.height || 400,
          content,
          visible: true, // 已经过滤过，所以这里都是可见的
          locked: card.locked === true // 从数据库的 locked 列读取
        };
      });

    return items;
  } catch (error) {
    console.error('Error loading cards:', error);
    return [];
  }
};

// 保存卡片
export const saveCard = async (card: CanvasItemData, sessionId?: string | null): Promise<void> => {
  try {
    // 准备 data jsonb 字段
    let data: Record<string, unknown> = {
      title: card.title,
      visible: card.visible !== false
    };
    
    if (card.type === 'article') {
      // article 类型：在 data 中存储内容
      data.content = card.content as string;
    } else if (card.type === 'github') {
      // github 类型：存储完整的 GitHubCardData
      data = {
        ...data,
        ...(card.content as GitHubCardData)
      };
    } else if (card.type === 'image') {
      // image 类型：存储 URL
      data.url = card.content as string;
    }

    // 保存卡片
    const { error: cardError } = await supabase
      .from('cards')
      .upsert({
        id: card.id,
        type: card.type,
        position_x: card.x,
        position_y: card.y,
        width: card.width,
        height: card.height,
        locked: card.locked === true, // 保存到数据库的 locked 列
        data,
        updated_by_session: sessionId || null, // 保存会话 ID
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (cardError) {
      console.error('Error saving card:', cardError);
      throw cardError;
    }
  } catch (error) {
    console.error('Error saving card:', error);
    throw error;
  }
};

// 删除卡片（软删除）
export const deleteCard = async (id: string): Promise<void> => {
  try {
    // 获取当前卡片数据
    const { data: cardData, error: fetchError } = await supabase
      .from('cards')
      .select('data')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching card:', fetchError);
      throw fetchError;
    }

    // 更新 data 字段，设置 visible 为 false
    const updatedData = {
      ...(cardData?.data || {}),
      visible: false
    };

    const { error } = await supabase
      .from('cards')
      .update({
        data: updatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting card:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting card:', error);
    throw error;
  }
};

// 加载所有涂鸦
export const loadDrawings = async (): Promise<DrawPath[]> => {
  try {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading drawings:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 转换数据格式：将 SVG 路径字符串转换为 points 数组
    const drawings: DrawPath[] = data.map(drawing => {
      const points = pathToPoints(drawing.path_svg || '');
      return {
        id: drawing.id,
        points,
        color: drawing.color || '#00ffff',
        width: drawing.stroke_width || 3
      };
    });

    return drawings;
  } catch (error) {
    console.error('Error loading drawings:', error);
    return [];
  }
};

// 保存单个涂鸦，返回数据库生成的 id
export const saveDrawing = async (drawing: DrawPath): Promise<string | null> => {
  try {
    // 将 points 数组转换为 SVG 路径字符串
    const pathSvg = pointsToPath(drawing.points);

    const { data, error } = await supabase
      .from('drawings')
      .insert({
        path_svg: pathSvg,
        color: drawing.color,
        stroke_width: drawing.width
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving drawing:', error);
      throw error;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('Error saving drawing:', error);
    throw error;
  }
};

// 删除涂鸦
export const deleteDrawing = async (id: string | number): Promise<void> => {
  try {
    // drawings 表的 id 是 uuid (string)
    if (typeof id !== 'string') {
      // 如果不是 string，说明可能是旧的 number id，直接返回
      return;
    }

    const { error } = await supabase
      .from('drawings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting drawing:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting drawing:', error);
    throw error;
  }
};

// ============================================
// 访问者管理 (Visitors)
// ============================================

// 创建或更新访问者
export const upsertVisitor = async (uid: string, uname?: string | null): Promise<Visitor | null> => {
  try {
    const { data, error } = await supabase.rpc('upsert_visitor', {
      p_uid: uid,
      p_uname: uname || null
    });

    if (error) {
      console.error('Error upserting visitor:', error);
      throw error;
    }

    // 如果使用 RPC 返回的是 UUID，需要查询完整记录
    if (data) {
      const { data: visitor, error: fetchError } = await supabase
        .from('visitors')
        .select('*')
        .eq('uid', uid)
        .single();

      if (fetchError) {
        console.error('Error fetching visitor:', fetchError);
        return null;
      }

      return visitor as Visitor;
    }

    return null;
  } catch (error) {
    console.error('Error upserting visitor:', error);
    throw error;
  }
};

// 根据 uid 获取访问者
export const getVisitorByUid = async (uid: string): Promise<Visitor | null> => {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 未找到记录
        return null;
      }
      console.error('Error getting visitor:', error);
      throw error;
    }

    return data as Visitor;
  } catch (error) {
    console.error('Error getting visitor:', error);
    return null;
  }
};

// 更新访问者名称
export const updateVisitorName = async (uid: string, uname: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('visitors')
      .update({ uname, updated_at: new Date().toISOString() })
      .eq('uid', uid);

    if (error) {
      console.error('Error updating visitor name:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error updating visitor name:', error);
    throw error;
  }
};

// 检查用户名是否已存在
export const checkUnameExists = async (uname: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('id')
      .eq('uname', uname)
      .limit(1);

    if (error) {
      console.error('Error checking uname:', error);
      throw error;
    }

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('Error checking uname:', error);
    throw error;
  }
};

// ============================================
// 会话管理 (Sessions)
// ============================================

// 创建或更新会话（心跳）
export const upsertSession = async (visitorUid: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('upsert_session', {
      p_visitor_uid: visitorUid
    });

    if (error) {
      console.error('Error upserting session:', error);
      throw error;
    }

    return data as string | null;
  } catch (error) {
    console.error('Error upserting session:', error);
    throw error;
  }
};

// 获取在线人数
export const getOnlineCount = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_online_count');

    if (error) {
      console.error('Error getting online count:', error);
      return 0;
    }

    return (data as number) || 0;
  } catch (error) {
    console.error('Error getting online count:', error);
    return 0;
  }
};

// 获取所有在线会话
export const getOnlineSessions = async (): Promise<Session[]> => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .gt('last_heartbeat', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .order('last_heartbeat', { ascending: false });

    if (error) {
      console.error('Error getting online sessions:', error);
      return [];
    }

    return (data as Session[]) || [];
  } catch (error) {
    console.error('Error getting online sessions:', error);
    return [];
  }
};

// ============================================
// 访问记录 (Visits)
// ============================================

// 获取用户最后一次访问时间
export const getLastVisitTime = async (visitorUid: string): Promise<Date | null> => {
  try {
    const { data, error } = await supabase
      .from('visits')
      .select('visited_at')
      .eq('visitor_uid', visitorUid)
      .order('visited_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 未找到记录
        return null;
      }
      console.error('Error getting last visit time:', error);
      return null;
    }

    return data?.visited_at ? new Date(data.visited_at) : null;
  } catch (error) {
    console.error('Error getting last visit time:', error);
    return null;
  }
};

// 获取用户最后一次访问记录（包括 ID）
export const getLastVisit = async (visitorUid: string): Promise<{ id: string; visited_at: Date } | null> => {
  try {
    const { data, error } = await supabase
      .from('visits')
      .select('id, visited_at')
      .eq('visitor_uid', visitorUid)
      .order('visited_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 未找到记录
        return null;
      }
      console.error('Error getting last visit:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      visited_at: new Date(data.visited_at)
    };
  } catch (error) {
    console.error('Error getting last visit:', error);
    return null;
  }
};

// 记录访问（带时间检查，1小时内更新最后访问时间，超过1小时创建新记录）
export const recordVisit = async (
  visitorUid: string,
  sessionId: string | null,
  userAgent?: string,
  referrer?: string
): Promise<string | null> => {
  try {
    // 检查上次访问记录
    const lastVisit = await getLastVisit(visitorUid);
    const now = new Date();
    
    if (lastVisit) {
      // 计算时间差（毫秒）
      const timeDiff = now.getTime() - lastVisit.visited_at.getTime();
      const oneHourInMs = 60 * 60 * 1000; // 1小时 = 3600000 毫秒
      
      if (timeDiff < oneHourInMs) {
        // 距离上次访问不到1小时，更新最后一次访问记录的时间
        const { error } = await supabase
          .from('visits')
          .update({ visited_at: now.toISOString() })
          .eq('id', lastVisit.id);

        if (error) {
          console.error('Error updating last visit time:', error);
          throw error;
        }

        return lastVisit.id;
      }
    }

    // 距离上次访问超过1小时，或没有访问记录，创建新访问记录
    const { data, error } = await supabase
      .from('visits')
      .insert({
        visitor_uid: visitorUid,
        session_id: sessionId,
        user_agent: userAgent || null,
        referrer: referrer || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error recording visit:', error);
      throw error;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('Error recording visit:', error);
    throw error;
  }
};

// 获取总访问量
export const getTotalVisits = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_total_visits');

    if (error) {
      console.error('Error getting total visits:', error);
      return 0;
    }

    return (data as number) || 0;
  } catch (error) {
    console.error('Error getting total visits:', error);
    return 0;
  }
};

// 获取今日访问量
export const getTodayVisits = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_today_visits');

    if (error) {
      console.error('Error getting today visits:', error);
      return 0;
    }

    return (data as number) || 0;
  } catch (error) {
    console.error('Error getting today visits:', error);
    return 0;
  }
};

// ============================================
// 光标位置 (Cursors)
// ============================================

// 更新光标位置
export const upsertCursor = async (
  visitorUid: string,
  sessionId: string | null,
  x: number,
  y: number,
  canvasX?: number,
  canvasY?: number,
  canvasScale: number = 1
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('upsert_cursor', {
      p_visitor_uid: visitorUid,
      p_session_id: sessionId,
      p_x: x,
      p_y: y,
      p_canvas_x: canvasX || null,
      p_canvas_y: canvasY || null,
      p_canvas_scale: canvasScale
    });

    if (error) {
      console.error('Error upserting cursor:', error);
      throw error;
    }

    return data as string | null;
  } catch (error) {
    console.error('Error upserting cursor:', error);
    throw error;
  }
};

// 获取所有活跃光标（5 分钟内更新过）
export const getActiveCursors = async (): Promise<Cursor[]> => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('cursors')
      .select('*')
      .gt('updated_at', fiveMinutesAgo)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error getting active cursors:', error);
      return [];
    }

    return (data as Cursor[]) || [];
  } catch (error) {
    console.error('Error getting active cursors:', error);
    return [];
  }
};

// 删除光标（用户离线时）
export const deleteCursor = async (visitorUid: string, sessionId: string | null): Promise<void> => {
  try {
    const { error } = await supabase
      .from('cursors')
      .delete()
      .eq('visitor_uid', visitorUid)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error deleting cursor:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting cursor:', error);
    throw error;
  }
};

// ============================================
// 编辑锁 (Edit Locks)
// ============================================

// 获取编辑锁
export const acquireEditLock = async (
  cardId: string,
  visitorUid: string,
  sessionId: string | null,
  lockDurationMinutes: number = 10
): Promise<string> => {
  // console.log(`[Lock DB] RPC调用 acquire_edit_lock - cardId: ${cardId}, visitorUid: ${visitorUid}, sessionId: ${sessionId}, duration: ${lockDurationMinutes}分钟`);
  try {
    const { data, error } = await supabase.rpc('acquire_edit_lock', {
      p_card_id: cardId,
      p_visitor_uid: visitorUid,
      p_session_id: sessionId,
      p_lock_duration_minutes: lockDurationMinutes
    });

    if (error) {
      console.error(`[Lock DB] RPC acquire_edit_lock 错误 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
      throw error;
    }

    const lockId = data as string;
    // console.log(`[Lock DB] RPC acquire_edit_lock 返回 - cardId: ${cardId}, visitorUid: ${visitorUid}, lockId: ${lockId || 'null'}`);
    return lockId;
  } catch (error) {
    console.error(`[Lock DB] RPC acquire_edit_lock 异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    throw error;
  }
};

// 释放编辑锁
export const releaseEditLock = async (cardId: string, visitorUid: string): Promise<boolean> => {
  // console.log(`[Lock DB] RPC调用 release_edit_lock - cardId: ${cardId}, visitorUid: ${visitorUid}`);
  try {
    const { data, error } = await supabase.rpc('release_edit_lock', {
      p_card_id: cardId,
      p_visitor_uid: visitorUid
    });

    if (error) {
      console.error(`[Lock DB] RPC release_edit_lock 错误 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
      throw error;
    }

    const result = (data as boolean) || false;
    // console.log(`[Lock DB] RPC release_edit_lock 返回 - cardId: ${cardId}, visitorUid: ${visitorUid}, result: ${result}`);
    return result;
  } catch (error) {
    console.error(`[Lock DB] RPC release_edit_lock 异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    throw error;
  }
};

// 获取卡片的编辑锁信息
export const getEditLock = async (cardId: string): Promise<EditLock | null> => {
  const now = new Date().toISOString();
  // console.log(`[Lock DB] 查询编辑锁 - cardId: ${cardId}, expiresAt > ${now}`);
  try {
    const { data, error } = await supabase
      .from('edit_locks')
      .select('*')
      .eq('card_id', cardId)
      .gt('expires_at', now)
      .limit(1)
      .maybeSingle();

    if (error) {
      // 406 错误可能是因为表不存在或权限问题，但不应该抛出
      if (error.code === 'PGRST116' || error.code === 'PGRST301' || error.status === 406) {
        // 未找到记录或表不存在
        console.warn(`[Lock DB] 编辑锁未找到或表不可访问 - cardId: ${cardId}:`, error.message);
        return null;
      }
      console.error(`[Lock DB] 查询编辑锁错误 - cardId: ${cardId}:`, error);
      // 对于其他错误，也返回 null 而不是抛出，避免阻塞用户操作
      return null;
    }

    if (data) {
      // console.log(`[Lock DB] 找到编辑锁 - cardId: ${cardId}, lockId: ${data.id}, owner: ${data.visitor_uid}, sessionId: ${data.session_id}, lockedAt: ${data.locked_at}, expiresAt: ${data.expires_at}`);
    } else {
      // console.log(`[Lock DB] 未找到编辑锁 - cardId: ${cardId}`);
    }

    return data as EditLock | null;
  } catch (error) {
    console.error(`[Lock DB] 查询编辑锁异常 - cardId: ${cardId}:`, error);
    return null;
  }
};

// 获取所有活跃的编辑锁
export const getActiveEditLocks = async (): Promise<EditLock[]> => {
  try {
    const { data, error } = await supabase
      .from('edit_locks')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('locked_at', { ascending: false });

    if (error) {
      // 406 错误可能是因为表不存在或权限问题
      if (error.status === 406) {
        console.warn('Edit locks table not accessible:', error.message);
        return [];
      }
      console.error('Error getting active edit locks:', error);
      return [];
    }

    return (data as EditLock[]) || [];
  } catch (error) {
    console.error('Error getting active edit locks:', error);
    return [];
  }
};

// 检查卡片是否被锁定
export const isCardLocked = async (cardId: string): Promise<boolean> => {
  try {
    const lock = await getEditLock(cardId);
    return lock !== null;
  } catch (error) {
    console.error('Error checking card lock:', error);
    return false;
  }
};

// 检查卡片是否被特定用户锁定
export const isCardLockedByUser = async (cardId: string, visitorUid: string): Promise<boolean> => {
  // console.log(`[Lock DB] 检查卡片是否被特定用户锁定 - cardId: ${cardId}, visitorUid: ${visitorUid}`);
  try {
    const lock = await getEditLock(cardId);
    const isLocked = lock !== null && lock.visitor_uid === visitorUid;
    if (lock) {
      // console.log(`[Lock DB] 锁所有权检查 - cardId: ${cardId}, lockOwner: ${lock.visitor_uid}, checkUser: ${visitorUid}, match: ${lock.visitor_uid === visitorUid}, isLocked: ${isLocked}`);
    } else {
      // console.log(`[Lock DB] 锁不存在 - cardId: ${cardId}, isLocked: ${isLocked}`);
    }
    return isLocked;
  } catch (error) {
    console.error(`[Lock DB] 检查卡片锁定状态异常 - cardId: ${cardId}, visitorUid: ${visitorUid}:`, error);
    return false;
  }
};

// ============================================
// 数据清理 (Cleanup)
// ============================================

// 清理过期会话（超过 2 分钟未心跳）
export const cleanupExpiredSessions = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('cleanup_expired_sessions');

    if (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
};

// 清理过期光标（超过 5 分钟未更新）
export const cleanupExpiredCursors = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('cleanup_expired_cursors');

    if (error) {
      console.error('Error cleaning up expired cursors:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error cleaning up expired cursors:', error);
    throw error;
  }
};

// 清理过期编辑锁
export const cleanupExpiredEditLocks = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('cleanup_expired_edit_locks');

    if (error) {
      console.error('Error cleaning up expired edit locks:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error cleaning up expired edit locks:', error);
    throw error;
  }
};

// 清理软删除的卡片（删除 visible: false 且超过指定天数的卡片）
// 默认清理 30 天前软删除的卡片
// 注意：daysOld = 0 会立即清理所有软删除的卡片（用于测试）
export const cleanupSoftDeletedCards = async (daysOld: number = 30): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('cleanup_soft_deleted_cards', {
      days_old: daysOld
    });

    if (error) {
      console.error('Error cleaning up soft deleted cards:', error);
      throw error;
    }

    const deletedCount = data || 0;
    if (deletedCount > 0) {
      // console.log(`Cleaned up ${deletedCount} soft deleted card(s) (older than ${daysOld} days)`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up soft deleted cards:', error);
    throw error;
  }
};

// 综合清理函数（清理所有过期数据）
export const cleanupExpiredData = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('cleanup_expired_data');

    if (error) {
      console.error('Error cleaning up expired data:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error cleaning up expired data:', error);
    throw error;
  }
};
