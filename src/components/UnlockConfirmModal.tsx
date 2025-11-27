import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { InputModal } from './InputModal';

interface UnlockConfirmModalProps {
  cardTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const UnlockConfirmModal = ({ cardTitle, onClose, onConfirm }: UnlockConfirmModalProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (showError) {
      // 错误显示 2 秒后自动消失
      const timer = setTimeout(() => {
        setShowError(false);
        setError('');
        setPassword('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  const handleConfirm = () => {
    const unlockPassword = import.meta.env.VITE_UNLOCK_PASSWORD;
    
    if (!unlockPassword) {
      setError('解锁密码未配置');
      setShowError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    if (password === unlockPassword) {
      setError('');
      setShowError(false);
      onConfirm();
      onClose();
    } else {
      setError('密码错误');
      setShowError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <InputModal
      title="UNLOCK_CARD"
      icon={Lock}
      color="text-amber-500"
      border="border-amber-500"
      glow="text-glow-amber"
      confirmText="解锁"
      onConfirm={handleConfirm}
      onClose={onClose}
      customContent={
        <div className="mb-6">
          <p className="text-white font-mono text-sm mb-4 text-glow-white">
            解锁卡片 <span className="text-amber-400 font-bold">{cardTitle || 'UNTITLED'}</span>
          </p>
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1 text-glow-white">密码</label>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (showError) {
                  setError('');
                  setShowError(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              className={`w-full bg-gray-900 border p-2 text-white font-mono text-sm outline-none text-glow-white transition-all duration-300 ${
                showError 
                  ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse' 
                  : 'border-gray-700 focus:border-amber-500'
              } ${isShaking ? 'animate-shake' : ''}`}
              placeholder="请输入解锁密码"
            />
            {showError && error && (
              <p className="text-red-400 font-mono text-xs mt-2 text-glow-red animate-pulse">{error}</p>
            )}
          </div>
        </div>
      }
    />
  );
};

