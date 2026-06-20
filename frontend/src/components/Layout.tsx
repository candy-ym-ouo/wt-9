import React, { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

const NAV_ITEMS = [
  { path: '/reminders', label: '排练提醒', icon: '🔔' },
  { path: '/calendar', label: '排练日历', icon: '📅' },
  { path: '/performances', label: '演出场次', icon: '🎪' },
  { path: '/roles', label: '角色分配', icon: '🎭' },
  { path: '/scripts', label: '剧本库', icon: '📚' },
  { path: '/leaves', label: '请假管理', icon: '📝' },
  { path: '/annotations', label: '文本批注', icon: '📝' },
  { path: '/materials', label: '素材上传', icon: '📁' },
  { path: '/search', label: '检索', icon: '🔍' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d0d', color: '#e0e0e0' }}>
      <aside style={{
        width: 220,
        background: '#1a1a1a',
        borderRight: '1px solid #333',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #333' }}>
          <h1 style={{ fontSize: 18, margin: 0, color: '#e74c3c', fontWeight: 700 }}>
            🎭 排练档案
          </h1>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>实验戏剧工坊</p>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                color: isActive ? '#e74c3c' : '#aaa',
                textDecoration: 'none',
                fontSize: 14,
                background: isActive ? '#2a1515' : 'transparent',
                borderLeft: isActive ? '3px solid #e74c3c' : '3px solid transparent',
                transition: 'all 0.2s',
              })}
            >
              <span>{item.icon} {item.label}</span>
              {item.path === '/reminders' && unreadCount > 0 && (
                <span style={{
                  background: '#e74c3c',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  textAlign: 'center',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <NavLink
                to="/admin"
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '10px 20px',
                  color: isActive ? '#e74c3c' : '#aaa',
                  textDecoration: 'none',
                  fontSize: 14,
                  background: isActive ? '#2a1515' : 'transparent',
                  borderLeft: isActive ? '3px solid #e74c3c' : '3px solid transparent',
                  transition: 'all 0.2s',
                })}
              >
                ⚙️ 权限管理
              </NavLink>
              <NavLink
                to="/audit-logs"
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '10px 20px',
                  color: isActive ? '#e74c3c' : '#aaa',
                  textDecoration: 'none',
                  fontSize: 14,
                  background: isActive ? '#2a1515' : 'transparent',
                  borderLeft: isActive ? '3px solid #e74c3c' : '3px solid transparent',
                  transition: 'all 0.2s',
                })}
              >
                📋 操作审计
              </NavLink>
              <NavLink
                to="/reports"
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '10px 20px',
                  color: isActive ? '#e74c3c' : '#aaa',
                  textDecoration: 'none',
                  fontSize: 14,
                  background: isActive ? '#2a1515' : 'transparent',
                  borderLeft: isActive ? '3px solid #e74c3c' : '3px solid transparent',
                  transition: 'all 0.2s',
                })}
              >
                📊 报表中心
              </NavLink>
            </>
          )}
        </nav>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #333' }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
            {user?.displayName || user?.username} ({user?.role})
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid #555',
              color: '#aaa',
              padding: '6px 12px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              width: '100%',
            }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
