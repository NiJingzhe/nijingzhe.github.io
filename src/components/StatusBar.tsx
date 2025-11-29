import { useState, useRef, useEffect } from 'react';
import type { VimMode } from '../types';

interface StatusBarProps {
  mode: VimMode;
  command: string;
  focusedCardId: string | null;
  itemCount: number;
  scale: number;
  onlineCount?: number;
  totalVisits?: number;
  todayVisits?: number;
  userName?: string | null;
  onModeChange?: (mode: 'normal' | 'edit' | 'draw' | 'command') => void;
  onCommandChange?: (command: string) => void;
  onCommandExecute?: (command: string) => void;
}

export const StatusBar = ({ 
  mode, 
  command, 
  focusedCardId, 
  itemCount, 
  scale, 
  onlineCount = 0,
  totalVisits = 0,
  todayVisits = 0,
  userName = null,
  onModeChange, 
  onCommandChange, 
  onCommandExecute 
}: StatusBarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const modeColors = {
    normal: { bg: 'bg-cyan-600', text: 'text-white', label: 'NORMAL' },
    edit: { bg: 'bg-yellow-600', text: 'text-black', label: 'EDIT' },
    draw: { bg: 'bg-purple-600', text: 'text-white', label: 'DRAW' },
    command: { bg: 'bg-green-600', text: 'text-white', label: 'COMMAND' }
  };

  const currentMode = modeColors[mode];
  const canEdit = focusedCardId !== null;

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  const handleModeClick = (targetMode: 'normal' | 'edit' | 'draw' | 'command') => {
    if (targetMode === 'edit' && !canEdit) {
      return; // 禁用状态，不处理
    }
    onModeChange?.(targetMode);
    setIsMenuOpen(false);
  };

  // 当进入 command 模式时，自动聚焦 input
  useEffect(() => {
    if (mode === 'command' && commandInputRef.current) {
      // 延迟聚焦，确保 DOM 已更新
      setTimeout(() => {
        commandInputRef.current?.focus();
      }, 0);
    }
  }, [mode]);

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommandExecute?.(command);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onModeChange?.('normal');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-6 bg-black/95 border-t border-cyan-400/70 shadow-[0_0_20px_rgba(0,255,255,0.5)] z-50 flex items-center font-mono text-xs">
      {/* Mode Indicator with Menu */}
      <div className="relative h-full">
        <div
          ref={buttonRef}
          className={`px-2.5 h-full flex items-center ${currentMode.bg} ${currentMode.text} font-bold border-r border-cyan-400/70 shadow-[0_0_10px_rgba(0,255,255,0.3)] cursor-pointer hover:opacity-80 transition-opacity text-xs`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {currentMode.label}
        </div>
        
        {/* Mode Selection Menu */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute bottom-full left-0 mb-0.5 bg-black/95 border border-cyan-400/70 shadow-[0_0_20px_rgba(0,255,255,0.5)] min-w-[120px]"
          >
            {/* 在 Normal 模式下显示 Edit、Draw 和 Command */}
            {mode === 'normal' && (
              <>
                {/* Edit Option */}
                <div
                  className={`px-3 py-1.5 cursor-pointer transition-all ${
                    canEdit
                      ? 'bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 hover:text-orange-300'
                      : 'bg-gray-800/50 text-gray-500 cursor-not-allowed opacity-50'
                  }`}
                  onClick={() => handleModeClick('edit')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-orange-600 rounded-full" />
                    <span className="font-bold text-xs">EDIT</span>
                  </div>
                </div>
                
                {/* Draw Option */}
                <div
                  className="px-3 py-1.5 cursor-pointer bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 transition-all"
                  onClick={() => handleModeClick('draw')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-purple-600 rounded-full" />
                    <span className="font-bold text-xs">DRAW</span>
                  </div>
                </div>
                
                {/* Command Option */}
                <div
                  className="px-3 py-1.5 cursor-pointer bg-green-600/20 hover:bg-green-600/40 text-green-400 hover:text-green-300 transition-all"
                  onClick={() => handleModeClick('command')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-green-600 rounded-full" />
                    <span className="font-bold text-xs">COMMAND</span>
                  </div>
                </div>
              </>
            )}
            
            {/* 在 Edit、Draw 或 Command 模式下只显示 Normal */}
            {(mode === 'edit' || mode === 'draw' || mode === 'command') && (
              <div
                className="px-3 py-1.5 cursor-pointer bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 hover:text-cyan-300 transition-all"
                onClick={() => handleModeClick('normal')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-cyan-600 rounded-full" />
                  <span className="font-bold text-xs">NORMAL</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Command Input (only in command mode) */}
      {mode === 'command' && (
        <div className="flex-1 px-2 flex items-center">
          <span className="text-cyan-300 mr-2 text-glow-cyan">:</span>
          <input
            ref={commandInputRef}
            type="text"
            value={command}
            onChange={(e) => onCommandChange?.(e.target.value)}
            onKeyDown={handleCommandKeyDown}
            className="flex-1 bg-transparent text-white text-glow-white outline-none border-none font-mono text-xs"
            placeholder=""
            autoFocus
          />
        </div>
      )}

      {/* Status Info */}
      <div className="ml-auto px-2.5 flex items-center gap-3 text-gray-300 text-xs">
        {userName && (
          <span className="text-cyan-300 text-glow-cyan">@{userName}</span>
        )}
        {focusedCardId && (
          <span className="text-cyan-300 text-glow-cyan">CARD #{focusedCardId.slice(0, 8)}</span>
        )}
        <span className="text-green-400">ONLINE: {onlineCount ?? 0}</span>
        <span>VISITS: {(totalVisits ?? 0).toLocaleString()}</span>
        <span>TODAY: {(todayVisits ?? 0).toLocaleString()}</span>
        <span>ITEMS: {itemCount}</span>
        <span>ZOOM: {(scale * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

