import { useState, useRef } from 'react';
import { CanvasItem } from './CanvasItem';
import { CanvasDrawingLayer } from './CanvasDrawingLayer';
import type { CanvasProps } from '../types';
import { filterPath } from '../utils/pathFilter';

export const Canvas = ({ 
  canvas, 
  items, 
  selectedId, 
  onUpdateItem, 
  onFocusItem,
  onDeleteItem,
  onUnlockItem,
  drawPaths,
  onAddDrawPath,
  onRemoveDrawPath,
  drawMode,
  drawColor,
  drawWidth,
  editingCardId,
  onEditChange,
  vimMode = 'normal',
  onUpdateCanvas,
  onCursorMove
}: CanvasProps) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [erasedPathIds, setErasedPathIds] = useState<Set<number | string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchStart, setPinchStart] = useState<{ distance: number; centerX: number; centerY: number; canvasX: number; canvasY: number; scale: number } | null>(null);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasDrawingLayerRef = useRef<{ redraw: () => void }>(null);

  // 将屏幕坐标转换为画布世界坐标
  const screenToWorld = (screenX: number, screenY: number): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    // 计算相对于容器的坐标
    const containerX = screenX - rect.left;
    const containerY = screenY - rect.top;
    // 转换为世界坐标（考虑平移和缩放）
    const x = (containerX - canvas.x) / canvas.scale;
    const y = (containerY - canvas.y) / canvas.scale;
    return { x, y };
  };

  // 检查点击是否在卡片上
  const isClickOnItem = (x: number, y: number): boolean => {
    return items.some(item => {
      if (item.visible === false) return false;
      return x >= item.x && x <= item.x + item.width &&
             y >= item.y && y <= item.y + item.height;
    });
  };

  // 计算两点之间的距离
  const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  // 计算两个指针的中点
  const getCenterPoint = (p1: { x: number; y: number }, p2: { x: number; y: number }): { x: number; y: number } => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  };

  // 检查点是否在路径附近（用于橡皮擦）
  const isPointNearPath = (x: number, y: number, path: { points: Array<{ x: number; y: number }>; width: number }, threshold: number = 20): boolean => {
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      // 计算点到线段的距离
      const A = x - p1.x;
      const B = y - p1.y;
      const C = p2.x - p1.x;
      const D = p2.y - p1.y;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      
      if (lenSq !== 0) param = dot / lenSq;
      
      let xx: number, yy: number;
      
      if (param < 0) {
        xx = p1.x;
        yy = p1.y;
      } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
      } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
      }
      
      const dx = x - xx;
      const dy = y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= (path.width / 2 + threshold)) {
        return true;
      }
    }
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // 只在主按钮（左键或触控板点击）时开始
    if (e.button !== 0 && e.button !== undefined) return;
    
    // 记录当前指针位置
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    // 检查是否有两个或更多指针（双指手势）
    if (activePointers.current.size >= 2 && onUpdateCanvas && drawMode === 'off' && vimMode === 'normal') {
      e.preventDefault();
      e.stopPropagation();
      
      const pointers = Array.from(activePointers.current.values());
      const p1 = pointers[0];
      const p2 = pointers[1];
      const distance = getDistance(p1.x, p1.y, p2.x, p2.y);
      const center = getCenterPoint(p1, p2);
      
      setIsPinching(true);
      setPinchStart({
        distance,
        centerX: center.x,
        centerY: center.y,
        canvasX: canvas.x,
        canvasY: canvas.y,
        scale: canvas.scale
      });
      
      // 取消拖拽状态
      setIsDragging(false);
      setDragStart(null);
      
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    
    // 检查事件目标是否是卡片或其子元素（由于 Content 层在 Drawing Layer 之上，这个检查可能不会执行到，但保留作为保险）
    const target = e.target as HTMLElement;
    const isOnCard = target.closest('[data-canvas-item]') !== null;
    if (isOnCard) {
      // 点击在卡片上，不处理，让事件传播到卡片
      return;
    }
    
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    // 如果点击在卡片上，不处理（不阻止事件，让事件传播到卡片）
    if (isClickOnItem(worldPos.x, worldPos.y)) {
      // 不调用 preventDefault 和 stopPropagation，让事件继续传播
      return;
    }

    // 如果绘图模式开启，处理绘图逻辑
    if (drawMode !== 'off') {
      e.preventDefault();
      e.stopPropagation();
      
      if (drawMode === 'erase') {
        // 橡皮擦模式：收集要删除的路径（使用 drawWidth 作为橡皮擦半径）
        const pathsToRemove: (number | string)[] = [];
        drawPaths.forEach(path => {
          if (isPointNearPath(worldPos.x, worldPos.y, path, drawWidth) && !erasedPathIds.has(path.id)) {
            pathsToRemove.push(path.id);
          }
        });
        if (pathsToRemove.length > 0) {
          setErasedPathIds(prev => {
            const newSet = new Set(prev);
            pathsToRemove.forEach(id => newSet.add(id));
            return newSet;
          });
        }
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (drawMode === 'draw') {
        // 绘制模式：开始绘制
        setIsDrawing(true);
        setCurrentPath([worldPos]);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }

    // 绘图模式关闭时，在空白位置开始拖动画布
    if (drawMode === 'off' && onUpdateCanvas && vimMode === 'normal') {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragStart({ 
        screenX: e.clientX, 
        screenY: e.clientY, 
        canvasX: canvas.x, 
        canvasY: canvas.y 
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 更新指针位置
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    
    // 在拖动或缩放时，通知父组件更新光标位置
    if ((isDragging || isPinching) && onCursorMove) {
      onCursorMove(e.clientX, e.clientY);
    }
    
    // 双指缩放手势
    if (isPinching && pinchStart && onUpdateCanvas && activePointers.current.size >= 2) {
      e.preventDefault();
      e.stopPropagation();
      
      const pointers = Array.from(activePointers.current.values());
      const p1 = pointers[0];
      const p2 = pointers[1];
      const currentDistance = getDistance(p1.x, p1.y, p2.x, p2.y);
      const scaleRatio = currentDistance / pinchStart.distance;
      const newScale = Math.max(0.1, Math.min(5, pinchStart.scale * scaleRatio));
      
      // 计算当前中心点
      const currentCenter = getCenterPoint(p1, p2);
      
      // 计算缩放中心在世界坐标中的位置
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerContainerX = currentCenter.x - rect.left;
      const centerContainerY = currentCenter.y - rect.top;
      
      // 将缩放中心转换为世界坐标（使用初始缩放）
      const worldCenterX = (centerContainerX - pinchStart.canvasX) / pinchStart.scale;
      const worldCenterY = (centerContainerY - pinchStart.canvasY) / pinchStart.scale;
      
      // 计算新的画布位置，使世界坐标点保持在屏幕上的同一位置
      const newX = centerContainerX - worldCenterX * newScale;
      const newY = centerContainerY - worldCenterY * newScale;
      
      onUpdateCanvas({
        x: newX,
        y: newY,
        scale: newScale
      });
      return;
    }
    
    // 拖动画布
    if (isDragging && dragStart && onUpdateCanvas && !isPinching) {
      e.preventDefault();
      e.stopPropagation();
      const deltaX = e.clientX - dragStart.screenX;
      const deltaY = e.clientY - dragStart.screenY;
      onUpdateCanvas({
        x: dragStart.canvasX + deltaX,
        y: dragStart.canvasY + deltaY
      });
      return;
    }

    if (drawMode === 'off') return;
    
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    if (drawMode === 'erase' && e.buttons === 1) {
      // 橡皮擦模式：持续收集要删除的路径（使用 drawWidth 作为橡皮擦半径）
      e.preventDefault();
      e.stopPropagation();
      const pathsToRemove: (number | string)[] = [];
      drawPaths.forEach(path => {
        if (isPointNearPath(worldPos.x, worldPos.y, path, drawWidth) && !erasedPathIds.has(path.id)) {
          pathsToRemove.push(path.id);
        }
      });
      if (pathsToRemove.length > 0) {
        setErasedPathIds(prev => {
          const newSet = new Set(prev);
          pathsToRemove.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    } else if (drawMode === 'draw' && isDrawing) {
      // 绘制模式：继续绘制
      e.preventDefault();
      e.stopPropagation();
      setCurrentPath(prev => {
        // 避免重复添加相同的点
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && Math.abs(lastPoint.x - worldPos.x) < 0.1 && Math.abs(lastPoint.y - worldPos.y) < 0.1) {
          return prev;
        }
        return [...prev, worldPos];
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    
    // 移除指针
    activePointers.current.delete(e.pointerId);
    
    // 如果只剩一个或没有指针，结束缩放手势
    if (isPinching && activePointers.current.size < 2) {
      e.preventDefault();
      setIsPinching(false);
      setPinchStart(null);
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      // 如果只剩一个指针，可以转为拖拽
      if (activePointers.current.size === 1 && onUpdateCanvas && drawMode === 'off' && vimMode === 'normal') {
        const remainingPointer = Array.from(activePointers.current.values())[0];
        setIsDragging(true);
        setDragStart({
          screenX: remainingPointer.x,
          screenY: remainingPointer.y,
          canvasX: canvas.x,
          canvasY: canvas.y
        });
      }
      return;
    }
    
    // 结束拖动画布
    if (isDragging && activePointers.current.size === 0) {
      e.preventDefault();
      setIsDragging(false);
      setDragStart(null);
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }
    
    if (drawMode === 'erase') {
      // 橡皮擦模式：一次性删除所有收集到的路径
      e.preventDefault();
      if (erasedPathIds.size > 0) {
        erasedPathIds.forEach(id => onRemoveDrawPath(id));
        setErasedPathIds(new Set());
      }
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      return;
    }
    
    if (!isDrawing) return;
    
    e.preventDefault();
    if (currentPath.length > 1) {
      const pathId = Date.now();
      // 应用滤波：平滑轨迹并减少点的数量
      const filteredPoints = filterPath(currentPath);
      onAddDrawPath({
        id: pathId,
        points: filteredPoints,
        color: drawColor,
        width: drawWidth
      });
    }
    
    setIsDrawing(false);
    setCurrentPath([]);
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };


  return (
    <>
      {/* Infinite Grid */}
      <div 
        className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <div className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] opacity-30"
          style={{ backgroundImage: 'linear-gradient(to right, #555 1px, transparent 1px), linear-gradient(to bottom, #555 1px, transparent 1px)', backgroundSize: '100px 100px' }}
        />
        <div className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] opacity-20"
          style={{ backgroundImage: 'linear-gradient(to right, #0fffff 1px, transparent 1px), linear-gradient(to bottom, #ff0fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
      </div>

      {/* Drawing Layer (Canvas) */}
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{ 
          pointerEvents: drawMode !== 'off' || (vimMode === 'normal' && onUpdateCanvas) ? 'auto' : 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <CanvasDrawingLayer
          ref={canvasDrawingLayerRef}
          drawPaths={drawPaths}
          currentPath={currentPath}
          isDrawing={isDrawing}
          canvas={canvas}
          drawColor={drawColor}
          drawWidth={drawWidth}
          containerRef={containerRef}
        />
      </div>

      {/* Content */}
      <div 
        className="absolute inset-0 w-full h-full transform-gpu transition-transform duration-75 ease-out z-20"
        style={{
          transform: `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        {items.filter(i => i.visible !== false).map(item => (
          <div key={item.id} style={{ pointerEvents: 'auto' }} data-canvas-item>
          <CanvasItem 
            item={item} 
            scale={canvas.scale}
            onUpdate={onUpdateItem}
            onFocus={onFocusItem}
            isSelected={selectedId === item.id}
            forceEditing={editingCardId === item.id ? true : undefined}
            onEditChange={(editing) => onEditChange?.(item.id, editing)}
            allowDrag={vimMode === 'normal' && !item.locked}
            onDelete={onDeleteItem}
            onUnlock={onUnlockItem}
          />
          </div>
        ))}
      </div>

    </>
  );
};

