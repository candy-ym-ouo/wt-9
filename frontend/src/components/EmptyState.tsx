import React from 'react';
import { colors, spacing, fontSize, radius } from '../styles/theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  const primary = primaryAction || action;
  return (
    <div
      style={{
        textAlign: 'center',
        padding: spacing.xxxl * 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <div style={{ fontSize: 56, opacity: 0.6 }}>{icon}</div>
      <h3
        style={{
          margin: 0,
          color: colors.textSecondary,
          fontSize: fontSize.lg,
          fontWeight: 500,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: 0,
            color: colors.textMuted,
            fontSize: fontSize.sm,
            maxWidth: 300,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}
      {(primary || secondaryAction) && (
        <div style={{
          marginTop: spacing.md,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing.sm,
        }}>
          {primary && (
            <button
              onClick={primary.onClick}
              style={{
                padding: `${spacing.md}px ${spacing.xxl}px`,
                background:
                  primary.variant === 'secondary' ? 'transparent' : colors.primary,
                border:
                  primary.variant === 'secondary'
                    ? `1px solid ${colors.borderLight}`
                    : 'none',
                borderRadius: radius.md,
                color:
                  primary.variant === 'secondary'
                    ? colors.textSecondary
                    : colors.textInverse,
                fontSize: fontSize.md,
                cursor: 'pointer',
                fontWeight: 500,
                minHeight: 44,
                minWidth: 160,
              }}
            >
              {primary.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                padding: `${spacing.md}px ${spacing.xxl}px`,
                background:
                  secondaryAction.variant === 'secondary' ? 'transparent' : colors.bgTertiary,
                border:
                  secondaryAction.variant === 'primary'
                    ? 'none'
                    : `1px solid ${colors.borderLight}`,
                borderRadius: radius.md,
                color: colors.textSecondary,
                fontSize: fontSize.md,
                cursor: 'pointer',
                fontWeight: 500,
                minHeight: 44,
                minWidth: 160,
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
