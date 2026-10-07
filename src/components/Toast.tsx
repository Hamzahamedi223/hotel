import { useCallback, useRef, useState } from 'react';
import { IconCheckCircle, IconAlertCircle, IconInfo } from './icons';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

const ICONS: Record<ToastKind, (p: any) => JSX.Element> = {
  success: IconCheckCircle,
  error: IconAlertCircle,
  info: IconInfo,
};

const TONE: Record<ToastKind, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-brand-600 dark:text-brand-400',
};

/** Local, per-page toast — renders in the corner, auto-dismisses. */
export function useToast(durationMs = 3400) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      const id = Date.now();
      setToast({ id, kind, message });
      timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), durationMs);
    },
    [durationMs]
  );

  return { toast, show };
}

export function ToastHost({ toast }: { toast: { id: number; kind: ToastKind; message: string } | null }) {
  if (!toast) return null;
  const Icon = ICONS[toast.kind];
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-toast-in">
      <div className="flex items-center gap-2.5 bg-surface-raised border border-line rounded-xl shadow-float px-4 py-3 text-sm font-medium text-ink max-w-lg">
        <Icon size={18} className={TONE[toast.kind]} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
