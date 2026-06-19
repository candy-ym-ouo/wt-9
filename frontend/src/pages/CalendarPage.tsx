import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Rehearsal {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  participantIds: number[];
}

export default function CalendarPage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
  });
  const { isDirector } = useAuth();

  const load = async () => {
    const data = await api.rehearsals.list();
    setRehearsals(data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.rehearsals.create(form);
    setForm({ title: '', description: '', startTime: '', endTime: '', location: '' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    await api.rehearsals.remove(id);
    load();
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');

  const colorPool = ['#e74c3c', '#e67e22', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>排练日历</h2>
        {isDirector && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '8px 16px',
              background: '#e74c3c',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {showForm ? '取消' : '+ 新排练'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: '#1a1a1a',
          padding: 20,
          borderRadius: 8,
          border: '1px solid #333',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          <input placeholder="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} />
          <input placeholder="地点" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={inputStyle} />
          <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required style={inputStyle} />
          <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required style={inputStyle} />
          <textarea placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1', minHeight: 60 }} />
          <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
            <button type="submit" style={{ padding: '8px 24px', background: '#e74c3c', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
              创建
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rehearsals.map((r, idx) => (
          <div key={r.id} style={{
            background: '#1a1a1a',
            borderRadius: 8,
            border: '1px solid #333',
            borderLeft: `4px solid ${colorPool[idx % colorPool.length]}`,
            padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 6px', color: '#e0e0e0', fontSize: 16 }}>{r.title}</h3>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {formatDate(r.startTime)} → {formatDate(r.endTime)}
                  {r.location && <span style={{ marginLeft: 16 }}>📍 {r.location}</span>}
                </div>
                {r.description && <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0' }}>{r.description}</p>}
              </div>
              {isDirector && (
                <button onClick={() => handleDelete(r.id)} style={deleteBtnStyle}>删除</button>
              )}
            </div>
          </div>
        ))}
        {rehearsals.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无排练安排</div>
        )}
      </div>
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
