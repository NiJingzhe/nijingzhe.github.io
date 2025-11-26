import React from 'react';
import type { GitHubCardData } from '../components/GitHubCard';

export interface CanvasItemData {
  id: string;
  type: 'article' | 'image' | 'github';
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string | GitHubCardData;
  visible?: boolean;
}

export interface CanvasState {
  x: number;
  y: number;
  scale: number;
}

export interface WindowHeaderProps {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colorClass: string;
  borderColor: string;
  onClose?: () => void;
  onEdit?: () => void;
  isEditing?: boolean;
}

export interface CanvasItemProps {
  item: CanvasItemData;
  scale: number;
  onUpdate: (id: string, changes: Partial<CanvasItemData>) => void;
  onFocus: (id: string) => void;
  isSelected: boolean;
  forceEditing?: boolean;
  onEditChange?: (editing: boolean) => void;
  allowDrag?: boolean;
}

export interface ArticleEditorProps {
  content: string;
  onChange: (content: string) => void;
  isEditing: boolean;
}

export interface InputModalProps {
  type?: 'github' | 'image';
  onClose: () => void;
  onSubmit?: (value: string, title: string) => void | Promise<void>;
  // 自定义内容，如果提供则显示自定义内容而不是输入表单
  customContent?: React.ReactNode;
  // 自定义标题配置（用于非输入类型的模态框）
  title?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color?: string;
  border?: string;
  glow?: string;
  // 自定义按钮配置
  confirmText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
}

export type DrawMode = 'off' | 'draw' | 'erase';
export type VimMode = 'normal' | 'edit' | 'draw' | 'command';

export interface DockProps {
  drawMode: DrawMode;
  drawColor: string;
  drawWidth: number;
  onDrawColorChange: (color: string) => void;
  onDrawWidthChange: (width: number) => void;
  onDrawModeChange?: (mode: DrawMode) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export interface DrawPath {
  id: number | string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
}

export interface CanvasProps {
  canvas: CanvasState;
  items: CanvasItemData[];
  selectedId: string | null;
  onUpdateItem: (id: string, changes: Partial<CanvasItemData>) => void;
  onFocusItem: (id: string) => void;
  drawPaths: DrawPath[];
  onAddDrawPath: (path: DrawPath) => void;
  onRemoveDrawPath: (id: number | string) => void;
  drawMode: DrawMode;
  drawColor: string;
  drawWidth: number;
  editingCardId?: string | null;
  onEditChange?: (id: string, editing: boolean) => void;
  vimMode?: VimMode;
}

