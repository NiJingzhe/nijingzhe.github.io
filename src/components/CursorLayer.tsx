import { useEffect, useRef } from 'react';
import type { CanvasState } from '../types';
import type { Cursor } from '../utils/db';

// MousePointer 图标的 SVG 路径数据（来自 lucide-react）
const MOUSE_POINTER_PATH = 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z M13 13l6 6';

// 在 Canvas 上绘制 MousePointer 图标
const drawMousePointerIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24); // lucide 图标是 24x24 的 viewBox
  
  // 绘制阴影效果
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // 绘制路径
  const path = new Path2D(MOUSE_POINTER_PATH);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // 绘制描边
  ctx.stroke(path);
  
  ctx.restore();
};

interface CursorLayerProps {
  cursors: Cursor[];
  currentUserId: string | null;
  canvas: CanvasState;
  containerRef: React.RefObject<HTMLDivElement>;
  userColors: Map<string, string>;
  userNames: Map<string, string | null>;
}

export const CursorLayer = ({
  cursors,
  currentUserId,
  canvas,
  containerRef,
  userColors,
  userNames
}: CursorLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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

    // 清空画布
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // 绘制所有光标（排除自己的光标，因为会单独显示）
    cursors.forEach((cursor) => {
      if (cursor.visitor_uid === currentUserId) return;

      const color = userColors.get(cursor.visitor_uid) || '#00ffff';
      const userName = userNames.get(cursor.visitor_uid) || null;

      // 使用画布坐标（canvas_x, canvas_y）如果可用，否则使用屏幕坐标（x, y）
      let screenX: number;
      let screenY: number;

      if (cursor.canvas_x !== null && cursor.canvas_y !== null) {
        // 使用画布世界坐标转换为屏幕坐标
        screenX = cursor.canvas_x * cursor.canvas_scale + canvas.x;
        screenY = cursor.canvas_y * cursor.canvas_scale + canvas.y;
      } else {
        // 使用屏幕坐标（直接使用）
        screenX = cursor.x;
        screenY = cursor.y;
      }

      // 检查光标是否在视口内
      if (screenX < 0 || screenX > rect.width || screenY < 0 || screenY > rect.height) {
        return;
      }

      // 绘制光标图标（使用 MousePointer 图标）
      drawMousePointerIcon(ctx, screenX, screenY, 20, color);

      // 绘制用户名标签
      if (userName) {
        ctx.save();
        ctx.font = '12px monospace';
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const textX = screenX + 12;
        const textY = screenY - 20;
        const text = userName;

        // 绘制文字描边（黑色背景）
        ctx.strokeText(text, textX, textY);
        // 绘制文字填充
        ctx.fillText(text, textX, textY);

        ctx.restore();
      }
    });
  }, [cursors, currentUserId, canvas, containerRef, userColors, userNames]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 30 }}
    />
  );
};
