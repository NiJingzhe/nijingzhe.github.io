import { useEffect, useRef } from 'react';
import { MousePointer } from 'lucide-react';

interface CustomCursorProps {
  x: number;
  y: number;
  color: string;
  userName?: string | null;
  isVisible?: boolean;
}

export const CustomCursor = ({ x, y, color, userName, isVisible = true }: CustomCursorProps) => {
  const divRef = useRef<HTMLDivElement>(null);

  // 使用 useEffect 直接更新 DOM，确保位置立即更新
  useEffect(() => {
    if (divRef.current) {
      divRef.current.style.left = `${x}px`;
      divRef.current.style.top = `${y}px`;
    }
  }, [x, y]);

  if (!isVisible) return null;

  return (
    <div
      ref={divRef}
      className="fixed pointer-events-none z-50"
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
        willChange: 'transform, left, top',
      }}
    >
      <MousePointer
        size={20}
        color={color}
        style={{
          filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`,
        }}
      />
      {userName && (
        <div
          className="absolute left-4 top-0 text-xs font-mono whitespace-nowrap"
          style={{
            color: color,
            textShadow: `
              -1px -1px 0 rgba(0, 0, 0, 0.8),
              1px -1px 0 rgba(0, 0, 0, 0.8),
              -1px 1px 0 rgba(0, 0, 0, 0.8),
              1px 1px 0 rgba(0, 0, 0, 0.8),
              0 0 4px ${color}
            `,
          }}
        >
          {userName}
        </div>
      )}
    </div>
  );
};

