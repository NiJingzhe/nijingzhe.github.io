import { useState, useEffect, useRef } from 'react';
import { FileText, Github, Image as ImageIcon } from 'lucide-react';
import { Canvas } from './components/Canvas';
import { Header } from './components/Header';
import { Dock } from './components/Dock';
import { StatusBar } from './components/StatusBar';
import { GitHubInputModal } from './components/GitHubInputModal';
import { ImageInputModal } from './components/ImageInputModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { fetchGitHubRepoInfo } from './utils/githubApi';
import { loadCards, saveCard, deleteCard, loadDrawings, saveDrawing, deleteDrawing } from './utils/db';
import type { CanvasItemData, CanvasState, DrawPath, DrawMode, VimMode } from './types';
import type { GitHubCardData } from './components/GitHubCard';

// 从 markdown 内容中提取第一个 H1 作为 title
const extractH1Title = (content: string): string => {
  const h1Match = content.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : '';
};

const App = () => {
  const [canvas, setCanvas] = useState<CanvasState>({ x: 0, y: 0, scale: 1 });
  const [modalType, setModalType] = useState<'github' | 'image' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
  
  // 跟踪正在初始化的卡片 id，避免重复保存
  const initializingCardIdsRef = useRef<Set<string>>(new Set());

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
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 防抖保存卡片
  const debouncedSaveCard = (card: CanvasItemData) => {
    if (saveCardTimerRef.current) {
      clearTimeout(saveCardTimerRef.current);
    }
    saveCardTimerRef.current = setTimeout(async () => {
      try {
        await saveCard(card);
      } catch (error) {
        console.error('Error saving card:', error);
      }
    }, 2000); // 2秒防抖
  };

  // 防抖保存涂鸦
  const debouncedSaveDrawing = (drawing: DrawPath) => {
    if (saveDrawingTimerRef.current) {
      clearTimeout(saveDrawingTimerRef.current);
    }
    saveDrawingTimerRef.current = setTimeout(async () => {
      try {
        // 如果 drawing 已经保存过（在 savedDrawingIdsRef 中），跳过
        if (typeof drawing.id === 'string' && savedDrawingIdsRef.current.has(drawing.id)) {
          return;
        }
        
        // 保存到数据库
        const dbId = await saveDrawing(drawing);
        if (dbId !== null) {
          // 记录已保存的 id
          savedDrawingIdsRef.current.add(dbId);
          // 更新本地状态中的 id 为数据库生成的 id
          setDrawPaths(prev => prev.map(p => 
            p.id === drawing.id ? { ...p, id: dbId } : p
          ));
        }
      } catch (error) {
        console.error('Error saving drawing:', error);
      }
    }, 500); // 0.5秒防抖
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

  // 处理命令
  const executeCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === 'na' || trimmed === 'newarticle') {
      handleAddArticle();
    } else if (trimmed === 'nr' || trimmed === 'newrepo') {
      handleAddGitHub();
    } else if (trimmed === 'ni' || trimmed === 'newimage') {
      handleAddImage();
    } else if (trimmed === 'w' || trimmed === 'save') {
      handleManualSave();
    }
    setCommand('');
    setVimMode('normal');
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
            if (card) {
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
            setDeleteConfirmId(selectedId);
          }
          return;
        }

        // 移动卡片位置（箭头键）
        if (selectedId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          e.stopPropagation();
          const card = items.find(item => item.id === selectedId);
          if (card) {
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

  const visibleItemsCount = items.filter(i => i.visible !== false).length;

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen overflow-hidden bg-black text-white font-mono relative select-none"
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <Canvas 
        canvas={canvas}
        items={items}
        selectedId={selectedId}
        onUpdateItem={updateItem}
        onFocusItem={bringToFront}
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
        return card ? (
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={drawHistoryIndex > 0}
        canRedo={drawHistoryIndex < drawHistory.length - 1}
      />

      <StatusBar 
        mode={vimMode}
        command={command}
        focusedCardId={selectedId}
        itemCount={visibleItemsCount}
        scale={canvas.scale}
        onCommandChange={(newCommand) => {
          setCommand(newCommand);
        }}
        onCommandExecute={(cmd) => {
          executeCommand(cmd);
        }}
        onModeChange={(targetMode) => {
          if (targetMode === 'normal') {
            // 切换到 Normal 模式
            if (vimMode === 'edit') {
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
              if (card) {
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
