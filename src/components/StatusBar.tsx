import type { VimMode } from '../types';

interface StatusBarProps {
  mode: VimMode;
  command: string;
  focusedCardId: string | null;
  itemCount: number;
  scale: number;
}

export const StatusBar = ({ mode, command, focusedCardId, itemCount, scale }: StatusBarProps) => {
  const modeColors = {
    normal: { bg: 'bg-cyan-600', text: 'text-white', label: 'NORMAL' },
    edit: { bg: 'bg-yellow-600', text: 'text-black', label: 'EDIT' },
    draw: { bg: 'bg-purple-600', text: 'text-white', label: 'DRAW' },
    command: { bg: 'bg-green-600', text: 'text-white', label: 'COMMAND' }
  };

  const currentMode = modeColors[mode];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-black/95 border-t-2 border-cyan-400/70 shadow-[0_0_20px_rgba(0,255,255,0.5)] z-50 flex items-center font-mono text-xs">
      {/* Mode Indicator */}
      <div className={`px-3 h-full flex items-center ${currentMode.bg} ${currentMode.text} font-bold border-r-2 border-cyan-400/70 shadow-[0_0_10px_rgba(0,255,255,0.3)]`}>
        {currentMode.label}
      </div>

      {/* Command Input (only in command mode) */}
      {mode === 'command' && (
        <div className="flex-1 px-2 flex items-center">
          <span className="text-cyan-300 mr-2 text-glow-cyan">:</span>
          <span className="text-white text-glow-white whitespace-pre">{command}</span>
          <span className="ml-1 w-0.5 h-4 bg-cyan-300 animate-pulse shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
        </div>
      )}

      {/* Status Info */}
      <div className="ml-auto px-3 flex items-center gap-4 text-gray-300">
        {focusedCardId && (
          <span className="text-cyan-300 text-glow-cyan">CARD #{focusedCardId}</span>
        )}
        <span>ITEMS: {itemCount}</span>
        <span>ZOOM: {(scale * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

