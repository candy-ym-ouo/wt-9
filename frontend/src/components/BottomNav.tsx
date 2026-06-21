import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, fontSize, zIndex } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';

const BOTTOM_NAV_ITEMS = [
  { path: '/calendar', label: '日历', icon: '📅' },
  { path: '/annotations', label: '批注', icon: '📝' },
  { path: '/materials', label: '素材', icon: '📁' },
  { path: '/search', label: '搜索', icon: '🔍' },
  { path: '/reminders', label: '提醒', icon: '🔔' },
];

const ADMIN_NAV_ITEMS = [
  { path: '/admin', label: '管理', icon: '⚙️' },
];

interface BottomNavProps {
  unreadCount?: number;
}

export default function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const { isMobile } = useResponsive();
  const { isAdmin } = useAuth();

  if (!isMobile) return null;

  const items = isAdmin
    ? [...BOTTOM_NAV_ITEMS, ...ADMIN_NAV_ITEMS]
    : BOTTOM_NAV_ITEMS;

  return (
    <nav
      className="safe-area-bottom"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: colors.bgSecondary,
        borderTop: `1px solid ${colors.border}`,
        zIndex: zIndex.sticky,
        display: 'flex',
        paddingTop: spacing.xs,
        paddingBottom: spacing.xs,
      }}
    >
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${spacing.sm}px ${spacing.xs}px`,
            color: isActive ? colors.primary : colors.textMuted,
            textDecoration: 'none',
            fontSize: fontSize.xs,
            position: 'relative',
            transition: 'color 0.15s',
            minHeight: 0,
            minWidth: 0,
          })}
        >
          <div
            style={{
              fontSize: 22,
              marginBottom: 2,
              position: 'relative',
              lineHeight: 1,
            }}
          >
            {item.icon}
            {item.path === '/reminders' && unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  background: colors.primary,
                  color: colors.textInverse,
                  borderRadius: 10,
                  padding: '0 5px',
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 16,
                  height: 16,
                  lineHeight: '16px',
                  textAlign: 'center',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
