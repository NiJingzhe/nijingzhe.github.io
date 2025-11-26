import { Undo2, Redo2, Eraser } from 'lucide-react';
import type { DockProps } from '../types';

const DRAW_COLORS = [
  '#00ffff', // cyan
  '#ff00ff', // magenta
  '#ffff00', // yellow
  '#00ff00', // green
  '#ff0000', // red
  '#0000ff', // blue
  '#ffffff', // white
];

export const Dock = ({ 
  drawMode,
  drawColor,
  drawWidth,
  onDrawColorChange,
  onDrawWidthChange,
  onDrawModeChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}: DockProps) => {
  // 只在 draw 或 erase mode 时显示
  if (drawMode === 'off') {
    return null;
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div 
        className="flex gap-2 p-2 bg-black/95 backdrop-blur-md border-2 border-cyan-400 shadow-[0_0_40px_rgba(0,255,255,0.8),0_0_80px_rgba(0,255,255,0.4)]"
        style={{
          clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)'
        }}
      >
        {/* 绘图控制面板 */}
        <div className="flex items-center gap-3">
            {/* 颜色选择 */}
            <div 
              className="flex gap-1.5 p-1 bg-black/80 border-2 border-cyan-400/70 shadow-[0_0_15px_rgba(0,255,255,0.5)]"
              style={{
                clipPath: 'polygon(3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px), 0 3px)'
              }}
            >
              {DRAW_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => {
                    onDrawColorChange(color);
                    if (onDrawModeChange && drawMode !== 'draw') {
                      onDrawModeChange('draw');
                    }
                  }}
                  className={`relative w-7 h-7 transition-all border-2 ${
                    drawColor === color && drawMode === 'draw'
                      ? 'scale-110 border-cyan-400' 
                      : 'hover:scale-105 border-transparent hover:border-cyan-500/50'
                  }`}
                  style={{ 
                    backgroundColor: color,
                    clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)',
                    boxShadow: drawColor === color && drawMode === 'draw'
                      ? `0 0 20px ${color}, 0 0 40px ${color}cc, 0 0 60px ${color}80, inset 0 0 10px ${color}ff`
                      : `0 0 8px ${color}aa, 0 0 15px ${color}60`
                  }}
                  title={`选择颜色: ${color}`}
                >
                  {drawColor === color && drawMode === 'draw' && (
                    <div 
                      className="absolute inset-0 border-2 border-cyan-400 animate-pulse"
                      style={{
                        clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)'
                      }}
                    />
                  )}
                </button>
              ))}
              {/* 橡皮擦按钮 */}
              <button
                onClick={() => {
                  if (onDrawModeChange) {
                    onDrawModeChange(drawMode === 'erase' ? 'draw' : 'erase');
                  }
                }}
                className={`relative w-7 h-7 transition-all border-2 flex items-center justify-center ${
                  drawMode === 'erase'
                    ? 'scale-110 border-cyan-400 bg-gray-800' 
                    : 'hover:scale-105 border-transparent hover:border-cyan-500/50 bg-gray-900'
                }`}
                style={{ 
                  clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)',
                  boxShadow: drawMode === 'erase'
                    ? '0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3), 0 0 60px rgba(255,255,255,0.2)'
                    : '0 0 8px rgba(255,255,255,0.3), 0 0 15px rgba(255,255,255,0.2)'
                }}
                title="橡皮擦"
              >
                <Eraser 
                  width={16} 
                  height={16} 
                  className={drawMode === 'erase' ? 'text-cyan-400' : 'text-gray-400'}
                />
                {drawMode === 'erase' && (
                  <div 
                    className="absolute inset-0 border-2 border-cyan-400 animate-pulse"
                    style={{
                      clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)'
                    }}
                  />
                )}
              </button>
            </div>

            {/* 粗细控制 */}
            <div 
              className="flex items-center gap-2 min-w-[200px] px-3 py-1.5 bg-black/80 border-2 border-cyan-400/70 shadow-[0_0_15px_rgba(0,255,255,0.5)]"
              style={{
                clipPath: 'polygon(3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px), 0 3px)'
              }}
            >
              <span className="text-xs text-cyan-300 font-bold tracking-wider whitespace-nowrap text-glow-cyan">WIDTH</span>
              <div className="flex-1 relative min-w-[100px]">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={drawWidth}
                  onChange={(e) => onDrawWidthChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-900 appearance-none cursor-pointer range-square-thumb"
                  style={{
                    background: `linear-gradient(to right, 
                      #00ffff 0%, 
                      #00ffff ${(drawWidth - 1) / 9 * 100}%, 
                      #1a1a1a ${(drawWidth - 1) / 9 * 100}%, 
                      #1a1a1a 100%
                    )`,
                    boxShadow: `0 0 15px rgba(0,255,255,0.8), 0 0 30px rgba(0,255,255,0.5)`
                  }}
                />
              </div>
              <span className="text-xs text-cyan-300 font-mono font-bold w-6 text-right tabular-nums whitespace-nowrap text-glow-cyan">{drawWidth}</span>
            </div>

          {/* Undo/Redo */}
          {onUndo && onRedo && (
            <div className="flex items-center gap-2 border-l-2 border-cyan-400/70 pl-3 shadow-[0_0_10px_rgba(0,255,255,0.3)]">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2 transition-all border-2 ${
                  canUndo
                    ? 'bg-cyan-500/40 text-cyan-300 hover:bg-cyan-500/60 hover:text-cyan-100 border-cyan-400/70 hover:border-cyan-300'
                    : 'bg-black/60 text-gray-600 border-gray-700/50 cursor-not-allowed'
                }`}
                style={{
                  clipPath: 'polygon(3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px), 0 3px)',
                  boxShadow: canUndo ? '0 0 15px rgba(0, 255, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.3)' : 'none'
                }}
                title="撤销"
              >
                <Undo2 width={20} height={20} />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2 transition-all border-2 ${
                  canRedo
                    ? 'bg-cyan-500/40 text-cyan-300 hover:bg-cyan-500/60 hover:text-cyan-100 border-cyan-400/70 hover:border-cyan-300'
                    : 'bg-black/60 text-gray-600 border-gray-700/50 cursor-not-allowed'
                }`}
                style={{
                  clipPath: 'polygon(3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px), 0 3px)',
                  boxShadow: canRedo ? '0 0 15px rgba(0, 255, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.3)' : 'none'
                }}
                title="重做"
              >
                <Redo2 width={20} height={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

