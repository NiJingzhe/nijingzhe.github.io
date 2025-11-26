import { InputModal } from './InputModal';

interface ImageInputModalProps {
  onClose: () => void;
  onSubmit: (value: string, title: string) => void | Promise<void>;
}

export const ImageInputModal = ({ onClose, onSubmit }: ImageInputModalProps) => {
  return <InputModal type="image" onClose={onClose} onSubmit={onSubmit} />;
};

