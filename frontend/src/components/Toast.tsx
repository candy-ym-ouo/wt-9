import React from 'react';
import { colors, radius, spacing, fontSize } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

const typeStyles: Record<
  NonNullable<ToastProps['type']>,
  { bg: string; border: string; color: string; icon: string }
> = {
  success: {
    bg: 'rgba(46, 204, 113, 0.15)',
    border: '#2ecc71',
    color: '#2ecc71',
    icon: '✅',
  },
  error: {
    bg: 'rgba(231, 76, 60, 0.15)',
    border: '#e74c3c',
    color: '#e74c3c',
    icon: '❌',
  },
  warning: {
    bg: 'rgba(243, 156, 18, 0.15)',
    border: '#f39c12',
    color: '#f39c12',
    icon: '⚠️',
  },
  info: {
    bg: 'rgba(52, 152, 219, 0.15)',
    border: '#3498db',
    color: '#3498db',
    icon: 'ℹ️',
  },
};

export default function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = React.useState(true);
  const { isMobile } = useResponsive();
  const styles = typeStyles[type];

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className="animate-scale-in"
      style={{
        position: 'fixed',
        top: isMobile ? spacing.xxl + (typeof window !== 'undefined' ? window.innerHeight * 0.08 : 60) : spacing.xxl,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: isMobile ? '90vw' : 400,
        padding: `${spacing.md}px ${spacing.lg}px`,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: radius.lg,
        color: styles.color,
        fontSize: fontSize.md,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        zIndex: 9999,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <span style={{ fontSize: fontSize.lg }}>{styles.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: styles.color,
            fontSize: fontSize.lg,
            cursor: 'pointer',
            padding: 0,
            opacity: 0.7,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
