import { useEffect } from 'react';
import './Toast.css';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'error', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast toast--${type}`} role="alert" aria-live="assertive">
      <span className="toast-message">{message}</span>
      <button 
        type="button" 
        className="toast-close" 
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

