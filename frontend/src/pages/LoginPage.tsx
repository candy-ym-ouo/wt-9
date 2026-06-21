import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import Toast from '../components/Toast';
import { colors, spacing, fontSize, radius } from '../styles/theme';

const DEFAULT_ACCOUNTS = [
  { username: 'admin', label: '管理员', role: 'admin' },
  { username: 'director1', label: '导演', role: 'director' },
  { username: 'actor1', label: '演员', role: 'actor' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isTouchDevice } = useResponsive();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      setToast({ message: '请输入用户名和密码', type: 'warning' });
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.success) {
      setToast({ message: '登录成功！', type: 'success' });
      setTimeout(() => {
        navigate('/calendar');
      }, 500);
    } else if (result.frozen) {
      const msg = result.message || '该账号已被冻结，请联系管理员';
      setError(msg);
      setToast({ message: msg, type: 'error' });
    } else {
      const msg = result.message || '用户名或密码错误';
      setError(msg);
      setToast({ message: msg, type: 'error' });
    }
  };

  const fillDemoAccount = (acc: typeof DEFAULT_ACCOUNTS[0]) => {
    setUsername(acc.username);
    setPassword(acc.username);
    setError('');
    setToast({ message: `已填入${acc.label}账号，密码与用户名相同`, type: 'info' });
  };

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: isMobile ? `${spacing.md + 2}px ${spacing.md + 2}px` : '10px 12px',
    background: colors.bgTertiary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: isMobile ? fontSize.lg : 14,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'all 0.15s',
    WebkitAppearance: 'none',
    appearance: 'none',
  };

  return (
    <div
      className="safe-area"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${colors.bg} 0%, #1a0a0a 100%)`,
        padding: isMobile ? 0 : spacing.lg,
      }}
    >
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div
        style={{
          width: isMobile ? '100%' : 380,
          maxWidth: '100%',
          padding: isMobile ? `${spacing.xxxl}px ${spacing.lg}px` : 40,
          paddingTop: isMobile ? spacing.xxl * 3 : 40,
          background: isMobile ? 'transparent' : colors.bgSecondary,
          borderRadius: isMobile ? 0 : radius.xl,
          border: isMobile ? 'none' : `1px solid ${colors.border}`,
          minHeight: isMobile ? '100dvh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isMobile ? 'flex-start' : 'center',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: isMobile ? spacing.xxxl : 32 }}>
          <div
            style={{
              fontSize: isMobile ? 56 : 28,
              marginBottom: spacing.md,
              lineHeight: 1,
            }}
          >
            🎭
          </div>
          <h2
            style={{
              textAlign: 'center',
              color: colors.text,
              margin: 0,
              fontSize: isMobile ? fontSize.xxxl : 20,
              fontWeight: 700,
            }}
          >
            实验戏剧排练档案
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: colors.textMuted,
              margin: `${spacing.sm}px 0 0`,
              fontSize: isMobile ? fontSize.md : 12,
            }}
          >
            登录以继续访问
          </p>
        </div>

        {!isMobile && (
          <div style={{ marginBottom: spacing.lg }}>
            <div
              style={{
                fontSize: fontSize.sm,
                color: colors.textMuted,
                marginBottom: spacing.sm,
              }}
            >
              快速体验：
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              {DEFAULT_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemoAccount(acc)}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    border: `1px solid ${colors.borderLight}`,
                    borderRadius: radius.md,
                    fontSize: fontSize.sm,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    minHeight: 0,
                    minWidth: 0,
                    ...(acc.role === 'admin'
                      ? {
                          borderColor: `${colors.primary}40`,
                          color: colors.primary,
                          background: `${colors.primary}10`,
                        }
                      : acc.role === 'director'
                        ? {
                            borderColor: `${colors.secondary}40`,
                            color: colors.secondary,
                            background: `${colors.secondary}10`,
                          }
                        : {
                            background: 'transparent',
                            color: colors.textSecondary,
                          }),
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ marginBottom: isMobile ? spacing.lg : 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: isMobile ? fontSize.sm : 13,
                color: colors.textMuted,
                marginBottom: spacing.sm,
                fontWeight: 500,
              }}
            >
              👤 用户名
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="请输入用户名"
              style={inputBaseStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.borderLight;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: isMobile ? spacing.xl : 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: isMobile ? fontSize.sm : 13,
                color: colors.textMuted,
                marginBottom: spacing.sm,
                fontWeight: 500,
              }}
            >
              🔒 密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
                style={{
                  ...inputBaseStyle,
                  paddingRight: 50,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: spacing.sm,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: fontSize.lg,
                  cursor: 'pointer',
                  padding: spacing.sm,
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                color: colors.danger,
                fontSize: isMobile ? fontSize.md : 13,
                marginBottom: spacing.lg,
                textAlign: 'center',
                padding: spacing.md,
                background: `${colors.danger}10`,
                borderRadius: radius.md,
                border: `1px solid ${colors.danger}30`,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: isMobile ? `${spacing.lg}px` : '12px',
              background: colors.primary,
              border: 'none',
              borderRadius: radius.md,
              color: colors.textInverse,
              fontSize: isMobile ? fontSize.lg : 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s',
              minHeight: isMobile ? 52 : 0,
              ...(!isTouchDevice && {
                ':hover': {
                  background: colors.primaryDark,
                },
              }),
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
                <span
                  className="animate-pulse"
                  style={{ fontSize: fontSize.lg }}
                >
                  ⏳
                </span>
                登录中...
              </span>
            ) : (
              '登 录'
            )}
          </button>
        </form>

        {isMobile && DEFAULT_ACCOUNTS.length > 0 && (
          <div style={{ marginTop: spacing.xxxl }}>
            <div
              style={{
                textAlign: 'center',
                fontSize: fontSize.sm,
                color: colors.textMuted,
                marginBottom: spacing.md,
              }}
            >
              💡 演示账号（点选自动填充）
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.sm,
              }}
            >
              {DEFAULT_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemoAccount(acc)}
                  style={{
                    padding: `${spacing.md}px ${spacing.lg}px`,
                    background: colors.bgSecondary,
                    border: `1px solid ${
                      acc.role === 'admin'
                        ? `${colors.primary}40`
                        : acc.role === 'director'
                          ? `${colors.secondary}40`
                          : colors.border
                    }`,
                    borderRadius: radius.md,
                    color:
                      acc.role === 'admin'
                        ? colors.primary
                        : acc.role === 'director'
                          ? colors.secondary
                          : colors.textSecondary,
                    fontSize: fontSize.md,
                    cursor: 'pointer',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>
                    {acc.role === 'admin' ? '👑' : acc.role === 'director' ? '🎬' : '🎭'}{' '}
                    {acc.label}
                  </span>
                  <span style={{ fontSize: fontSize.sm, opacity: 0.7 }}>
                    {acc.username} / {acc.username}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p
          style={{
            textAlign: 'center',
            color: colors.textFaint,
            fontSize: isMobile ? fontSize.xs : 12,
            marginTop: isMobile ? 'auto' : 20,
            paddingTop: isMobile ? spacing.xxxl : 0,
          }}
        >
          实验戏剧工坊 · 内部排练管理系统 v1.0
        </p>
      </div>
    </div>
  );
}
