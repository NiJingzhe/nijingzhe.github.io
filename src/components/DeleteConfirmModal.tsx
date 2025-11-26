import { Trash2 } from 'lucide-react';
import { InputModal } from './InputModal';

interface DeleteConfirmModalProps {
  cardTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal = ({ cardTitle, onClose, onConfirm }: DeleteConfirmModalProps) => {
  return (
    <InputModal
      title="DELETE_CARD"
      icon={Trash2}
      color="text-red-500"
      border="border-red-500"
      glow="text-glow-red"
      confirmText="删除"
      onConfirm={onConfirm}
      onClose={onClose}
      customContent={
        <div className="mb-6">
          <p className="text-white font-mono text-sm mb-2 text-glow-white">
            确定要删除卡片 <span className="text-red-400 font-bold">{cardTitle || 'UNTITLED'}</span> 吗？
          </p>
          <p className="text-gray-400 font-mono text-xs text-glow-white">
            此操作无法撤销
          </p>
        </div>
      }
    />
  );
};

