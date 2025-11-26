import { InputModal } from './InputModal';

interface GitHubInputModalProps {
  onClose: () => void;
  onSubmit: (value: string, title: string) => void | Promise<void>;
}

export const GitHubInputModal = ({ onClose, onSubmit }: GitHubInputModalProps) => {
  return <InputModal type="github" onClose={onClose} onSubmit={onSubmit} />;
};

