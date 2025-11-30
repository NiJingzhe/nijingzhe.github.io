import { useRef, useEffect, useState, memo } from 'react';
import { RetroMarkdown } from './RetroMarkdown';
import type { ArticleEditorProps } from '../types';

const ArticleEditorComponent = ({ content, onChange, isEditing }: ArticleEditorProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const contentWrapperRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [contentHeight, setContentHeight] = useState(0);
    const scrollPositionRef = useRef<number>(0);
    const prevIsEditingRef = useRef<boolean>(isEditing);
    
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) return;
        
        // 编辑模式下，直接阻止事件传播到 Canvas
        if (isEditing) {
            // 实时保存 textarea 的滚动位置
            if (textareaRef.current) {
                scrollPositionRef.current = textareaRef.current.scrollTop;
            }
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
        // 实时保存阅读模式的滚动位置
        scrollPositionRef.current = scrollTop;
        
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

    // 实时保存滚动位置
    useEffect(() => {
        if (isEditing) {
            const textarea = textareaRef.current;
            if (!textarea) return;
            
            const handleScroll = () => {
                scrollPositionRef.current = textarea.scrollTop;
            };
            
            textarea.addEventListener('scroll', handleScroll);
            return () => textarea.removeEventListener('scroll', handleScroll);
        } else {
            const container = scrollContainerRef.current;
            if (!container) return;
            
            const handleScroll = () => {
                scrollPositionRef.current = container.scrollTop;
            };
            
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [isEditing]);

    // 同步滚动位置：在编辑模式和阅读模式之间切换时
    useEffect(() => {
        const prevIsEditing = prevIsEditingRef.current;
        prevIsEditingRef.current = isEditing;
        
        // 只在状态真正变化时执行
        if (prevIsEditing === isEditing) return;
        
        if (isEditing) {
            // 进入编辑模式：从阅读模式同步滚动位置到 textarea
            // 使用 requestAnimationFrame 确保 textarea 已渲染
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (textareaRef.current) {
                        textareaRef.current.scrollTop = scrollPositionRef.current;
                    }
                });
            });
        } else {
            // 退出编辑模式：从 textarea 同步滚动位置到阅读模式
            // 等待内容渲染完成后再设置滚动位置
            const setScrollPosition = () => {
                if (scrollContainerRef.current && contentWrapperRef.current) {
                    scrollContainerRef.current.scrollTop = scrollPositionRef.current;
                } else {
                    // 如果元素还没准备好，继续等待
                    requestAnimationFrame(setScrollPosition);
                }
            };
            requestAnimationFrame(setScrollPosition);
        }
    }, [isEditing]);

    // 监听内容高度变化，更新 overlay 高度
    useEffect(() => {
        if (isEditing || !contentWrapperRef.current) return;
        
        const wrapper = contentWrapperRef.current;
        const updateHeight = () => {
            setContentHeight(wrapper.scrollHeight);
        };
        
        // 初始计算（延迟一下确保内容已渲染）
        const timer = setTimeout(updateHeight, 0);
        
        // 监听内容变化
        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(wrapper);
        
        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
        };
    }, [content, isEditing]);

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
        <div className="w-full h-full relative">
            <div 
                ref={scrollContainerRef}
                className="p-5 h-full overflow-y-auto bg-gray-950/30 backdrop-blur-md text-gray-100 scrollbar-thin scrollbar-thumb-pink-600 scrollbar-track-gray-900 cursor-text z-30 relative"
                data-scrollable
                onWheel={handleWheel}
                // 不阻止事件传播，让父组件可以处理点击焦点
            >
                <div ref={contentWrapperRef} className="relative">
                    <RetroMarkdown content={content} />
                    {/* CRT Overlay - 覆盖整个滚动内容区域 */}
                    <div 
                        className="absolute top-0 left-0 right-0 crt-overlay z-40 pointer-events-none" 
                        style={{ height: contentHeight || '100%' }}
                    />
                </div>
            </div>
        </div>
    );
};

// 使用 memo 优化，避免不必要的重新渲染
export const ArticleEditor = memo(ArticleEditorComponent);

