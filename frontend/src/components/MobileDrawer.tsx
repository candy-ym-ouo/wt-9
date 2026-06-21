import React, { ReactNode, useEffect } from 'react';
import { colors, radius, spacing, fontSize, zIndex } from '../styles/theme';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: 'left' | 'right';
  width?: number;
  title?: string;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  children,
  position = 'left',
  width = 280,
  title,
}: MobileDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="animate-fade-in"
        style={{
          position: 'fixed',
          inset: 0,
          background: colors.overlay,
          zIndex: zIndex.overlay,
        }}
      />
      <div
        className={`animate-slide-in-${position === 'left' ? 'right' : 'left'}`}
        style={{
          position: 'fixed',
          top: 0,
          [position]: 0,
          bottom: 0,
          width,
          maxWidth: '85vw',
          background: colors.bgSecondary,
          zIndex: zIndex.modal,
          boxShadow: position === 'left' ? shadow.lg : `-${shadow.lg}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {title && (
          <div
            style={{
              padding: spacing.lg,
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ margin: 0, color: colors.text, fontSize: fontSize.lg }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textSecondary,
                fontSize: fontSize.xxl,
                cursor: 'pointer',
                padding: spacing.sm,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

const shadow = {
  lg: '4px 0 20px rgba(0, 0, 0, 0.5)',
};
