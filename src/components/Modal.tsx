import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { IconX } from './icons';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerAccessory?: ReactNode;
}

export default function Modal({ title, subtitle, onClose, width = 'w-[460px]', children, footer, headerAccessory }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-panel ${width} max-w-full max-h-[92dvh] flex flex-col animate-pop rounded-b-none sm:rounded-b-2xl`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink truncate">{title}</h2>
            {subtitle && <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerAccessory}
            <button onClick={onClose} className="btn-ghost btn-xs !px-2" aria-label="Fermer">
              <IconX size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
