import React from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, fontSize, zIndex } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  sticky?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  sticky = false,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  if (!isMobile) return null;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      className="safe-area-top"
      style={{
        position: sticky ? 'sticky' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        background: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
        zIndex: sticky ? zIndex.sticky : zIndex.base,
        padding: `${spacing.md}px ${spacing.lg}px`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      {showBack && (
        <button
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.text,
            fontSize: 24,
            cursor: 'pointer',
            padding: 0,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            color: colors.text,
            fontSize: fontSize.xl,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: `${spacing.xs}px 0 0`,
              color: colors.textMuted,
              fontSize: fontSize.sm,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightAction}
    </header>
  );
}
