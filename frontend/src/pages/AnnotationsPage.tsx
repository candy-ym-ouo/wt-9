import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Annotation {
  id: number;
  scriptContent: string;
  note: string;
  startOffset: number | null;
  endOffset: number | null;
  tag: string;
  sceneNumber: number | null;
  createdBy: number;
  createdAt: string;
}

export default function AnnotationsPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [sceneFilter, setSceneFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    scriptContent: '',
    note: '',
    tag: '',
    sceneNumber: '',
    startOffset: '',
    endOffset: '',
  });
  const { isDirector } = useAuth();

  const load = async () => {
    const data = await api.annotations.list(sceneFilter || undefined);
    setAnnotations(data);
  };

  useEffect(() => { load(); }, [sceneFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.annotations.create({
      scriptContent: form.scriptContent,
      note: form.note || undefined,
      tag: form.tag || undefined,
      sceneNumber: form.sceneNumber ? Number(form.sceneNumber) : undefined,
      startOffset: form.startOffset ? Number(form.startOffset) : undefined,
      endOffset: form.endOffset ? Number(form.endOffset) : undefined,
    });
    setForm({ scriptContent: '', note: '', tag: '', sceneNumber: '', startOffset: '', endOffset: '' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    await api.annotations.remove(id);
    load();
  };

  const tagColors: Record<string, string> = {
    '舞台指示': '#3498db',
    '情感': '#e74c3c',
    '节奏': '#e67e22',
    '走位': '#2ecc71',
    '道具': '#9b59b6',
    '灯光': '#f1c40f',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>文本批注</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="场次筛选"
            value={sceneFilter}
            onChange={(e) => setSceneFilter(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
          <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
            {showForm ? '取消' : '+ 新批注'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={formStyle}>
          <textarea placeholder="剧本原文" value={form.scriptContent} onChange={(e) => setForm({ ...form, scriptContent: e.target.value })} required style={{ ...inputStyle, minHeight: 80 }} />
          <textarea placeholder="批注笔记" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <input placeholder="标签" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} style={inputStyle} />
            <input placeholder="场次" type="number" value={form.sceneNumber} onChange={(e) => setForm({ ...form, sceneNumber: e.target.value })} style={inputStyle} />
            <input placeholder="优先级" type="number" value={form.startOffset} onChange={(e) => setForm({ ...form, startOffset: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="submit" style={primaryBtnStyle}>创建</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {annotations.map((a) => (
          <div key={a.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: '#e0e0e0', lineHeight: 1.6, marginBottom: 8, fontStyle: 'italic', borderLeft: '3px solid #444', paddingLeft: 12 }}>
                  "{a.scriptContent}"
                </div>
                {a.note && (
                  <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8, paddingLeft: 12 }}>→ {a.note}</div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.tag && (
                    <span style={{ background: tagColors[a.tag] || '#555', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                      {a.tag}
                    </span>
                  )}
                  {a.sceneNumber && (
                    <span style={{ background: '#2a2a2a', color: '#888', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                      第{a.sceneNumber}场
                    </span>
                  )}
                </div>
              </div>
              {isDirector && (
                <button onClick={() => handleDelete(a.id)} style={deleteBtnStyle}>删除</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {annotations.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无批注</div>}
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
