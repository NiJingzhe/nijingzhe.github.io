import { useRef } from 'react';
import { RetroMarkdown } from './RetroMarkdown';
import type { ArticleEditorProps } from '../types';

export const ArticleEditor = ({ content, onChange, isEditing }: ArticleEditorProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) return;
        
        // 编辑模式下，直接阻止事件传播到 Canvas
        if (isEditing) {
            e.stopPropagation();
            return;
        }
        
        // 阅读模式下，检查滚动边界
        const container = scrollContainerRef.current;
        if (!container) {
            e.stopPropagation();
            return;
        }
        
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtTop = scrollTop <= 1; // 使用 <= 1 来处理浮点数精度问题
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
        
        const scrollingUp = e.deltaY < 0;
        const scrollingDown = e.deltaY > 0;
        
        // 如果滚动到边界且继续向边界方向滚动（惯性滚动），阻止默认行为和事件传播
        if ((isAtTop && scrollingUp) || (isAtBottom && scrollingDown)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // 正常滚动时，只阻止事件传播到 Canvas
        e.stopPropagation();
    };

    if (isEditing) {
        return (
            <div className="w-full h-full relative">
                <textarea 
                    ref={textareaRef}
                    className="w-full h-full bg-gray-950/30 backdrop-blur-md text-emerald-400 font-mono text-sm p-4 outline-none resize-none border-none focus:ring-1 focus:ring-emerald-500/50 z-30 relative text-glow-emerald"
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    onWheel={handleWheel}
                    spellCheck={false}
                    onPointerDown={(e) => e.stopPropagation()}
                    autoFocus
                />
                {/* CRT Overlay */}
                <div className="absolute inset-0 crt-overlay z-40" />
            </div>
        );
    }
    return (
        <div 
            ref={scrollContainerRef}
            className="p-5 h-full overflow-y-auto bg-gray-950/30 backdrop-blur-md text-gray-100 scrollbar-thin scrollbar-thumb-pink-600 scrollbar-track-gray-900 cursor-text z-30 relative"
            data-scrollable
            onWheel={handleWheel}
            // 不阻止事件传播，让父组件可以处理点击焦点
        >
            <RetroMarkdown content={content} />
            {/* CRT Overlay */}
            <div className="absolute inset-0 crt-overlay z-40" />
        </div>
    );
};

