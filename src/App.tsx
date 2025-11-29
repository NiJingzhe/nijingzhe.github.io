import { useState, useEffect, useRef } from 'react';
import { FileText, Github, Image as ImageIcon } from 'lucide-react';
import { Canvas } from './components/Canvas';
import { Header } from './components/Header';
import { Dock } from './components/Dock';
import { StatusBar } from './components/StatusBar';
import { GitHubInputModal } from './components/GitHubInputModal';
import { ImageInputModal } from './components/ImageInputModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { UnlockConfirmModal } from './components/UnlockConfirmModal';
import { EditConflictModal } from './components/EditConflictModal';
import { fetchGitHubRepoInfo } from './utils/githubApi';
import { loadCards, saveCard, deleteCard, loadDrawings, saveDrawing, deleteDrawing, getTotalVisits, getTodayVisits, upsertCursor, getActiveCursors, getVisitorByUid, type Cursor } from './utils/db';
import { initializeUser, updateSessionHeartbeat, setUserName } from './utils/user';
import { subscribeOnlineCount, subscribeVisits, subscribeCursors, subscribeEditLocks, type EditLockInfo } from './utils/realtime';
import { acquireLock, renewLock, releaseLock, isLockHeldByCurrentUser, isCardLocked, getLockInfo } from './utils/editLock';
import { CursorManager } from './components/CursorManager';
import { cleanupOnAppStart } from './utils/cleanup';
import type { CanvasItemData, CanvasState, DrawPath, DrawMode, VimMode } from './types';
import type { GitHubCardData } from './components/GitHubCard';

// 从 markdown 内容中提取第一个 H1 作为 title
const extractH1Title = (content: string): string => {
  const h1Match = content.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : '';
};

