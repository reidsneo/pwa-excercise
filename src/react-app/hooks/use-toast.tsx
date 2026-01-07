import * as React from 'react';

type ToastProps = {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

type ToastContextValue = {
  toast: (props: ToastProps) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const toast = React.useCallback((props: ToastProps) => {
    setToasts((prev) => [...prev, props]);

    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.map((t, i) => (
        <div
          key={i}
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
            t.variant === 'destructive' ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'
          }`}
        >
          <div className="font-medium">{t.title}</div>
          {t.description && <div className="text-sm opacity-90">{t.description}</div>}
        </div>
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
