/**
 * 绘制路径 Realtime 广播
 * 使用 Supabase Broadcast 实现正在绘制路径的实时同步
 * 
 * 与其他 realtime 订阅不同，这里不使用 postgres_changes，
 * 因为正在绘制的路径是临时数据，不需要持久化存储。
 */

import supabase from '../supabase';

// 正在绘制的路径信息类型
export interface RemoteDrawingPath {
  visitorUid: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  isDrawing: boolean;
}

// Broadcast 消息类型
interface DrawingPathBroadcastPayload {
  type: 'drawing_update' | 'drawing_end' | 'erase';
  visitorUid: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  // 橡皮擦相关
  erasePathIds?: (number | string)[];
}

// 订阅回调类型
type DrawingPathCallback = (paths: Map<string, RemoteDrawingPath>) => void;

// 存储当前活跃的远程绘制路径
let remoteDrawingPaths = new Map<string, RemoteDrawingPath>();
let broadcastChannel: ReturnType<typeof supabase.channel> | null = null;
let callbacks: DrawingPathCallback[] = [];
let currentVisitorUid: string | null = null;
// 存储每个用户最后更新时间，用于自动清理
let lastUpdateTimes = new Map<string, number>();
// 自动清理定时器
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
// 广播节流
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 16; // 约60fps，提供流畅的实时体验

// 通知所有回调
const notifyCallbacks = () => {
  const pathsCopy = new Map(remoteDrawingPaths);
  callbacks.forEach(callback => callback(pathsCopy));
};

/**
 * 初始化绘制路径广播通道
 * @param visitorUid 当前用户的 UID，用于过滤自己的绘制
 * @returns 清理函数
 */
export const initDrawingPathBroadcast = (visitorUid: string): (() => void) => {
  currentVisitorUid = visitorUid;
  
  // 如果已经有通道，先清理
  if (broadcastChannel) {
    broadcastChannel.unsubscribe();
  }
  
  // 启动自动清理定时器：每秒检查一次，清理 2 秒未更新的临时路径
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const timeout = 2000; // 2 秒超时
    let hasChanges = false;
    
    lastUpdateTimes.forEach((lastTime, uid) => {
      if (now - lastTime > timeout && remoteDrawingPaths.has(uid)) {
        remoteDrawingPaths.delete(uid);
        lastUpdateTimes.delete(uid);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      notifyCallbacks();
    }
  }, 1000);

  // 创建 Broadcast 通道
  broadcastChannel = supabase.channel('drawing-paths-broadcast', {
    config: {
      broadcast: {
        // 不要接收自己发送的消息
        self: false
      }
    }
  });

  // 监听绘制路径更新
  broadcastChannel
    .on('broadcast', { event: 'drawing_path' }, (payload) => {
      const data = payload.payload as DrawingPathBroadcastPayload;
      
      // 过滤自己的消息（虽然 self: false 应该已经处理了，但多一层保险）
      if (data.visitorUid === currentVisitorUid) {
        return;
      }

      if (data.type === 'drawing_update') {
        // 更新或添加远程绘制路径
        remoteDrawingPaths.set(data.visitorUid, {
          visitorUid: data.visitorUid,
          points: data.points,
          color: data.color,
          width: data.width,
          isDrawing: true
        });
        // 记录更新时间
        lastUpdateTimes.set(data.visitorUid, Date.now());
        notifyCallbacks();
      } else if (data.type === 'drawing_end') {
        // 移除已完成的绘制路径
        remoteDrawingPaths.delete(data.visitorUid);
        notifyCallbacks();
      } else if (data.type === 'erase') {
        // 橡皮擦操作不需要处理远程绘制路径
        // 删除操作会通过数据库的 realtime 同步
        // 这里只是一个占位，以便将来扩展
      }
    })
    .subscribe();

  // 返回清理函数
  return () => {
    if (broadcastChannel) {
      broadcastChannel.unsubscribe();
      broadcastChannel = null;
    }
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    remoteDrawingPaths.clear();
    lastUpdateTimes.clear();
    callbacks = [];
    currentVisitorUid = null;
  };
};

/**
 * 广播当前正在绘制的路径
 * @param points 路径点数组
 * @param color 画笔颜色
 * @param width 画笔宽度
 */
export const broadcastDrawingPath = (
  points: Array<{ x: number; y: number }>,
  color: string,
  width: number
): void => {
  if (!broadcastChannel || !currentVisitorUid) {
    return;
  }

  // 节流：限制广播频率为约60fps，平衡实时性和网络负载
  const now = Date.now();
  if (now - lastBroadcastTime < BROADCAST_THROTTLE_MS) {
    return;
  }
  lastBroadcastTime = now;

  // 点采样：如果点太多，进行轻量采样以减少数据量
  // 保留最近的点以确保实时性，对历史点进行采样
  let sampledPoints = points;
  if (points.length > 50) {
    // 保留最后20个点（最新的轨迹），对之前的点每3个取1个
    const recentPoints = points.slice(-20);
    const olderPoints = points.slice(0, -20);
    const sampledOlder = olderPoints.filter((_, index) => index % 3 === 0);
    sampledPoints = [...sampledOlder, ...recentPoints];
  }

  const payload: DrawingPathBroadcastPayload = {
    type: 'drawing_update',
    visitorUid: currentVisitorUid,
    points: sampledPoints,
    color,
    width
  };

  broadcastChannel.send({
    type: 'broadcast',
    event: 'drawing_path',
    payload
  });
};

/**
 * 广播绘制结束
 */
export const broadcastDrawingEnd = (): void => {
  if (!broadcastChannel || !currentVisitorUid) {
    return;
  }

  const payload: DrawingPathBroadcastPayload = {
    type: 'drawing_end',
    visitorUid: currentVisitorUid,
    points: [],
    color: '',
    width: 0
  };

  broadcastChannel.send({
    type: 'broadcast',
    event: 'drawing_path',
    payload
  });
};

/**
 * 广播橡皮擦操作（实际上橡皮擦通过数据库同步，这里只是为了立即响应）
 * @param pathIds 被删除的路径 ID 数组
 */
export const broadcastErase = (pathIds: (number | string)[]): void => {
  if (!broadcastChannel || !currentVisitorUid || pathIds.length === 0) {
    return;
  }

  const payload: DrawingPathBroadcastPayload = {
    type: 'erase',
    visitorUid: currentVisitorUid,
    points: [],
    color: '',
    width: 0,
    erasePathIds: pathIds
  };

  broadcastChannel.send({
    type: 'broadcast',
    event: 'drawing_path',
    payload
  });
};

/**
 * 订阅远程绘制路径变化
 * @param callback 当远程绘制路径变化时调用
 * @returns 取消订阅的函数
 */
export const subscribeRemoteDrawingPaths = (
  callback: DrawingPathCallback
): (() => void) => {
  callbacks.push(callback);
  
  // 立即调用一次，提供当前状态
  callback(new Map(remoteDrawingPaths));

  // 返回取消订阅函数
  return () => {
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  };
};
