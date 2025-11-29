import { AlertTriangle } from 'lucide-react';
import { InputModal } from './InputModal';

interface EditConflictModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export const EditConflictModal = ({ onClose, onConfirm }: EditConflictModalProps) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleClose = () => {
    // 关闭时也要刷新内容（无论点击确定还是取消）
    onConfirm();
    onClose();
  };

  return (
    <InputModal
      title="EDIT_CONFLICT"
      icon={AlertTriangle}
      color="text-yellow-500"
      border="border-yellow-500"
      glow="text-glow-yellow"
      confirmText="确定"
      onConfirm={handleConfirm}
      onClose={handleClose}
      customContent={
        <div className="mb-6">
          <p className="text-white font-mono text-sm mb-2 text-glow-white">
            内容已被其他用户更新，是否刷新？
          </p>
          <p className="text-gray-400 font-mono text-xs text-glow-white">
            关闭对话框后将自动刷新卡片内容
          </p>
        </div>
      }
    />
  );
};

