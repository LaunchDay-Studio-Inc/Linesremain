// ─── Notification Toast System ───
// Unified notification system with typed categories and consistent styling.

import { NOTIFICATION_STYLES } from '@shared/constants/monetization';
import type { NotificationType } from '@shared/types/monetization';
import React, { useCallback, useEffect, useState } from 'react';

interface ToastItem {
  id: number;
  type: NotificationType;
  title: string;
  message?: string;
  exiting: boolean;
}

let nextId = 0;
let addToastFn: ((type: NotificationType, title: string, message?: string) => void) | null = null;

/** Call from anywhere to show a notification toast */
export function showNotification(type: NotificationType, title: string, message?: string): void {
  addToastFn?.(type, title, message);
}

export const NotificationToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: NotificationType, title: string, message?: string) => {
    const id = nextId++;
    setToasts((prev) => [{ id, type, title, message, exiting: false }, ...prev].slice(0, 6));

    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: '360px',
      }}
    >
      {toasts.map((toast) => {
        const style = NOTIFICATION_STYLES[toast.type] || NOTIFICATION_STYLES['info']!;
        return (
          <div
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            style={{
              background: style.bg,
              borderLeft: `3px solid ${style.border}`,
              borderRadius: '6px',
              padding: '12px 16px',
              color: '#FFFFFF',
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transform: toast.exiting ? 'translateX(120%)' : 'translateX(0)',
              opacity: toast.exiting ? 0 : 1,
              transition: 'all 0.3s ease',
              animation: 'slideInRight 0.3s ease-out',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
              {toast.title}
            </div>
            {toast.message && (
              <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                {toast.message}
              </div>
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
