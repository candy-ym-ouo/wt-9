import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface User {
  id: number;
  username: string;
  role: string;
  displayName: string;
  createdAt: string;
}

const ROLES = [
  { value: 'admin', label: '管理员' },
  { value: 'director', label: '导演' },
  { value: 'actor', label: '演员' },
  { value: 'viewer', label: '观察者' },
];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'actor', displayName: '' });

  const load = async () => {
    const data = await api.users.list();
    setUsers(data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.auth.register(form);
    setForm({ username: '', password: '', role: 'actor', displayName: '' });
    setShowForm(false);
    load();
  };

  const handleRoleChange = async (id: number, role: string) => {
    await api.users.updateRole(id, role);
    load();
  };

  const handleDelete = async (id: number) => {
    await api.users.remove(id);
    load();
  };

  const roleLabel = (r: string) => ROLES.find((ro) => ro.value === r)?.label || r;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>权限管理</h2>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
          {showForm ? '取消' : '+ 新用户'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={formStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input placeholder="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required style={inputStyle} />
            <input placeholder="密码" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={inputStyle} />
            <input placeholder="显示名" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={inputStyle} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button type="submit" style={primaryBtnStyle}>创建</button>
          </div>
        </form>
      )}

      <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>用户名</th>
              <th style={thStyle}>显示名</th>
              <th style={thStyle}>角色</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={tdStyle}>{u.id}</td>
                <td style={tdStyle}>{u.username}</td>
                <td style={tdStyle}>{u.displayName || '-'}</td>
                <td style={tdStyle}>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    style={{ ...inputStyle, padding: '4px 8px', width: 'auto' }}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => handleDelete(u.id)} style={deleteBtnStyle}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无用户</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#222',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#e74c3c',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #e74c3c',
  color: '#e74c3c',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const formStyle: React.CSSProperties = {
  background: '#1a1a1a',
  padding: 20,
  borderRadius: 8,
  border: '1px solid #333',
  marginBottom: 24,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  color: '#888',
  fontSize: 13,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  color: '#e0e0e0',
  fontSize: 14,
};
