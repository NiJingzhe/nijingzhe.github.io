import { useState, useEffect } from 'react';
import { Github, Image as ImageIcon } from 'lucide-react';
import type { InputModalProps } from '../types';
import { GlitchTransition } from './GlitchTransition';

export const InputModal = ({ 
    type, 
    onClose, 
    onSubmit,
    customContent,
    title: customTitle,
    icon: customIcon,
    color: customColor,
    border: customBorder,
    glow: customGlow,
    confirmText = '确认',
    showCancel = true,
    onConfirm
}: InputModalProps) => {
    const [value, setValue] = useState('');
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGlitch, setShowGlitch] = useState(true);
    const [showContent, setShowContent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!onSubmit) return;
        setIsSubmitting(true);
        try {
            await Promise.resolve(onSubmit(value, title));
            onClose();
        } catch (error) {
            console.error('Error submitting:', error);
            // 即使出错也关闭模态框，错误会在卡片上显示
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirm = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            if (onConfirm) {
                await Promise.resolve(onConfirm());
            }
            onClose();
        } catch (error) {
            console.error('Error in onConfirm:', error);
            // 即使出错也关闭模态框
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    // 键盘快捷键处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ESC 键：取消
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (!isSubmitting) {
                    onClose();
                }
                return;
            }

            // Enter 键：确认
            // 只在自定义内容模式下处理 Enter（表单模式下由 form 的 onSubmit 处理）
            if (e.key === 'Enter' && customContent) {
                const target = e.target as HTMLElement;
                // 如果焦点在输入框或文本域中，不处理（让默认行为处理）
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                if (!isSubmitting && onConfirm) {
                    handleConfirm();
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSubmitting, customContent, onConfirm, onClose]);

    // 如果有自定义配置，使用自定义配置；否则使用 type 对应的配置
    const config = customTitle ? {
        title: customTitle,
        icon: customIcon || Github,
        color: customColor || 'text-cyan-500',
        border: customBorder || 'border-cyan-500',
        glow: customGlow || 'text-glow-cyan',
        label: '',
        placeholder: ''
    } : type ? {
        github: { title: 'CLONE_REPO', label: 'REPO_PATH', placeholder: 'Owner/RepoName', icon: Github, color: 'text-cyan-500', border: 'border-cyan-500', glow: 'text-glow-cyan' },
        image: { title: 'LOAD_IMAGE', label: 'IMAGE_URL', placeholder: 'https://example.com/image.jpg', icon: ImageIcon, color: 'text-purple-500', border: 'border-purple-500', glow: 'text-glow-purple' }
    }[type] : null;

    if (!config) return null;

    const IconComponent = config.icon;

    return (
        <>
            {showGlitch && <GlitchTransition onComplete={() => {
                setShowGlitch(false);
                setShowContent(true);
            }} />}
            <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-75 ${showContent ? 'opacity-100' : 'opacity-0'}`} style={{ cursor: 'auto' }}>
                <div className={`bg-black border ${config.border} p-6 w-96 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative`}>
                    <div className={`flex items-center gap-2 mb-6 ${config.color} ${config.glow}`}>
                        <IconComponent className="animate-pulse" />
                        <h2 className="text-xl font-bold font-mono">{config.title}</h2>
                    </div>
                    
                    {customContent ? (
                        <>
                            {customContent}
                            <div className="flex gap-2 mt-6">
                                {showCancel && (
                                    <button 
                                        type="button" 
                                        onClick={onClose} 
                                        disabled={isSubmitting}
                                        className="flex-1 py-2 text-xs font-mono border border-gray-600 hover:bg-gray-800 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-glow-white"
                                    >
                                        取消
                                    </button>
                                )}
                                <button 
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isSubmitting}
                                    className={`flex-1 py-2 text-xs font-mono font-bold bg-opacity-20 hover:bg-opacity-40 border ${config.border} ${config.color} ${config.glow} uppercase disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1 text-glow-white">TITLE_TAG (可选)</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 p-2 text-white font-mono text-sm focus:border-white outline-none text-glow-white"
                                    placeholder="我的新项目"
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-mono text-gray-500 mb-1 text-glow-white`}>{config.label}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 p-2 text-white font-mono text-sm focus:border-white outline-none text-glow-white"
                                    placeholder={config.placeholder}
                                />
                            </div>
                            
                            <div className="flex gap-2 mt-6">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    disabled={isSubmitting}
                                    className="flex-1 py-2 text-xs font-mono border border-gray-600 hover:bg-gray-800 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-glow-white"
                                >
                                    取消
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className={`flex-1 py-2 text-xs font-mono font-bold bg-opacity-20 hover:bg-opacity-40 border ${config.border} ${config.color} ${config.glow} uppercase disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isSubmitting ? '加载中...' : '确认'}
                                </button>
                            </div>
                        </form>
                    )}
                    {/* CRT Overlay */}
                    <div className="absolute inset-0 pointer-events-none crt-overlay z-0" />
                </div>
            </div>
        </>
    );
};

