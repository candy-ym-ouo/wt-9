import React, { ReactNode } from 'react';
import { colors, radius, spacing, fontSize, zIndex } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  rightAction?: ReactNode;
  maxHeight?: string;
  showHandle?: boolean;
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  rightAction,
  maxHeight = '85vh',
  showHandle = true,
}: BottomSheetProps) {
  const { isTouchDevice } = useResponsive();

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
        className="animate-slide-up safe-area-bottom"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight,
          background: colors.bgSecondary,
          borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
          zIndex: zIndex.modal,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          WebkitOverflowScrolling: isTouchDevice ? 'touch' : 'auto',
        }}
      >
        {showHandle && (
          <div
            style={{
              padding: `${spacing.sm}px 0`,
              display: 'flex',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.full,
                background: colors.borderLight,
              }}
            />
          </div>
        )}
        {title && (
          <div
            style={{
              padding: `0 ${spacing.lg}px ${spacing.md}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.border}`,
              gap: spacing.md,
            }}
          >
            <h3 style={{ margin: 0, color: colors.text, fontSize: fontSize.lg, flex: 1 }}>
              {title}
            </h3>
            {rightAction}
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
                minHeight: 0,
                minWidth: 0,
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
            padding: spacing.lg,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