// 生成随机颜色
const generateRandomColor = (): string => {
  const colors = [
    '#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff0000',
    '#0000ff', '#ff8800', '#8800ff', '#00ff88', '#ff0088',
    '#88ff00', '#0088ff', '#ff8888', '#88ff88', '#8888ff',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const App = () => {
  const [canvas, setCanvas] = useState<CanvasState>({ x: 0, y: 0, scale: 1 });
  const [modalType, setModalType] = useState<'github' | 'image' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [unlockConfirmId, setUnlockConfirmId] = useState<string | null>(null);
  const [conflictCardId, setConflictCardId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('off');
  const [drawColor, setDrawColor] = useState('#00ffff');
  const [drawWidth, setDrawWidth] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Vim mode states
  const [vimMode, setVimMode] = useState<VimMode>('normal');
  const [command, setCommand] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  
  // Undo/Redo for draw paths
  const [drawHistory, setDrawHistory] = useState<DrawPath[][]>([]);
  const [drawHistoryIndex, setDrawHistoryIndex] = useState(-1);
  const eraseHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用于跟踪 zi/zo 序列
  const keySequenceRef = useRef<string>('');
  const keySequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [items, setItems] = useState<CanvasItemData[]>([]);

  // 防抖保存定时器
  const saveCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDrawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 跟踪已保存到数据库的 drawing id（用于区分需要删除的 drawing）
  const savedDrawingIdsRef = useRef<Set<string>>(new Set());
  
  // 异步保存队列相关
  const pendingSaveQueueRef = useRef<Map<number | string, DrawPath>>(new Map());
  const isSavingRef = useRef(false);
  
  // 跟踪正在初始化的卡片 id，避免重复保存
  const initializingCardIdsRef = useRef<Set<string>>(new Set());

  // 用户相关状态
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserNameState] = useState<string | null>(null);

  // 统计信息状态
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [totalVisits, setTotalVisits] = useState<number>(0);
  const [todayVisits, setTodayVisits] = useState<number>(0);

  // 定时器引用
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visitsRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 防止重复初始化的标志
  const isInitializingRef = useRef(false);

  // 光标相关状态
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [userColors, setUserColors] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string | null>>(new Map());
  const cursorUpdateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCursorUpdateRef = useRef<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const canvasScaleRef = useRef<number>(canvas.scale);
  const cursorPositionRef = useRef<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);

  // 编辑锁相关状态
  const [editLocks, setEditLocks] = useState<Map<string, EditLockInfo>>(new Map());
  const currentEditLockRef = useRef<string | null>(null); // 当前编辑的卡片 ID
  const lockRenewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // 定期检查锁状态

  // 初始化加载数据
  useEffect(() => {
    let isMounted = true; // 防止组件卸载后继续执行
    
    const loadData = async () => {
      try {
        // 直接加载数据库中的卡片
        const loadedCards = await loadCards();
        
        // 如果数据库中有卡片，直接使用
        if (loadedCards.length > 0) {
          if (isMounted) {
            setItems(loadedCards);
          }
        } else {
          // 数据库为空，创建默认欢迎卡片
          const welcomeContent = `# LilDino$aur 的数字花园 

> "港口上方的天空是电视的颜色，调到了死频道。"

这是一个仿照 vim 操作逻辑的无限画布空间。你可以在这里自由地组织文章、图片和 GitHub 仓库卡片，通过键盘快捷键高效地操作。

## 操作说明

### Normal Mode (默认模式)

**导航**
- \`h\` \`j\` \`k\` \`l\` - 在卡片间导航（左/下/上/右）
- 方向键 - 微调选中卡片位置

**编辑与操作**
- \`i\` - 进入编辑模式（编辑当前卡片）
- \`d\` - 进入绘图模式（在画布上绘制）
- \`D\` - 删除当前卡片
- \`:\` - 进入命令模式

**视图控制**
- \`zi\` - 放大画布
- \`zo\` - 缩小画布
- 鼠标拖拽 - 平移画布
- 滚轮 - 缩放画布

### Edit Mode (编辑模式)
- \`ESC\` - 退出编辑模式，返回 Normal Mode

### Draw Mode (绘图模式)
- 鼠标拖拽 - 在画布上绘制
- \`ESC\` - 退出绘图模式，返回 Normal Mode

### Command Mode (命令模式)
- \`:na\` 或 \`:newarticle\` - 新建文章卡片
- \`:nr\` 或 \`:newrepo\` - 新建 GitHub 仓库卡片
- \`:ni\` 或 \`:newimage\` - 新建图片卡片
- \`:w\` 或 \`:save\` - 手动保存
- \`ESC\` - 取消命令，返回 Normal Mode`;
    
          const defaultCard: CanvasItemData = {
            id: crypto.randomUUID(),
            type: 'article',
            title: extractH1Title(welcomeContent),
            icon: FileText,
            x: 100,
            y: 100,
            width: 600,
            height: 500,
            content: welcomeContent
          };
          
          if (isMounted) {
            // 标记为正在初始化，避免 updateItem 触发重复保存
            initializingCardIdsRef.current.add(defaultCard.id);
            setItems([defaultCard]);
            // 保存默认卡片（只保存一次）
            await saveCard(defaultCard);
            // 初始化完成后移除标记
            initializingCardIdsRef.current.delete(defaultCard.id);
          }
        }
        
        // 加载涂鸦
        const loadedDrawings = await loadDrawings();
        if (isMounted) {
          setDrawPaths(loadedDrawings);
          // 记录所有从数据库加载的 drawing id
          loadedDrawings.forEach(drawing => {
            if (typeof drawing.id === 'string') {
              savedDrawingIdsRef.current.add(drawing.id);
            }
          });
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
    
    return () => {
      isMounted = false; // 组件卸载时标记
    };
  }, []);

  // 初始化用户和统计信息
  useEffect(() => {
    // 防止重复初始化（React StrictMode 会执行两次）
    if (isInitializingRef.current) {
      return;
    }
    isInitializingRef.current = true;

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;
    let unsubscribeVisits: (() => void) | null = null;
    let unsubscribeCursors: (() => void) | null = null;
    let unsubscribeEditLocks: (() => void) | null = null;

    const initUserAndStats = async () => {
      try {
        // 1. 初始化用户
        const { uid, sessionId: sid, userName: uname } = await initializeUser();
        
        // 总是更新状态（初始化时组件应该已挂载）
        setUserId(uid);
        setSessionId(sid);
        setUserNameState(uname);

        // 2. 启动心跳定时器（每 30 秒）
        if (sid) {
          heartbeatIntervalRef.current = setInterval(async () => {
            try {
              const newSessionId = await updateSessionHeartbeat(uid);
              if (isMounted && newSessionId) {
                setSessionId(newSessionId);
              }
            } catch (error) {
              console.error('Heartbeat failed:', error);
            }
          }, 30 * 1000);
        }

        // 3. 加载访问量统计（初始加载）
        const [total, today] = await Promise.all([
          getTotalVisits(),
          getTodayVisits()
        ]);
        
        setTotalVisits(total);
        setTodayVisits(today);

        // 4. 订阅在线人数变化
        unsubscribe = subscribeOnlineCount((count) => {
          setOnlineCount(count); // 直接更新，不检查 isMounted（因为回调可能在组件卸载后执行）
        });

        // 5. 订阅访问量变化
        unsubscribeVisits = subscribeVisits(({ total: newTotal, today: newToday }) => {
          setTotalVisits(newTotal);
          setTodayVisits(newToday);
        });

        // 5. 定期刷新访问量（每 5 分钟）
        visitsRefreshIntervalRef.current = setInterval(async () => {
          try {
            const [total, today] = await Promise.all([
              getTotalVisits(),
              getTodayVisits()
            ]);
            if (isMounted) {
              setTotalVisits(total);
              setTodayVisits(today);
            }
          } catch (error) {
            console.error('Error refreshing visits:', error);
          }
        }, 5 * 60 * 1000);

        // 6. 执行数据清理（过期会话、光标、编辑锁、软删除的卡片）
        cleanupOnAppStart().catch(error => {
          console.error('Error during cleanup on app start:', error);
        });

        // 7. 初始化光标颜色（为当前用户生成随机颜色）
        const myColor = generateRandomColor();
        setUserColors(prev => {
          const newMap = new Map(prev);
          newMap.set(uid, myColor);
          return newMap;
        });

        // 8. 加载初始光标数据并订阅更新
        const initialCursors = await getActiveCursors();
        setCursors(initialCursors);
        
        // 为所有光标用户分配颜色和获取用户名
        const colorMap = new Map<string, string>();
        const nameMap = new Map<string, string | null>();
        colorMap.set(uid, myColor);
        nameMap.set(uid, uname);
        
        for (const cursor of initialCursors) {
          if (!colorMap.has(cursor.visitor_uid)) {
            colorMap.set(cursor.visitor_uid, generateRandomColor());
          }
          if (!nameMap.has(cursor.visitor_uid)) {
            const visitor = await getVisitorByUid(cursor.visitor_uid);
            nameMap.set(cursor.visitor_uid, visitor?.uname || null);
          }
        }
        
        setUserColors(colorMap);
        setUserNames(nameMap);

        // 订阅光标更新
        unsubscribeCursors = subscribeCursors(async (updatedCursors) => {
          setCursors(updatedCursors);
          
          // 为新用户分配颜色和获取用户名
          setUserColors(prev => {
            const newColorMap = new Map(prev);
            updatedCursors.forEach((cursor) => {
              if (!newColorMap.has(cursor.visitor_uid)) {
                newColorMap.set(cursor.visitor_uid, generateRandomColor());
              }
            });
            return newColorMap;
          });
          
          // 异步获取所有新用户的用户名
          const newUserIds = updatedCursors
            .map(cursor => cursor.visitor_uid)
            .filter((uid, index, self) => self.indexOf(uid) === index); // 去重
          
          const namePromises = newUserIds.map(async (uid) => {
            try {
              const visitor = await getVisitorByUid(uid);
              return { uid, uname: visitor?.uname || null };
            } catch (error) {
              console.error('Error getting visitor:', error);
              return { uid, uname: null };
            }
          });
          
          const nameResults = await Promise.all(namePromises);
          setUserNames(prev => {
            const newNameMap = new Map(prev);
            nameResults.forEach(({ uid, uname }) => {
              if (!newNameMap.has(uid)) {
                newNameMap.set(uid, uname);
              }
            });
            return newNameMap;
          });
        });

        // 订阅编辑锁变化
        unsubscribeEditLocks = subscribeEditLocks((locks) => {
          setEditLocks(locks);
        });

        // 9. 启动光标位置更新定时器（每 100ms 更新一次）
        cursorUpdateTimerRef.current = setInterval(async () => {
          // 使用 ref 获取最新的 cursorPosition 和 canvas.scale
          const currentPosition = cursorPositionRef.current;
          const currentScale = canvasScaleRef.current;
          
          if (currentPosition && uid && sid) {
            const { x, y, canvasX, canvasY } = currentPosition;
            
            // 只有当位置发生变化时才更新
            const last = lastCursorUpdateRef.current;
            if (!last || last.x !== x || last.y !== y || 
                last.canvasX !== canvasX || last.canvasY !== canvasY) {
              try {
                await upsertCursor(uid, sid, x, y, canvasX, canvasY, currentScale);
                lastCursorUpdateRef.current = { x, y, canvasX, canvasY };
              } catch (error) {
                console.error('Error updating cursor:', error);
              }
            }
          }
        }, 100);
      } catch (error) {
        console.error('Error initializing user and stats:', error);
      }
    };

    initUserAndStats();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      if (unsubscribeVisits) {
        unsubscribeVisits();
      }
      if (unsubscribeCursors) {
        unsubscribeCursors();
      }
      if (unsubscribeEditLocks) {
        unsubscribeEditLocks();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // 清理编辑锁续期定时器
      if (lockRenewTimerRef.current) {
        clearTimeout(lockRenewTimerRef.current);
      }
      // 清理定期检查定时器
      if (lockCheckIntervalRef.current) {
        clearInterval(lockCheckIntervalRef.current);
      }
      // 释放当前编辑锁
      if (currentEditLockRef.current && userId) {
        releaseLock(currentEditLockRef.current, userId).catch(error => {
          console.error('Error releasing lock on unmount:', error);
        });
      }
      if (visitsRefreshIntervalRef.current) {
        clearInterval(visitsRefreshIntervalRef.current);
      }
      if (cursorUpdateTimerRef.current) {
        clearInterval(cursorUpdateTimerRef.current);
      }
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 更新 canvas scale ref
  useEffect(() => {
    canvasScaleRef.current = canvas.scale;
  }, [canvas.scale]);

  // 防抖保存卡片
  const debouncedSaveCard = async (card: CanvasItemData) => {
    // 检查锁状态（如果正在编辑这个卡片）
    if (currentEditLockRef.current === card.id && userId) {
      const lockInfo = await getLockInfo(card.id);
      if (!lockInfo) {
        // 锁不存在（已过期或被清理）
        console.warn('Lock does not exist, may have expired');
        currentEditLockRef.current = null;
        setEditingCardId(null);
        setVimMode('normal');
        setConflictCardId(card.id);
        return;
      }
      
      if (lockInfo.visitor_uid !== userId) {
        // 锁已被其他人持有
        console.warn('Lock held by another user');
        currentEditLockRef.current = null;
        setEditingCardId(null);
        setVimMode('normal');
        setConflictCardId(card.id);
        return;
      }
      
      // 检查锁是否过期
      const expiresAt = new Date(lockInfo.expires_at);
      if (expiresAt <= new Date()) {
        // 锁已过期
        console.warn('Lock has expired');
        currentEditLockRef.current = null;
        setEditingCardId(null);
        setVimMode('normal');
        setConflictCardId(card.id);
        return;
      }
    }

    if (saveCardTimerRef.current) {
      clearTimeout(saveCardTimerRef.current);
    }
    saveCardTimerRef.current = setTimeout(async () => {
      // 保存前再次检查锁状态
      if (currentEditLockRef.current === card.id && userId) {
        const isHeld = await isLockHeldByCurrentUser(card.id, userId);
        if (!isHeld) {
          // 锁已被其他人持有，显示冲突对话框
          setConflictCardId(card.id);
          return;
        }
      }
      
      try {
        await saveCard(card);
      } catch (error) {
        console.error('Error saving card:', error);
      }
    }, 2000); // 2秒防抖
  };

  // 异步保存涂鸦（不阻塞主线程）
  const debouncedSaveDrawing = (drawing: DrawPath) => {
    // 如果已经保存过，跳过
    if (typeof drawing.id === 'string' && savedDrawingIdsRef.current.has(drawing.id)) {
      return;
    }

    // 添加到待保存队列
    pendingSaveQueueRef.current.set(drawing.id, drawing);

    // 清除之前的防抖定时器
    if (saveDrawingTimerRef.current) {
      clearTimeout(saveDrawingTimerRef.current);
    }

    // 使用防抖延迟，但保存操作完全异步执行，不阻塞 UI
    saveDrawingTimerRef.current = setTimeout(() => {
      // 使用 queueMicrotask 确保在下一个微任务队列执行，不阻塞当前渲染
      queueMicrotask(() => {
        processSaveQueue();
      });
    }, 500); // 0.5秒防抖
  };

  // 处理保存队列（完全异步，不阻塞主线程）
  const processSaveQueue = () => {
    // 如果正在保存或队列为空，跳过
    if (isSavingRef.current || pendingSaveQueueRef.current.size === 0) {
      return;
    }

    isSavingRef.current = true;

    // 获取待保存的队列并清空
    const queue = Array.from(pendingSaveQueueRef.current.values());
    pendingSaveQueueRef.current.clear();

    // 使用 requestIdleCallback 在浏览器空闲时执行保存，或使用 setTimeout 作为回退
    const executeSave = () => {
      // 批量保存，完全异步执行，不阻塞主线程
      Promise.all(queue.map(async (drawing) => {
        try {
          // 再次检查是否已保存
          if (typeof drawing.id === 'string' && savedDrawingIdsRef.current.has(drawing.id)) {
            return;
          }

          // 异步保存，不阻塞
          const dbId = await saveDrawing(drawing);
          if (dbId !== null) {
            savedDrawingIdsRef.current.add(dbId);
            // 使用 queueMicrotask 延迟状态更新，确保不阻塞当前任务
            queueMicrotask(() => {
              setDrawPaths(prev => prev.map(p => 
                p.id === drawing.id ? { ...p, id: dbId } : p
              ));
            });
          }
        } catch (error) {
          console.error('Error saving drawing:', error);
        }
      })).finally(() => {
        isSavingRef.current = false;
        // 如果队列中还有新的项目，继续处理
        if (pendingSaveQueueRef.current.size > 0) {
          // 使用 requestIdleCallback 或 setTimeout 继续处理
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => processSaveQueue(), { timeout: 1000 });
          } else {
            setTimeout(() => processSaveQueue(), 0);
          }
        }
      });
    };

    // 优先使用 requestIdleCallback，否则使用 setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(executeSave, { timeout: 1000 });
    } else {
      setTimeout(executeSave, 0);
    }
  };

  // 手动保存所有数据
  const handleManualSave = async () => {
    try {
      // 保存所有卡片
      await Promise.all(items.map(card => saveCard(card)));
      
      // 保存所有未保存的涂鸦（这里简化处理，实际可能需要跟踪哪些已保存）
      const unsavedDrawings = drawPaths.filter(path => 
        typeof path.id === 'number' || (typeof path.id === 'string' && !savedDrawingIdsRef.current.has(path.id))
      );
      if (unsavedDrawings.length > 0) {
        await Promise.all(unsavedDrawings.map(drawing => saveDrawing(drawing)));
      }
      
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // 检查滚动是否发生在可滚动元素内（如 Article 卡片的内容区域）
      const target = e.target as HTMLElement;
      
      // 如果目标是 textarea 或 input，检查是否可以滚动
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        const element = target as HTMLTextAreaElement | HTMLInputElement;
        const isAtTop = element.scrollTop <= 0;
        const isAtBottom = element.scrollTop >= element.scrollHeight - element.clientHeight - 1;
        const isAtLeft = element.scrollLeft <= 0;
        const isAtRight = element.scrollLeft >= element.scrollWidth - element.clientWidth - 1;
        
        const scrollingDown = e.deltaY > 0;
        const scrollingUp = e.deltaY < 0;
        const scrollingRight = e.deltaX > 0;
        const scrollingLeft = e.deltaX < 0;
        
        // 如果 textarea/input 可以滚动且不在边界，不处理 canvas
        if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
          if ((scrollingDown && !isAtBottom) || 
              (scrollingUp && !isAtTop) ||
              (scrollingRight && !isAtRight) ||
              (scrollingLeft && !isAtLeft)) {
            return; // 在可滚动区域内滚动，不处理 canvas
          }
          
          // 如果到达边界且继续向边界方向滚动（惯性滚动），阻止 canvas 拖动
          if ((isAtTop && scrollingUp) || 
              (isAtBottom && scrollingDown) ||
              (isAtLeft && scrollingLeft) ||
              (isAtRight && scrollingRight)) {
            e.preventDefault();
            return; // 阻止惯性滚动传递到 canvas
          }
        }
        
        // 如果 textarea/input 不可滚动，直接返回（编辑模式下，不允许画布移动）
        return;
      }
      
      const scrollableElement = target.closest('[data-scrollable]') || 
                                 target.closest('.overflow-y-auto') ||
                                 target.closest('.overflow-auto');
      
      // 如果滚动发生在可滚动元素内，且该元素可以滚动，则不处理 canvas 拖动
      if (scrollableElement && (scrollableElement as HTMLElement).scrollHeight > (scrollableElement as HTMLElement).clientHeight) {
        // 检查是否已经滚动到边界
        const element = scrollableElement as HTMLElement;
        const isAtTop = element.scrollTop <= 0;
        const isAtBottom = element.scrollTop >= element.scrollHeight - element.clientHeight - 1;
        const isAtLeft = element.scrollLeft <= 0;
        const isAtRight = element.scrollLeft >= element.scrollWidth - element.clientWidth - 1;
        
        // 如果不在边界，或者滚动方向与边界不符，则不处理 canvas 拖动
        const scrollingDown = e.deltaY > 0;
        const scrollingUp = e.deltaY < 0;
        const scrollingRight = e.deltaX > 0;
        const scrollingLeft = e.deltaX < 0;
        
        // 如果不在边界，不处理 canvas
        if ((scrollingDown && !isAtBottom) || 
            (scrollingUp && !isAtTop) ||
            (scrollingRight && !isAtRight) ||
            (scrollingLeft && !isAtLeft)) {
          return; // 在可滚动区域内滚动，不处理 canvas
        }
        
        // 如果到达边界且继续向边界方向滚动（惯性滚动），阻止 canvas 拖动
        if ((isAtTop && scrollingUp) || 
            (isAtBottom && scrollingDown) ||
            (isAtLeft && scrollingLeft) ||
            (isAtRight && scrollingRight)) {
          e.preventDefault();
          return; // 阻止惯性滚动传递到 canvas
        }
      }
      
      // 滚轮缩放（不需要 Ctrl 键）
      e.preventDefault();
      const zoomSensitivity = -0.002;
      setCanvas(prev => {
        const oldScale = prev.scale;
        const newScale = Math.min(Math.max(0.1, prev.scale + e.deltaY * zoomSensitivity), 3);
        
        // 获取鼠标在容器中的位置
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 计算缩放比例
        const scaleRatio = newScale / oldScale;
        
        // 以鼠标位置为中心进行缩放
        const newX = mouseX - (mouseX - prev.x) * scaleRatio;
        const newY = mouseY - (mouseY - prev.y) * scaleRatio;
        
        return { x: newX, y: newY, scale: newScale };
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      // 检测到双指触摸时阻止默认行为（前进后退手势）
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // 双指移动时阻止默认行为
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const updateItem = (id: string, changes: Partial<CanvasItemData>) => {
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, ...changes };
          // 防抖保存（跳过正在初始化的卡片，避免重复保存）
          if (!initializingCardIdsRef.current.has(id)) {
            debouncedSaveCard(updatedItem);
          }
          
          // 如果更新的是正在编辑的卡片，续期锁
          if (currentEditLockRef.current === id && userId && sessionId) {
            // 清除之前的续期定时器
            if (lockRenewTimerRef.current) {
              clearTimeout(lockRenewTimerRef.current);
            }
            // 防抖续期（2秒）
            lockRenewTimerRef.current = setTimeout(async () => {
              try {
                const success = await renewLock(id, userId, sessionId);
                if (!success) {
                  // 续期失败，锁可能已被其他人持有或已过期
                  console.warn('Lock renewal failed, lock may have been taken by another user');
                  // 检查锁状态
                  const isHeld = await isLockHeldByCurrentUser(id, userId!);
                  if (!isHeld) {
                    // 锁已被其他人持有，清除当前编辑状态并提示用户
                    currentEditLockRef.current = null;
                    setEditingCardId(null);
                    setVimMode('normal');
                    // 显示冲突提示
                    setConflictCardId(id);
                  }
                }
              } catch (error) {
                console.error('Error renewing lock:', error);
                // 续期出错，检查锁状态
                try {
                  const isHeld = await isLockHeldByCurrentUser(id, userId!);
                  if (!isHeld) {
                    currentEditLockRef.current = null;
                    setEditingCardId(null);
                    setVimMode('normal');
                    setConflictCardId(id);
                  }
                } catch (checkError) {
                  console.error('Error checking lock status:', checkError);
                }
              }
            }, 2000);
          }
          
          return updatedItem;
        }
        return item;
      });
      return updated;
    });
  };

  const bringToFront = (id: string) => {
    setSelectedId(id);
  };

  const addItem = (type: 'article' | 'image' | 'github', contentData: string | GitHubCardData, titleOverride?: string) => {
      const id = crypto.randomUUID();
      const centerX = -canvas.x + (window.innerWidth / 2) - 200;
      const centerY = -canvas.y + (window.innerHeight / 2) - 200;
      
      // 对于 article 类型，从内容中提取 H1 作为 title
      let title: string;
      if (type === 'article') {
        title = titleOverride || extractH1Title(contentData as string) || '';
      } else {
        title = titleOverride || (type === 'github' ? 'NEW_REPO' : type === 'image' ? 'IMAGE_VIEW' : 'NEW_DOC.md');
      }
      
      const newItem: CanvasItemData = {
          id,
          type,
          x: centerX + Math.random() * 50,
          y: centerY + Math.random() * 50,
          width: type === 'github' ? 700 : type === 'image' ? 400 : 600,
          height: type === 'github' ? 440 : type === 'image' ? 400 : type === 'article' ? 500 : 400,
          title,
          icon: type === 'github' ? Github : type === 'image' ? ImageIcon : FileText,
          content: contentData
      };
      setItems(prev => [...prev, newItem]);
      setSelectedId(id);
      bringToFront(id);
      // 聚焦到新卡片
      centerOnCard(id);
      // 立即保存新卡片（不防抖）
      saveCard(newItem).catch(error => console.error('Error saving new card:', error));
  };

  const handleModalSubmit = async (value: string, title: string) => {
      // 如果是编辑模式，更新现有卡片
      if (editingCardId && vimMode === 'edit') {
          const card = items.find(item => item.id === editingCardId);
          if (card) {
              if (modalType === 'github') {
                  // 更新 GitHub 卡片
                  const tempContent = {
                      repo: value,
                      url: value.startsWith('http') ? value : `https://github.com/${value}`,
                      language: 'Loading...',
                      stars: 0,
                      forks: 0,
                      description: 'Fetching repository info...'
                  };
                  updateItem(editingCardId, {
                      content: tempContent,
                      title: title || value.split('/').pop() || card.title
                  });
                  
                  // 异步获取真实数据
                  try {
                      const repoData = await fetchGitHubRepoInfo(value);
                      updateItem(editingCardId, {
                          content: repoData,
                          title: title || repoData.repo.split('/').pop() || card.title
                      });
                  } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repository info';
                      updateItem(editingCardId, {
                          content: {
                              repo: value,
                              url: value.startsWith('http') ? value : `https://github.com/${value}`,
                              language: 'Unknown',
                              stars: 0,
                              forks: 0,
                              description: `Error: ${errorMessage}`
                          }
                      });
                  }
              } else if (modalType === 'image') {
                  // 更新 Image 卡片
                  updateItem(editingCardId, {
                      content: value,
                      title: title || card.title
                  });
              }
              setEditingCardId(null);
              setVimMode('normal');
          }
          setModalType(null);
          return;
      }

      // 创建新卡片
      if (modalType === 'github') {
          // 先创建卡片，显示加载状态
          const tempId = crypto.randomUUID();
          const centerX = -canvas.x + (window.innerWidth / 2) - 200;
          const centerY = -canvas.y + (window.innerHeight / 2) - 200;
          
          const tempItem: CanvasItemData = {
              id: tempId,
              type: 'github',
              x: centerX + Math.random() * 50,
              y: centerY + Math.random() * 50,
              width: 350,
              height: 220,
              title: title || value.split('/').pop() || 'GIT_REPO',
              icon: Github,
              content: {
                  repo: value,
                  url: value.startsWith('http') ? value : `https://github.com/${value}`,
                  language: 'Loading...',
                  stars: 0,
                  forks: 0,
                  description: 'Fetching repository info...'
              }
          };
          setItems(prev => [...prev, tempItem]);
          
          // 异步获取真实数据
          try {
              const repoData = await fetchGitHubRepoInfo(value);
              updateItem(tempId, {
                  content: repoData,
                  title: title || repoData.repo.split('/').pop() || 'GIT_REPO'
              });
          } catch (error) {
              // 如果获取失败，使用默认值并显示错误信息
              const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repository info';
              updateItem(tempId, {
                  content: {
                      repo: value,
                      url: value.startsWith('http') ? value : `https://github.com/${value}`,
                      language: 'Unknown',
                      stars: 0,
                      forks: 0,
                      description: `Error: ${errorMessage}`
                  }
              });
          }
      } else if (modalType === 'image') {
          addItem('image', value, title || 'IMAGE_VIEW');
      }
  };

  const handleAddArticle = () => {
    addItem('article', '# 新文档\n\n开始输入...', '新文档');
  };

  const handleAddImage = () => {
    setModalType('image');
  };

  const handleAddGitHub = () => {
    setModalType('github');
  };

  // 将画布中心移动到指定卡片
  const centerOnCard = (cardId: string) => {
    const card = items.find(item => item.id === cardId);
    if (!card) return;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const cardCenterX = card.x + card.width / 2;
    const cardCenterY = card.y + card.height / 2;
    
    setCanvas(prev => ({
      ...prev,
      x: centerX - cardCenterX * prev.scale,
      y: centerY - cardCenterY * prev.scale
    }));
  };

  // 获取排序后的卡片列表（行优先，左上角 id 最小）
  const getSortedItems = (): CanvasItemData[] => {
    return [...items]
      .filter(item => item.visible !== false)
      .sort((a, b) => {
        // 先按 y 坐标排序（行优先）
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) > 50) { // 如果 y 坐标差距较大，认为是不同行
          return yDiff;
        }
        // 同一行内，先按 x 坐标排序
        const xDiff = a.x - b.x;
        if (Math.abs(xDiff) > 50) {
          return xDiff;
        }
        // 如果位置很接近，按 id 排序（字符串比较）
        return a.id.localeCompare(b.id);
      });
  };

  // 导航到下一个/上一个卡片
  const navigateCard = (direction: 'up' | 'down' | 'left' | 'right') => {
    const sortedItems = getSortedItems();
    if (sortedItems.length === 0) return;
    
    const currentIndex = selectedId 
      ? sortedItems.findIndex(item => item.id === selectedId)
      : -1;
    
    let nextIndex = currentIndex;
    
    if (direction === 'down' || direction === 'right') {
      nextIndex = currentIndex < sortedItems.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : sortedItems.length - 1;
    }
    
    const nextCard = sortedItems[nextIndex];
    if (nextCard) {
      setSelectedId(nextCard.id);
      bringToFront(nextCard.id);
      centerOnCard(nextCard.id);
    }
  };

  // 缩放（以 focus 的 card 为中心，如果没有则以屏幕中心为中心）
  const zoomIn = () => {
    if (!containerRef.current) return;
    
    setCanvas(prev => {
      const oldScale = prev.scale;
      const newScale = Math.min(prev.scale * 1.2, 3);
      const scaleRatio = newScale / oldScale;
      
      let centerX: number, centerY: number;
      
      // 如果有 focus 的 card，以 card 中心在屏幕上的位置为中心
      if (selectedId) {
        const card = items.find(item => item.id === selectedId);
        if (card) {
          const cardCenterX = card.x + card.width / 2;
          const cardCenterY = card.y + card.height / 2;
          // 计算 card 中心在当前 scale 下的屏幕坐标
          centerX = prev.x + cardCenterX * prev.scale;
          centerY = prev.y + cardCenterY * prev.scale;
        } else {
          // card 不存在，使用屏幕中心
          centerX = window.innerWidth / 2;
          centerY = window.innerHeight / 2;
        }
      } else {
        // 没有 focus 的 card，使用屏幕中心
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;
      }
      
      // 以中心点进行缩放（参考 handleWheel 的逻辑）
      const newX = centerX - (centerX - prev.x) * scaleRatio;
      const newY = centerY - (centerY - prev.y) * scaleRatio;
      
      return { x: newX, y: newY, scale: newScale };
    });
  };

  const zoomOut = () => {
    if (!containerRef.current) return;
    
    setCanvas(prev => {
      const oldScale = prev.scale;
      const newScale = Math.max(prev.scale / 1.2, 0.1);
      const scaleRatio = newScale / oldScale;
      
      let centerX: number, centerY: number;
      
      // 如果有 focus 的 card，以 card 中心在屏幕上的位置为中心
      if (selectedId) {
        const card = items.find(item => item.id === selectedId);
        if (card) {
          const cardCenterX = card.x + card.width / 2;
          const cardCenterY = card.y + card.height / 2;
          // 计算 card 中心在当前 scale 下的屏幕坐标
          centerX = prev.x + cardCenterX * prev.scale;
          centerY = prev.y + cardCenterY * prev.scale;
        } else {
          // card 不存在，使用屏幕中心
          centerX = window.innerWidth / 2;
          centerY = window.innerHeight / 2;
        }
      } else {
        // 没有 focus 的 card，使用屏幕中心
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;
      }
      
      // 以中心点进行缩放（参考 handleWheel 的逻辑）
      const newX = centerX - (centerX - prev.x) * scaleRatio;
      const newY = centerY - (centerY - prev.y) * scaleRatio;
      
      return { x: newX, y: newY, scale: newScale };
    });
  };

  // 处理 setuname 命令
  const handleSetUname = async (uname: string): Promise<void> => {
    if (!userId) {
      console.error('User ID not available');
      return;
    }

    try {
      await setUserName(userId, uname);
      setUserNameState(uname);
      // 可以在这里添加成功提示
      console.log(`User name set to: ${uname}`);
    } catch (error) {
      console.error('Error setting user name:', error);
      // 可以在这里添加错误提示
    }
  };

  // 处理命令
  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    
    if (trimmed === 'na' || trimmed === 'newarticle') {
      handleAddArticle();
      setCommand('');
      setVimMode('normal');
    } else if (trimmed === 'nr' || trimmed === 'newrepo') {
      handleAddGitHub();
      setCommand('');
      setVimMode('normal');
    } else if (trimmed === 'ni' || trimmed === 'newimage') {
      handleAddImage();
      setCommand('');
      setVimMode('normal');
    } else if (trimmed === 'w' || trimmed === 'save') {
      handleManualSave();
      setCommand('');
      setVimMode('normal');
    } else if (trimmed.startsWith('setuname')) {
      // 处理 setuname 命令
      const parts = trimmed.split(/\s+/);
      if (parts.length === 2) {
        const uname = parts[1];
        await handleSetUname(uname);
        setCommand('');
        setVimMode('normal');
      } else {
        // 显示错误提示（可以通过状态显示）
        console.error('Usage: setuname <name>');
        setCommand('');
        setVimMode('normal');
      }
    } else {
      // 未知命令
      setCommand('');
      setVimMode('normal');
    }
  };

  // Undo/Redo for draw paths
  const saveDrawHistory = () => {
    setDrawHistory(prev => {
      const newHistory = prev.slice(0, drawHistoryIndex + 1);
      newHistory.push([...drawPaths]);
      return newHistory.slice(-50); // 只保留最近 50 次
    });
    setDrawHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  const handleUndo = () => {
    if (drawHistoryIndex > 0) {
      const newIndex = drawHistoryIndex - 1;
      setDrawHistoryIndex(newIndex);
      setDrawPaths([...drawHistory[newIndex]]);
    }
  };

  const handleRedo = () => {
    if (drawHistoryIndex < drawHistory.length - 1) {
      const newIndex = drawHistoryIndex + 1;
      setDrawHistoryIndex(newIndex);
      setDrawPaths([...drawHistory[newIndex]]);
    }
  };

  // 当 drawPaths 改变时保存历史
  useEffect(() => {
    if (drawMode === 'draw' && drawPaths.length > 0) {
      const timer = setTimeout(() => {
        saveDrawHistory();
      }, 500); // 延迟保存，避免频繁保存
      return () => clearTimeout(timer);
    }
  }, [drawPaths.length]);

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      // ESC 键处理（需要在检查输入元素之前，因为 InputModal 中的输入框也需要响应 ESC）
      if (e.key === 'Escape') {
        // 如果删除确认对话框打开，优先关闭它
        if (deleteConfirmId) {
          e.preventDefault();
          setDeleteConfirmId(null);
          return;
        }
        
        // 如果 InputModal 打开，优先关闭它
        if (modalType) {
          e.preventDefault();
          setModalType(null);
          if (vimMode === 'edit') {
            setEditingCardId(null);
            setVimMode('normal');
          }
          return;
        }
        
        e.preventDefault();
        if (vimMode === 'command') {
          setCommand('');
          setVimMode('normal');
        } else if (vimMode === 'edit') {
          setEditingCardId(null);
          setVimMode('normal');
          // 保持焦点在卡片上，不调用 blur()
        } else if (vimMode === 'draw') {
          setDrawMode('off');
          setVimMode('normal');
        }
        return;
      }

      // 如果正在输入（在 input/textarea 中），不处理其他按键
      if (isInputElement) {
        // 在命令模式下，如果焦点在 command input 上，让 input 自己处理
        // 否则（比如桌面端键盘输入），继续处理
        if (vimMode === 'command') {
          // command input 会自己处理输入，这里不拦截
          return;
        }
        // 其他模式下，如果是在 input/textarea 中，不处理
        return;
      }

      // 命令模式（桌面端键盘输入，焦点不在 input 上时）
      if (vimMode === 'command') {
        if (e.key === 'Enter') {
          executeCommand(command);
        } else if (e.key === 'Backspace') {
          setCommand(prev => prev.slice(0, -1));
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setCommand(prev => prev + e.key);
        }
        return;
      }

      // Edit mode - 其他按键不处理（已经在上面处理了 ESC）
      if (vimMode === 'edit') {
        return;
      }

      // Draw mode - 其他按键不处理（已经在上面处理了 ESC）
      if (vimMode === 'draw') {
        return;
      }

      // Normal mode
      if (vimMode === 'normal') {
        const key = e.key.toLowerCase();
        
        // 处理 zi/zo 序列
        if (key === 'z' || keySequenceRef.current === 'z') {
          if (keySequenceTimerRef.current) {
            clearTimeout(keySequenceTimerRef.current);
          }
          
          if (key === 'z') {
            keySequenceRef.current = 'z';
            keySequenceTimerRef.current = setTimeout(() => {
              keySequenceRef.current = '';
            }, 500);
            e.preventDefault();
            return;
          } else if (keySequenceRef.current === 'z') {
            if (key === 'i') {
              e.preventDefault();
              e.stopPropagation();
              zoomIn();
              keySequenceRef.current = '';
              if (keySequenceTimerRef.current) {
                clearTimeout(keySequenceTimerRef.current);
                keySequenceTimerRef.current = null;
              }
              return;
            } else if (key === 'o') {
              e.preventDefault();
              e.stopPropagation();
              zoomOut();
              keySequenceRef.current = '';
              if (keySequenceTimerRef.current) {
                clearTimeout(keySequenceTimerRef.current);
                keySequenceTimerRef.current = null;
              }
              return;
            } else {
              // 不是 i 或 o，重置序列
              keySequenceRef.current = '';
              if (keySequenceTimerRef.current) {
                clearTimeout(keySequenceTimerRef.current);
                keySequenceTimerRef.current = null;
              }
            }
          }
        }
        
        // 进入命令模式
        if (e.key === ':') {
          e.preventDefault();
          e.stopPropagation();
          setCommand('');
          setVimMode('command');
          return;
        }

        // 进入编辑模式（只有在不在等待 z 序列时）
        if (e.key === 'i' && keySequenceRef.current !== 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (selectedId) {
            const card = items.find(item => item.id === selectedId);
            if (card && !card.locked) {
              if (card.type === 'article') {
                setEditingCardId(selectedId);
                setVimMode('edit');
              } else {
                // Repo 或 Image 卡片，弹出 InputModal 进行编辑
                setEditingCardId(selectedId);
                setVimMode('edit');
                if (card.type === 'github') {
                  setModalType('github');
                } else if (card.type === 'image') {
                  setModalType('image');
                }
              }
            }
          }
          return;
        }

        // 进入绘图模式（小写 d）
        if (e.key === 'd' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          setDrawMode('draw');
          setVimMode('draw');
          return;
        }

        // 删除卡片（大写 D）
        if (e.key === 'D' || (e.key === 'd' && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (selectedId) {
            const card = items.find(item => item.id === selectedId);
            if (card && !card.locked) {
              setDeleteConfirmId(selectedId);
            }
          }
          return;
        }

        // 移动卡片位置（箭头键）
        if (selectedId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          e.stopPropagation();
          const card = items.find(item => item.id === selectedId);
          if (card && !card.locked) {
            const moveStep = 10; // 每次移动的像素数
            let newX = card.x;
            let newY = card.y;
            
            if (e.key === 'ArrowLeft') {
              newX = card.x - moveStep;
            } else if (e.key === 'ArrowRight') {
              newX = card.x + moveStep;
            } else if (e.key === 'ArrowUp') {
              newY = card.y - moveStep;
            } else if (e.key === 'ArrowDown') {
              newY = card.y + moveStep;
            }
            
            updateItem(selectedId, { x: newX, y: newY });
          }
          return;
        }

        // 导航（HJKL）
        if (e.key === 'h') {
          e.preventDefault();
          navigateCard('left');
          return;
        }
        if (e.key === 'j') {
          e.preventDefault();
          navigateCard('down');
          return;
        }
        if (e.key === 'k') {
          e.preventDefault();
          navigateCard('up');
          return;
        }
        if (e.key === 'l') {
          e.preventDefault();
          navigateCard('right');
          return;
        }

      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // 清理序列定时器
      if (keySequenceTimerRef.current) {
        clearTimeout(keySequenceTimerRef.current);
        keySequenceTimerRef.current = null;
      }
    };
  }, [vimMode, command, selectedId, items, drawMode, modalType, deleteConfirmId]);


  // 当 drawMode 改变时，同步 vimMode
  useEffect(() => {
    if (drawMode === 'off' && vimMode === 'draw') {
      setVimMode('normal');
    } else if (drawMode === 'draw' && vimMode !== 'draw') {
      setVimMode('draw');
    }
  }, [drawMode]);

  // 当从 draw/erase 模式回到 normal 模式时，清空 undo/redo 历史
  const prevDrawModeRef = useRef<DrawMode>(drawMode);
  useEffect(() => {
    const prevMode = prevDrawModeRef.current;
    // 如果从 draw 或 erase 模式变为 off 模式，清空历史记录
    if ((prevMode === 'draw' || prevMode === 'erase') && drawMode === 'off') {
      setDrawHistory([]);
      setDrawHistoryIndex(-1);
    }
    prevDrawModeRef.current = drawMode;
  }, [drawMode]);

  // 监听鼠标移动，更新光标位置
  useEffect(() => {
    const updateCursorPosition = (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = clientX;
      const screenY = clientY;
      
      // 转换为画布世界坐标
      const canvasX = (screenX - rect.left - canvas.x) / canvas.scale;
      const canvasY = (screenY - rect.top - canvas.y) / canvas.scale;
      
      const position = { x: screenX, y: screenY, canvasX, canvasY };
      setCursorPosition(position);
      cursorPositionRef.current = position;
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };

    // 同时监听 pointermove，因为在拖动时（使用 setPointerCapture）pointermove 更可靠
    const handlePointerMove = (e: PointerEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointermove', handlePointerMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [canvas]);

  const visibleItemsCount = items.filter(i => i.visible !== false).length;
  const myCursorColor = userId ? (userColors.get(userId) || '#00ffff') : '#00ffff';

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen overflow-hidden bg-black text-white font-mono relative select-none"
      style={{ touchAction: 'pan-x pan-y', cursor: 'none' }}
    >
      <Canvas 
        canvas={canvas}
        items={items}
        selectedId={selectedId}
        onUpdateItem={updateItem}
        onFocusItem={bringToFront}
        onDeleteItem={(id) => setDeleteConfirmId(id)}
        onUnlockItem={(id) => setUnlockConfirmId(id)}
        drawPaths={drawPaths}
        onAddDrawPath={(path) => {
          setDrawPaths(prev => [...prev, path]);
          saveDrawHistory();
          // 防抖保存涂鸦
          debouncedSaveDrawing(path);
        }}
        onRemoveDrawPath={(id) => {
          setDrawPaths(prev => prev.filter(p => p.id !== id));
          // 从数据库中删除 drawing（只有已保存到数据库的 drawing 才需要删除）
          if (typeof id === 'string' && savedDrawingIdsRef.current.has(id)) {
            deleteDrawing(id).catch(error => {
              console.error('Error deleting drawing from database:', error);
            });
            // 从跟踪集合中移除
            savedDrawingIdsRef.current.delete(id);
          }
          // 使用防抖来延迟保存历史，以便批量删除操作可以合并为一次历史记录
          if (eraseHistoryTimerRef.current) {
            clearTimeout(eraseHistoryTimerRef.current);
          }
          eraseHistoryTimerRef.current = setTimeout(() => {
            saveDrawHistory();
            eraseHistoryTimerRef.current = null;
          }, 100);
        }}
        drawMode={drawMode}
        drawColor={drawColor}
        drawWidth={drawWidth}
        editingCardId={editingCardId}
        editLocks={editLocks}
        currentUserId={userId}
        onEditChange={(id, editing) => {
          if (editing) {
            setEditingCardId(id);
            setVimMode('edit');
          } else {
            setEditingCardId(null);
            setVimMode('normal');
          }
        }}
        vimMode={vimMode}
        onUpdateCanvas={(changes) => {
          setCanvas(prev => ({ ...prev, ...changes }));
        }}
        onCursorMove={(clientX, clientY) => {
          // 在拖动时直接更新光标位置
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const screenX = clientX;
            const screenY = clientY;
            const canvasX = (screenX - rect.left - canvas.x) / canvas.scale;
            const canvasY = (screenY - rect.top - canvas.y) / canvas.scale;
            const position = { x: screenX, y: screenY, canvasX, canvasY };
            setCursorPosition(position);
            cursorPositionRef.current = position;
          }
        }}
      />

      {/* 光标管理器 - 管理所有用户的光标 */}
      <CursorManager
        cursors={cursors}
        currentUserId={userId}
        canvas={canvas}
        containerRef={containerRef}
        userColors={userColors}
        userNames={userNames}
        myCursorPosition={cursorPosition ? { x: cursorPosition.x, y: cursorPosition.y } : null}
        myCursorColor={myCursorColor}
      />

      {/* Input Modals */}
      {modalType === 'github' && (
        <GitHubInputModal 
          onClose={() => {
            setModalType(null);
            if (vimMode === 'edit') {
              setEditingCardId(null);
              setVimMode('normal');
            }
          }} 
          onSubmit={handleModalSubmit} 
        />
      )}
      {modalType === 'image' && (
        <ImageInputModal 
          onClose={() => {
            setModalType(null);
            if (vimMode === 'edit') {
              setEditingCardId(null);
              setVimMode('normal');
            }
          }} 
          onSubmit={handleModalSubmit} 
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (() => {
        const card = items.find(item => item.id === deleteConfirmId);
        return card && !card.locked ? (
          <DeleteConfirmModal
            cardTitle={card.title}
            onClose={() => setDeleteConfirmId(null)}
            onConfirm={async () => {
              updateItem(deleteConfirmId, { visible: false });
              setSelectedId(null);
              // 保存删除状态
              try {
                await deleteCard(deleteConfirmId);
              } catch (error) {
                console.error('Error deleting card:', error);
              }
            }}
          />
        ) : null;
      })()}

      {/* Unlock Confirm Modal */}
      {unlockConfirmId && (() => {
        const card = items.find(item => item.id === unlockConfirmId);
        return card ? (
          <UnlockConfirmModal
            cardTitle={card.title}
            onClose={() => setUnlockConfirmId(null)}
            onConfirm={() => {
              updateItem(unlockConfirmId, { locked: false });
            }}
          />
        ) : null;
      })()}

      {/* Edit Conflict Modal */}
      {conflictCardId && (
        <EditConflictModal
          onClose={() => setConflictCardId(null)}
          onConfirm={async () => {
            if (conflictCardId) {
              // 刷新卡片内容
              try {
                const reloadedCards = await loadCards();
                const reloadedCard = reloadedCards.find(c => c.id === conflictCardId);
                if (reloadedCard) {
                  setItems(prev => prev.map(item => 
                    item.id === conflictCardId ? reloadedCard : item
                  ));
                }
              } catch (error) {
                console.error('Error reloading card:', error);
              }
              setConflictCardId(null);
            }
          }}
        />
      )}

      {/* Vignette & Noise */}
      <div className="fixed inset-0 pointer-events-none z-40 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]" />
      <div 
        className="fixed inset-0 pointer-events-none z-40 opacity-[0.03] mix-blend-overlay bg-repeat" 
        style={{ 
          backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjkiIG51bU9jdGF2ZXM9IjQiLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')` 
        }} 
      />
      
      <Header />

      <Dock 
        drawMode={drawMode}
        drawColor={drawColor}
        drawWidth={drawWidth}
        onDrawColorChange={setDrawColor}
        onDrawWidthChange={setDrawWidth}
        onDrawModeChange={setDrawMode}
      />

      <StatusBar 
        mode={vimMode}
        command={command}
        focusedCardId={selectedId}
        itemCount={visibleItemsCount}
        scale={canvas.scale}
        onlineCount={onlineCount}
        totalVisits={totalVisits}
        todayVisits={todayVisits}
        userName={userName}
        onCommandChange={(newCommand) => {
          setCommand(newCommand);
        }}
        onCommandExecute={(cmd) => {
          executeCommand(cmd);
        }}
        onModeChange={async (targetMode) => {
          if (targetMode === 'normal') {
            // 切换到 Normal 模式
            if (vimMode === 'edit') {
              // 退出编辑模式，释放锁
              if (currentEditLockRef.current && userId) {
                try {
                  await releaseLock(currentEditLockRef.current, userId);
                } catch (error) {
                  console.error('Error releasing lock:', error);
                }
                // 清除续期定时器
                if (lockRenewTimerRef.current) {
                  clearTimeout(lockRenewTimerRef.current);
                  lockRenewTimerRef.current = null;
                }
                // 清除定期检查定时器
                if (lockCheckIntervalRef.current) {
                  clearInterval(lockCheckIntervalRef.current);
                  lockCheckIntervalRef.current = null;
                }
                currentEditLockRef.current = null;
              }
              setEditingCardId(null);
              setVimMode('normal');
            } else if (vimMode === 'draw') {
              setDrawMode('off');
              setVimMode('normal');
            } else if (vimMode === 'command') {
              setCommand('');
              setVimMode('normal');
            }
          } else if (targetMode === 'edit') {
            // 进入编辑模式
            if (selectedId) {
              const card = items.find(item => item.id === selectedId);
              if (card && !card.locked) {
                // 检查卡片是否已被其他人锁定
                if (userId) {
                  const isLocked = await isCardLocked(selectedId);
                  if (isLocked) {
                    const lockInfo = editLocks.get(selectedId);
                    if (lockInfo && lockInfo.visitor_uid !== userId) {
                      // 被其他人锁定，提示用户
                      alert(`卡片正在被 ${lockInfo.uname || '其他用户'} 编辑中，无法进入编辑模式`);
                      return;
                    }
                  }
                  
                  // 尝试获取锁
                  try {
                    const success = await acquireLock(selectedId, userId, sessionId);
                    if (!success) {
                      alert('无法获取编辑锁，可能正在被其他用户编辑');
                      return;
                    }
                    currentEditLockRef.current = selectedId;
                  } catch (error) {
                    console.error('Error acquiring lock:', error);
                    alert('获取编辑锁失败');
                    return;
                  }
                }
                
                if (card.type === 'article') {
                  setEditingCardId(selectedId);
                  setVimMode('edit');
                } else {
                  // Repo 或 Image 卡片，弹出 InputModal 进行编辑
                  setEditingCardId(selectedId);
                  setVimMode('edit');
                  if (card.type === 'github') {
                    setModalType('github');
                  } else if (card.type === 'image') {
                    setModalType('image');
                  }
                }
              }
            }
          } else if (targetMode === 'draw') {
            // 进入绘图模式
            setDrawMode('draw');
            setVimMode('draw');
          } else if (targetMode === 'command') {
            // 进入命令模式
            setCommand('');
            setVimMode('command');
          }
        }}
      />
    </div>
  );
};

export default App;
