import { useState, useRef, useEffect } from 'react';
import { WindowHeader } from './WindowHeader';
import { ArticleEditor } from './ArticleEditor';
import { ImageViewer } from './ImageViewer';
import { GitHubCard } from './GitHubCard';
import type { GitHubCardData } from './GitHubCard';
import type { CanvasItemProps } from '../types';

export const CanvasItem = ({ item, scale, onUpdate, onFocus, isSelected, forceEditing, onEditChange, allowDrag = true, onDelete, onUnlock, isBeingEdited, editingBy }: CanvasItemProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [internalEditing, setInternalEditing] = useState(false);
  const [isKeyboardMoving, setIsKeyboardMoving] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const keyboardMoveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 使用外部控制的编辑状态，如果没有则使用内部状态
  const isEditing = forceEditing !== undefined ? forceEditing : internalEditing;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); 
    onFocus(item.id);
    
    const target = e.target as HTMLElement;
    const isInteractive = ['INPUT', 'TEXTAREA', 'A', 'BUTTON', 'IMG'].includes(target.tagName);
    const isButton = target.closest('button') !== null;
    const isResizeHandle = target.classList.contains('resize-handle') || target.closest('.resize-handle') !== null;
    
    // 如果锁定或被他人编辑，禁用调整大小和拖动
    if (item.locked || isBeingEdited) {
      return;
    }
    
    if (isResizeHandle) {
      setIsResizing(true);
      startPos.current = { x: e.clientX, y: e.clientY };
      startSize.current = { width: item.width, height: item.height };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    
    if (allowDrag && !isEditing && !isInteractive && !isButton) {
        setIsDragging(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 如果锁定或被他人编辑，禁用调整大小和拖动
    if (item.locked || isBeingEdited) {
      return;
    }
    
    if (isResizing) {
      const dx = (e.clientX - startPos.current.x) / scale;
      const dy = (e.clientY - startPos.current.y) / scale;
      
      const minWidth = 200;
      const minHeight = 150;
      const newWidth = Math.max(minWidth, startSize.current.width + dx);
      const newHeight = Math.max(minHeight, startSize.current.height + dy);
      
      onUpdate(item.id, {
        width: newWidth,
        height: newHeight
      });
      return;
    }
    
    if (!isDragging) return;
    const dx = (e.clientX - startPos.current.x) / scale;
    const dy = (e.clientY - startPos.current.y) / scale;
    
    onUpdate(item.id, {
      x: item.x + dx,
      y: item.y + dy
    });
    
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setIsResizing(false);
    const target = e.currentTarget as HTMLElement;
    if(target.hasPointerCapture(e.pointerId)){
        target.releasePointerCapture(e.pointerId);
    }
  };

  const toggleEdit = () => {
      const newEditing = !isEditing;
      if (forceEditing !== undefined && onEditChange) {
          onEditChange(newEditing);
      } else {
          setInternalEditing(newEditing);
      }
  };

  const getStyles = () => {
    switch(item.type) {
      case 'article': return {
        border: 'border-pink-400', headerBg: 'bg-pink-400', text: 'text-pink-300',
        shadow: isSelected ? 'shadow-[0_0_20px_rgba(236,72,153,0.8),0_0_40px_rgba(236,72,153,0.5)]' : 'shadow-[0_0_10px_rgba(236,72,153,0.4),0_0_20px_rgba(236,72,153,0.2)]'
      };
      case 'image': return {
        border: 'border-purple-400', headerBg: 'bg-purple-400', text: 'text-purple-300',
        shadow: isSelected ? 'shadow-[0_0_20px_rgba(168,85,247,0.8),0_0_40px_rgba(168,85,247,0.5)]' : 'shadow-[0_0_10px_rgba(168,85,247,0.4),0_0_20px_rgba(168,85,247,0.2)]'
      };
      case 'github': return {
        border: 'border-cyan-400', headerBg: 'bg-cyan-400', text: 'text-cyan-300',
        shadow: isSelected ? 'shadow-[0_0_20px_rgba(6,182,212,0.8),0_0_40px_rgba(6,182,212,0.5)]' : 'shadow-[0_0_10px_rgba(6,182,212,0.4),0_0_20px_rgba(6,182,212,0.2)]'
      };
      default: return { border: 'border-gray-400', headerBg: 'bg-gray-400', text: 'text-gray-300', shadow: '' };
    }
  };

  const styles = getStyles();

  // 监听位置变化，检测是否是键盘移动
  const prevPositionRef = useRef({ x: item.x, y: item.y });
  useEffect(() => {
    if (prevPositionRef.current.x !== item.x || prevPositionRef.current.y !== item.y) {
      // 位置改变了
      if (!isDragging && !isResizing) {
        // 不是拖动或调整大小，可能是键盘移动
        setIsKeyboardMoving(true);
        if (keyboardMoveTimerRef.current) {
          clearTimeout(keyboardMoveTimerRef.current);
        }
        // 在动画结束后再关闭过渡，确保动画完整播放
        keyboardMoveTimerRef.current = setTimeout(() => {
          setIsKeyboardMoving(false);
        }, 200); // 200ms 后关闭过渡动画（动画时长是 150ms）
      }
      prevPositionRef.current = { x: item.x, y: item.y };
    }
  }, [item.x, item.y, isDragging, isResizing]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (keyboardMoveTimerRef.current) {
        clearTimeout(keyboardMoveTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        transform: `translate(${item.x}px, ${item.y}px)`,
        width: item.width,
        height: item.height,
        zIndex: isSelected ? 50 : 10,
        transition: (isDragging || isResizing) 
          ? 'none' 
          : 'transform 0.2s ease-out',
        pointerEvents: isBeingEdited ? 'none' : 'auto',
      }}
      className={`absolute flex flex-col bg-gray-900/30 backdrop-blur-md border ${styles.border} ${styles.shadow} transition-shadow duration-300 ${isBeingEdited ? 'ring-2 ring-yellow-400 animate-pulse' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <WindowHeader 
        title={item.title} 
        icon={item.icon} 
        colorClass={`${styles.headerBg} ${styles.text}`}
        borderColor={styles.border}
        onClose={() => {
          if (item.locked) return; // 锁定状态不能删除
          if (onDelete) {
            onDelete(item.id);
          } else {
            onUpdate(item.id, { visible: false });
          }
        }}
        onEdit={undefined}
        isEditing={isEditing}
        onLock={() => {
          if (item.locked) {
            // 如果已锁定，需要先解锁（通过回调触发解锁确认 Modal）
            if (onUnlock) {
              onUnlock(item.id);
            }
          } else {
            // 如果未锁定，直接锁定（不需要密码）
            onUpdate(item.id, { locked: true });
          }
        }}
        isLocked={item.locked}
        editingBy={editingBy}
      />
      <div 
        className="flex-grow overflow-hidden relative"
        onPointerDown={(e) => {
          // 如果点击的不是交互元素（如链接、按钮等），让卡片获得焦点
          const target = e.target as HTMLElement;
          const isInteractive = ['INPUT', 'TEXTAREA', 'A', 'BUTTON', 'IMG'].includes(target.tagName);
          const isButton = target.closest('button') !== null;
          const isLink = target.closest('a') !== null;
          
          // 如果是交互元素，不处理（让子组件自己处理）
          if (!isInteractive && !isButton && !isLink) {
            // 如果不在编辑模式，让卡片获得焦点
            if (!isEditing) {
              onFocus(item.id);
            }
          }
        }}
      >
        {item.type === 'article' && (
            <ArticleEditor 
                content={item.content as string} 
                isEditing={isEditing && !item.locked} 
                onChange={(newContent) => {
                  if (item.locked) return; // 锁定状态不能修改内容
                  // 从内容中提取第一个 H1 作为 title（如果没有 H1，title 为空）
                  const h1Match = newContent.match(/^#\s+(.+)$/m);
                  const newTitle = h1Match ? h1Match[1].trim() : '';
                  onUpdate(item.id, { content: newContent, title: newTitle });
                }} 
            />
        )}
        {item.type === 'image' && <ImageViewer url={item.content as string} />}
        {item.type === 'github' && <GitHubCard data={item.content as GitHubCardData} />}
        
        {/* CRT Overlay */}
        <div className="absolute inset-0 pointer-events-none crt-overlay z-20" />
      </div>
      
      {/* Resize handle */}
      {!item.locked && !isBeingEdited && (
        <div 
          className={`resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize ${styles.headerBg} opacity-50 hover:opacity-100 rounded-tl-lg transition-opacity z-30`}
        />
      )}
    </div>
  );
};

