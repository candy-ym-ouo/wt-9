import React, { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { useResponsive } from '../hooks/useResponsive';
import MobileDrawer from './MobileDrawer';
import BottomNav from './BottomNav';
import { colors, spacing, fontSize, radius, zIndex } from '../styles/theme';

const NAV_ITEMS = [
  { path: '/dramas', label: '剧目管理', icon: '🎬' },
  { path: '/reminders', label: '排练提醒', icon: '🔔' },
  { path: '/calendar', label: '排练日历', icon: '📅' },
  { path: '/performances', label: '演出场次', icon: '🎪' },
  { path: '/roles', label: '角色分配', icon: '🎭' },
  { path: '/scripts', label: '剧本库', icon: '📚' },
  { path: '/leaves', label: '请假管理', icon: '📝' },
  { path: '/annotations', label: '文本批注', icon: '📝' },
  { path: '/materials', label: '素材上传', icon: '📁' },
  { path: '/search', label: '检索', icon: '🔍' },
  { path: '/tags', label: '标签中心', icon: '🏷️' },
];

const ADMIN_ITEMS = [
  { path: '/admin', label: '权限管理', icon: '⚙️' },
  { path: '/audit-logs', label: '操作审计', icon: '📋' },
  { path: '/reports', label: '报表中心', icon: '📊' },
  { path: '/data-export', label: '数据导出', icon: '📤' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadUnreadCount = async () => {
    try {
      const res = await api.reminders.unreadCount();
      setUnreadCount(res.count);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavItem = (item: { path: string; label: string; icon: string }, keyPrefix = '') => (
    <NavLink
      key={`${keyPrefix}-${item.path}`}
      to={item.path}
      onClick={() => isMobile && setDrawerOpen(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? `${spacing.md}px ${spacing.lg}px` : '10px 20px',
        color: isActive ? colors.primary : colors.textSecondary,
        textDecoration: 'none',
        fontSize: isMobile ? fontSize.md : 14,
        background: isActive ? 'rgba(231, 76, 60, 0.08)' : 'transparent',
        borderLeft: isMobile
          ? 'none'
          : isActive
            ? `3px solid ${colors.primary}`
            : '3px solid transparent',
        borderLeftWidth: isMobile ? 0 : undefined,
        transition: 'all 0.15s',
        borderRadius: isMobile && isActive ? radius.md : 0,
        margin: isMobile ? `0 ${spacing.sm}px` : 0,
      })}
    >
      <span>
        <span style={{ marginRight: 8 }}>{item.icon}</span>
        {item.label}
      </span>
      {item.path === '/reminders' && unreadCount > 0 && (
        <span
          style={{
            background: colors.primary,
            color: colors.textInverse,
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 700,
            minWidth: 18,
            textAlign: 'center',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </NavLink>
  );

  const navSection = (
    <>
      {NAV_ITEMS.map((item) => renderNavItem(item))}
      {isAdmin &&
        ADMIN_ITEMS.map((item) => renderNavItem(item, 'admin'))}
    </>
  );

  const userSection = (
    <div
      style={{
        padding: isMobile ? spacing.lg : '12px 20px',
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          fontSize: isMobile ? fontSize.md : 13,
          color: colors.textMuted,
          marginBottom: spacing.sm,
          lineHeight: 1.4,
        }}
      >
        <div style={{ color: colors.text, fontWeight: 500 }}>
          {user?.displayName || user?.username}
        </div>
        <div style={{ marginTop: 2 }}>({user?.role})</div>
      </div>
      <button
        onClick={handleLogout}
        style={{
          background: 'transparent',
          border: `1px solid ${colors.borderLight}`,
          color: colors.textSecondary,
          padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '6px 12px',
          borderRadius: radius.md,
          cursor: 'pointer',
          fontSize: isMobile ? fontSize.md : 12,
          width: '100%',
          minHeight: 44,
        }}
      >
        🚪 退出登录
      </button>
    </div>
  );

  const renderDesktopSidebar = () => (
    <aside
      style={{
        width: isTablet ? 64 : 220,
        background: colors.bgSecondary,
        borderRight: `1px solid ${colors.border}`,
        padding: isTablet ? `${spacing.lg}px 0` : '24px 0',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        height: '100dvh',
        position: 'sticky',
        top: 0,
      }}
    >
      {!isTablet ? (
        <div style={{ padding: '0 20px 24px', borderBottom: `1px solid ${colors.border}` }}>
          <h1
            style={{
              fontSize: 18,
              margin: 0,
              color: colors.primary,
              fontWeight: 700,
            }}
          >
            🎭 排练档案
          </h1>
          <p style={{ fontSize: 12, color: colors.textMuted, margin: '4px 0 0' }}>
            实验戏剧工坊
          </p>
        </div>
      ) : (
        <div
          style={{
            padding: `0 0 ${spacing.lg}px`,
            textAlign: 'center',
            borderBottom: `1px solid ${colors.border}`,
            margin: `0 ${spacing.sm}px`,
          }}
        >
          <div style={{ fontSize: 28 }}>🎭</div>
        </div>
      )}
      <nav style={{ flex: 1, padding: `${isTablet ? spacing.sm : 12}px 0`, overflowY: 'auto' }}>
        {!isTablet ? (
          navSection
        ) : (
          <>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.label}
                style={({ isActive }) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: `${spacing.md}px ${spacing.xs}px`,
                  margin: `0 ${spacing.xs}px ${spacing.xs}px`,
                  color: isActive ? colors.primary : colors.textMuted,
                  textDecoration: 'none',
                  fontSize: 10,
                  background: isActive ? 'rgba(231, 76, 60, 0.1)' : 'transparent',
                  borderRadius: radius.md,
                  position: 'relative',
                  transition: 'all 0.15s',
                })}
              >
                <span style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</span>
                {item.path === '/reminders' && unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      background: colors.primary,
                      color: colors.textInverse,
                      borderRadius: 8,
                      padding: '0 4px',
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 14,
                      height: 14,
                      lineHeight: '14px',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
            {isAdmin &&
              ADMIN_ITEMS.slice(0, 2).map((item) => (
                <NavLink
                  key={`admin-${item.path}`}
                  to={item.path}
                  title={item.label}
                  style={({ isActive }) => ({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: `${spacing.md}px ${spacing.xs}px`,
                    margin: `0 ${spacing.xs}px ${spacing.xs}px`,
                    color: isActive ? colors.primary : colors.textMuted,
                    textDecoration: 'none',
                    fontSize: 10,
                    background: isActive ? 'rgba(231, 76, 60, 0.1)' : 'transparent',
                    borderRadius: radius.md,
                    transition: 'all 0.15s',
                  })}
                >
                  <span style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</span>
                </NavLink>
              ))}
          </>
        )}
      </nav>
      {userSection}
    </aside>
  );

  const renderMobileHeader = () => (
    <header
      className="safe-area-top"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        background: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
        zIndex: zIndex.sticky,
        padding: `${spacing.md}px ${spacing.lg}px`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <button
        onClick={() => setDrawerOpen(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.text,
          fontSize: 24,
          cursor: 'pointer',
          padding: spacing.sm,
          lineHeight: 1,
          minHeight: 40,
          minWidth: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ☰
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <h1
          style={{
            margin: 0,
            fontSize: fontSize.lg,
            color: colors.primary,
            fontWeight: 600,
          }}
        >
          🎭 排练档案
        </h1>
      </div>
      <div style={{ width: 40 }} />
    </header>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100dvh',
        background: colors.bg,
        color: colors.text,
      }}
    >
      {!isMobile ? (
        renderDesktopSidebar()
      ) : (
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          position="left"
          width={300}
          title="菜单导航"
        >
          <div
            style={{
              padding: spacing.lg,
              borderBottom: `1px solid ${colors.border}`,
              marginBottom: spacing.sm,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.full,
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: colors.text,
                    fontWeight: 600,
                    fontSize: fontSize.md,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.displayName || user?.username}
                </div>
                <div style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                  {user?.role}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              paddingTop: spacing.sm,
              paddingBottom: isMobile ? 100 : 0,
            }}
          >
            {navSection}
          </div>
          {userSection}
        </MobileDrawer>
      )}

      <main
        style={{
          flex: 1,
          padding: isMobile ? 0 : isTablet ? spacing.lg : 24,
          overflowY: 'auto',
          minHeight: isMobile ? 'auto' : '100dvh',
          maxHeight: isMobile ? 'none' : '100dvh',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {isMobile && renderMobileHeader()}
        <div
          style={{
            padding: isMobile ? `${spacing.md}px ${spacing.md}px ${spacing.xxl * 3}px` : 0,
            minHeight: isMobile ? 'auto' : undefined,
          }}
        >
          {children}
        </div>
      </main>

      {isMobile && <BottomNav unreadCount={unreadCount} />}
    </div>
  );
}
