import { useEffect, useState } from 'react';
import { CustomCursor } from './CustomCursor';
import type { CanvasState } from '../types';
import type { Cursor } from '../utils/db';

interface CursorManagerProps {
  cursors: Cursor[];
  currentUserId: string | null;
  canvas: CanvasState;
  containerRef: React.RefObject<HTMLDivElement>;
  userColors: Map<string, string>;
  userNames: Map<string, string | null>;
  // 自己的光标位置
  myCursorPosition: { x: number; y: number } | null;
  myCursorColor: string;
}

export const CursorManager = ({
  cursors,
  currentUserId,
  canvas,
  containerRef,
  userColors,
  userNames,
  myCursorPosition,
  myCursorColor
}: CursorManagerProps) => {
  const [otherCursors, setOtherCursors] = useState<Array<{
    id: string;
    x: number;
    y: number;
    color: string;
    userName: string | null;
  }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newCursors: Array<{
      id: string;
      x: number;
      y: number;
      color: string;
      userName: string | null;
    }> = [];

    cursors.forEach((cursor) => {
      // 跳过自己的光标
      if (cursor.visitor_uid === currentUserId) return;

      const color = userColors.get(cursor.visitor_uid) || '#00ffff';
      const userName = userNames.get(cursor.visitor_uid) || null;

      // 计算屏幕坐标（CustomCursor 使用 fixed 定位，需要相对于视口的坐标）
      let screenX: number;
      let screenY: number;

      if (cursor.canvas_x !== null && cursor.canvas_y !== null) {
        // 使用画布世界坐标转换为屏幕坐标
        // canvas.x 和 canvas.y 是相对于容器的偏移
        // 需要将世界坐标转换为屏幕坐标：world * scale + canvas_offset + container_position
        screenX = cursor.canvas_x * canvas.scale + canvas.x + rect.left;
        screenY = cursor.canvas_y * canvas.scale + canvas.y + rect.top;
      } else {
        // 使用屏幕坐标（cursor.x 和 cursor.y 已经是相对于视口的坐标）
        screenX = cursor.x;
        screenY = cursor.y;
      }

      // 检查光标是否在视口内（可以稍微放宽范围，让边缘的光标也能显示）
      const margin = 50;
      if (screenX < -margin || screenX > rect.width + margin || 
          screenY < -margin || screenY > rect.height + margin) {
        return;
      }

      newCursors.push({
        id: cursor.visitor_uid,
        x: screenX,
        y: screenY,
        color,
        userName
      });
    });

    setOtherCursors(newCursors);
  }, [cursors, currentUserId, canvas, containerRef, userColors, userNames]);

  return (
    <>
      {/* 自己的光标 */}
      {myCursorPosition && (
        <CustomCursor
          x={myCursorPosition.x}
          y={myCursorPosition.y}
          color={myCursorColor}
          isVisible={true}
        />
      )}

      {/* 其他用户的光标 */}
      {otherCursors.map((cursor) => (
        <CustomCursor
          key={cursor.id}
          x={cursor.x}
          y={cursor.y}
          color={cursor.color}
          userName={cursor.userName}
          isVisible={true}
        />
      ))}
    </>
  );
};

