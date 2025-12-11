import { Toast } from './Toast.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

export function ToastContainer() {
  const { toasts, removeToast } = useToastContext();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

