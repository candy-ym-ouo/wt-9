import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = await login(username, password);
    if (ok) {
      navigate('/calendar');
    } else {
      setError('用户名或密码错误');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d0d0d 0%, #1a0a0a 100%)',
    }}>
      <div style={{
        width: 380,
        padding: 40,
        background: '#1a1a1a',
        borderRadius: 12,
        border: '1px solid #333',
      }}>
        <h1 style={{ textAlign: 'center', color: '#e74c3c', marginBottom: 8, fontSize: 28 }}>
          🎭
        </h1>
        <h2 style={{ textAlign: 'center', color: '#e0e0e0', marginBottom: 32, fontSize: 20 }}>
          实验戏剧排练档案
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>
              用户名
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#e0e0e0',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#e0e0e0',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              background: '#e74c3c',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            登 录
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#555', fontSize: 12, marginTop: 20 }}>
          默认管理员: admin / admin
        </p>
      </div>
    </div>
  );
}
