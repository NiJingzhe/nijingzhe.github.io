import { X, Edit3, Save, Lock, Unlock } from 'lucide-react';
import type { WindowHeaderProps } from '../types';

export const WindowHeader = ({ title, icon: Icon, colorClass, borderColor, onClose, onEdit, isEditing, onLock, isLocked, editingBy }: WindowHeaderProps) => {
  // 根据颜色类确定发光效果
  const getGlowClass = () => {
    if (colorClass.includes('pink')) return 'text-glow-pink';
    if (colorClass.includes('cyan')) return 'text-glow-cyan';
    if (colorClass.includes('emerald')) return 'text-glow-emerald';
    if (colorClass.includes('purple')) return 'text-glow-purple';
    return 'text-glow-white';
  };

  // 根据颜色类生成更暗的背景色
  const getDarkerBg = () => {
    if (colorClass.includes('pink')) return 'bg-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.5)]';
    if (colorClass.includes('cyan')) return 'bg-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.5)]';
    if (colorClass.includes('emerald')) return 'bg-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
    if (colorClass.includes('purple')) return 'bg-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]';
    return 'bg-gray-500/40 shadow-[0_0_15px_rgba(156,163,175,0.5)]';
  };

  return (
    <div className={`flex items-center justify-between px-3 py-2 ${getDarkerBg()} ${borderColor} border-b backdrop-blur-sm ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} select-none group relative z-20`}>
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-visible">
        <Icon width={16} height={16} className={`animate-pulse flex-shrink-0 text-white opacity-90 ${getGlowClass()}`} />
        <span className={`font-mono text-xs font-bold uppercase tracking-widest bg-transparent overflow-visible whitespace-nowrap ${getGlowClass()}`}>{title}</span>
        {editingBy && (
          <span className="text-xs font-mono text-yellow-400 animate-pulse ml-2 flex-shrink-0">
            EDITING BY: {editingBy}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity pl-2">
        {onLock && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault();
              onLock(); 
            }} 
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className={`text-white opacity-80 hover:text-white hover:opacity-100 transition-colors ${isLocked ? 'text-yellow-400 opacity-100' : ''} ${getGlowClass()}`}
            title={isLocked ? "已锁定" : "锁定卡片"}
          >
            {isLocked ? <Lock width={14} height={14} /> : <Unlock width={14} height={14} />}
          </button>
        )}
        {onEdit && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault();
              onEdit(); 
            }} 
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className={`text-white opacity-80 hover:text-white hover:opacity-100 transition-colors ${isEditing ? 'text-white animate-pulse opacity-100' : ''} ${getGlowClass()}`}
            title={isEditing ? "保存模式" : "编辑模式"}
          >
            {isEditing ? <Save width={14} height={14} /> : <Edit3 width={14} height={14} />}
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onClose?.(); }} className={`text-white opacity-80 hover:text-white hover:opacity-100 transition-colors ${getGlowClass()}`}>
          <X width={14} height={14} />
        </button>
      </div>
    </div>
  );
};

