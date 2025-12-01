import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { DrawPath, CanvasState, RemoteDrawingPath } from '../types';

interface CanvasDrawingLayerProps {
  drawPaths: DrawPath[];
  currentPath: Array<{ x: number; y: number }>;
  isDrawing: boolean;
  canvas: CanvasState;
  drawColor: string;
  drawWidth: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export interface CanvasDrawingLayerRef {
  redraw: () => void;
}

export const CanvasDrawingLayer = forwardRef<CanvasDrawingLayerRef, CanvasDrawingLayerProps>(
  ({ drawPaths, currentPath, isDrawing, canvas, drawColor, drawWidth, containerRef }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastCanvasStateRef = useRef<CanvasState>(canvas);
    const pathBoundingBoxCache = useRef<Map<number | string, { minX: number; minY: number; maxX: number; maxY: number }>>(new Map());
    const isDraggingRef = useRef(false);
    const lastRedrawTimeRef = useRef<number>(0);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 计算视口边界（世界坐标）
    const getViewportBounds = (): { minX: number; minY: number; maxX: number; maxY: number } => {
      if (!containerRef.current) {
        return { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
      }
      const rect = containerRef.current.getBoundingClientRect();
      const minX = (-canvas.x) / canvas.scale;
      const minY = (-canvas.y) / canvas.scale;
      const maxX = (rect.width - canvas.x) / canvas.scale;
      const maxY = (rect.height - canvas.y) / canvas.scale;
      return { minX, minY, maxX, maxY };
    };

    // 计算路径的边界框（世界坐标，带缓存）
    const getPathBoundingBox = (path: DrawPath): { minX: number; minY: number; maxX: number; maxY: number } => {
      // 检查缓存
      const cached = pathBoundingBoxCache.current.get(path.id);
      if (cached) {
        return cached;
      }
      
      if (path.points.length === 0) {
        const bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        pathBoundingBoxCache.current.set(path.id, bbox);
        return bbox;
      }
      
      let minX = path.points[0].x;
      let minY = path.points[0].y;
      let maxX = path.points[0].x;
      let maxY = path.points[0].y;
      
      for (const point of path.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      
      // 考虑 stroke width 和 glow 效果（需要更大的 padding）
      const padding = (path.width / 2) + 20; // 增加 padding 以包含 glow 效果
      const bbox = {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding
      };
      
      // 缓存结果
      pathBoundingBoxCache.current.set(path.id, bbox);
      return bbox;
    };

    // 检查路径是否在视口内
    const isPathVisible = (path: DrawPath, viewport: { minX: number; minY: number; maxX: number; maxY: number }): boolean => {
      const bbox = getPathBoundingBox(path);
      return !(bbox.maxX < viewport.minX || bbox.minX > viewport.maxX || 
               bbox.maxY < viewport.minY || bbox.minY > viewport.maxY);
    };

    // 构建路径（只构建一次，然后重复使用）
    const buildPath = (ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) => {
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    };

    // 绘制单个路径（带 neon-glow 效果，单层）
    const drawPathWithGlow = (ctx: CanvasRenderingContext2D, path: DrawPath) => {
      if (path.points.length === 0) return;
      
      // 构建路径一次
      buildPath(ctx, path.points);
      
      // 设置基础样式
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // 单层辉光：使用较大的模糊半径和较高的透明度
      ctx.shadowBlur = 24;
      ctx.shadowColor = path.color;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      
      // 清晰主路径
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    };
    
    // 绘制当前正在绘制的路径（单层 glow）
    const drawCurrentPath = (ctx: CanvasRenderingContext2D, path: Array<{ x: number; y: number }>, color: string, width: number) => {
      if (path.length === 0) return;
      
      // 构建路径一次
      buildPath(ctx, path);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // 单层辉光
      ctx.shadowBlur = 24;
      ctx.shadowColor = color;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      
      // 清晰主路径
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    };

    // 初始化离屏 Canvas
    const initOffscreenCanvas = () => {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = 20000; // 足够大的尺寸
        offscreenCanvasRef.current.height = 20000;
        offscreenCtxRef.current = offscreenCanvasRef.current.getContext('2d');
        if (offscreenCtxRef.current) {
          // 将原点移到中心
          offscreenCtxRef.current.translate(10000, 10000);
        }
      }
    };

    // 主绘制函数
    const redraw = () => {
      const canvasEl = canvasRef.current;
      if (!canvasEl || !containerRef.current) return;
      
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;
      
      // 更新 Canvas 尺寸以匹配容器
      const rect = containerRef.current.getBoundingClientRect();
      if (canvasEl.width !== rect.width || canvasEl.height !== rect.height) {
        canvasEl.width = rect.width;
        canvasEl.height = rect.height;
      }
      
      // 先清空画布
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      
      // 应用变换
      ctx.save();
      ctx.translate(canvas.x, canvas.y);
      ctx.scale(canvas.scale, canvas.scale);
      
      // 计算视口并获取可见路径
      const viewport = getViewportBounds();
      const pathsToDraw = drawPaths.filter(path => isPathVisible(path, viewport));
      
      // 始终使用完整版辉光（性能优化通过视口裁剪和节流实现）
      for (const path of pathsToDraw) {
        drawPathWithGlow(ctx, path);
      }
      
      // 绘制当前正在绘制的路径
      if (isDrawing && currentPath.length > 0) {
        drawCurrentPath(ctx, currentPath, drawColor, drawWidth);
      }
      
      ctx.restore();
    };

    // 使用 requestAnimationFrame 优化重绘，添加节流
    const scheduleRedraw = (throttle: boolean = false) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      
      // 如果启用节流，限制重绘频率（拖拽时使用）
      if (throttle) {
        const now = performance.now();
        if (now - lastRedrawTimeRef.current < 16) { // 约 60fps
          return;
        }
        lastRedrawTimeRef.current = now;
      }
      
      rafIdRef.current = requestAnimationFrame(() => {
        redraw();
        rafIdRef.current = null;
      });
    };

    // 暴露 redraw 方法
    useImperativeHandle(ref, () => ({
      redraw: scheduleRedraw
    }));

    // 当画布状态改变时重绘
    useEffect(() => {
      const canvasChanged = 
        lastCanvasStateRef.current.x !== canvas.x ||
        lastCanvasStateRef.current.y !== canvas.y ||
        lastCanvasStateRef.current.scale !== canvas.scale;
      
      if (canvasChanged) {
        // 检测是否是纯拖拽（只有位置变化，缩放不变）
        const isOnlyDragging = 
          (lastCanvasStateRef.current.x !== canvas.x || lastCanvasStateRef.current.y !== canvas.y) &&
          lastCanvasStateRef.current.scale === canvas.scale;
        
        // 检测是否是缩放（缩放值改变）
        const isZooming = lastCanvasStateRef.current.scale !== canvas.scale;
        
        // 清除之前的定时器
        if (dragEndTimerRef.current) {
          clearTimeout(dragEndTimerRef.current);
          dragEndTimerRef.current = null;
        }
        
        if (isOnlyDragging) {
          // 纯拖拽：使用节流以保持流畅，但保持辉光
          isDraggingRef.current = true;
          scheduleRedraw(true); // 使用节流
        } else if (isZooming) {
          // 缩放：实时更新，保持辉光
          isDraggingRef.current = true;
          scheduleRedraw(false); // 缩放时不节流，保证实时性
        } else {
          // 停止拖拽/缩放：恢复正常更新频率
          isDraggingRef.current = false;
          scheduleRedraw(false);
        }
        
        // 更新状态
        lastCanvasStateRef.current = { ...canvas };
      }
    }, [canvas.x, canvas.y, canvas.scale]);

    // 当路径改变时重绘并清除缓存
    useEffect(() => {
      pathBoundingBoxCache.current.clear();
      scheduleRedraw();
    }, [drawPaths]);

    // 当当前绘制路径改变时重绘（实时预览，不节流）
    useEffect(() => {
      if (isDrawing) {
        scheduleRedraw(false);
      }
    }, [currentPath, isDrawing, drawColor, drawWidth]);

    // 组件挂载时初始化
    useEffect(() => {
      initOffscreenCanvas();
      scheduleRedraw();
      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        if (dragEndTimerRef.current !== null) {
          clearTimeout(dragEndTimerRef.current);
        }
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          pointerEvents: 'none',
        }}
      />
    );
  }
);

CanvasDrawingLayer.displayName = 'CanvasDrawingLayer';

