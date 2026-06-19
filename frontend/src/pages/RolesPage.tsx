import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface CastRole {
  id: number;
  characterName: string;
  characterDescription: string;
  actorId: number | null;
  sceneNumbers: number[];
  priority: number;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<CastRole[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    characterName: '',
    characterDescription: '',
    actorId: 0,
    priority: 0,
  });
  const { isDirector, isAdmin } = useAuth();

  const load = async () => {
    const [rolesData, usersData] = await Promise.all([api.roles.list(), api.users.list()]);
    setRoles(rolesData);
    setUsers(usersData);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.roles.create({
      ...form,
      actorId: form.actorId || null,
      sceneNumbers: [],
    });
    setForm({ characterName: '', characterDescription: '', actorId: 0, priority: 0 });
    setShowForm(false);
    load();
  };

  const handleAssign = async (roleId: number, actorId: number) => {
    await api.roles.update(roleId, { actorId: actorId || null });
    load();
  };

  const handleDelete = async (id: number) => {
    await api.roles.remove(id);
    load();
  };

  const getActorName = (actorId: number | null) => {
    if (!actorId) return '未分配';
    const u = users.find((u) => u.id === actorId);
    return u ? u.displayName || u.username : `#${actorId}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>角色分配</h2>
        {isDirector && (
          <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
            {showForm ? '取消' : '+ 新角色'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={formStyle}>
          <input placeholder="角色名" value={form.characterName} onChange={(e) => setForm({ ...form, characterName: e.target.value })} required style={inputStyle} />
          <textarea placeholder="角色描述" value={form.characterDescription} onChange={(e) => setForm({ ...form, characterDescription: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} />
          <input type="number" placeholder="优先级" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} style={inputStyle} />
          <div style={{ textAlign: 'right' }}>
            <button type="submit" style={primaryBtnStyle}>创建</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {roles.map((r) => (
          <div key={r.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 8px', color: '#e74c3c', fontSize: 16 }}>{r.characterName}</h3>
              {isDirector && (
                <button onClick={() => handleDelete(r.id)} style={deleteBtnStyle}>删除</button>
              )}
            </div>
            {r.characterDescription && (
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>{r.characterDescription}</p>
            )}
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>
              扮演者: <strong style={{ color: '#e0e0e0' }}>{getActorName(r.actorId)}</strong>
            </div>
            {isDirector && (
              <select
                value={r.actorId || 0}
                onChange={(e) => handleAssign(r.id, Number(e.target.value))}
                style={inputStyle}
              >
                <option value={0}>-- 分配演员 --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                ))}
              </select>
            )}
            {r.sceneNumbers && r.sceneNumbers.length > 0 && (
              <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
                场次: {r.sceneNumbers.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
      {roles.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无角色</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
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
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 16,
};
