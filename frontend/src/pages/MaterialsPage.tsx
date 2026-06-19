import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Material {
  id: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: string;
  description: string;
  createdAt: string;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [category, setCategory] = useState('');
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadDesc, setUploadDesc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { isDirector } = useAuth();

  const load = async () => {
    const data = await api.materials.list(category || undefined);
    setMaterials(data);
  };

  useEffect(() => { load(); }, [category]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    await api.materials.upload(file, uploadCategory, uploadDesc);
    if (fileRef.current) fileRef.current.value = '';
    setUploadDesc('');
    load();
  };

  const handleDelete = async (id: number) => {
    await api.materials.remove(id);
    load();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const getIcon = (mime: string) => {
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.startsWith('video/')) return '🎬';
    if (mime.startsWith('audio/')) return '🎵';
    if (mime.includes('pdf')) return '📄';
    return '📎';
  };

  const categories = ['general', 'script', 'music', 'costume', 'set', 'prop', 'video', 'photo'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>素材上传</h2>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="">全部分类</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{
        background: '#1a1a1a',
        padding: 20,
        borderRadius: 8,
        border: '1px solid #333',
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>选择文件</label>
          <input type="file" ref={fileRef} style={{ color: '#aaa', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>分类</label>
          <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} style={{ ...inputStyle, width: 120 }}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>描述</label>
          <input placeholder="描述" value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={handleUpload} style={primaryBtnStyle}>上传</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {materials.map((m) => (
          <div key={m.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{getIcon(m.mimeType)}</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 14, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.originalName}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {formatSize(m.size)} · {m.category}
                </div>
                {m.description && (
                  <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{m.description}</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <a
                href={api.materials.downloadUrl(m.id)}
                style={{ fontSize: 12, color: '#3498db', textDecoration: 'none' }}
              >
                下载
              </a>
              {isDirector && (
                <button onClick={() => handleDelete(m.id)} style={deleteBtnStyle}>删除</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {materials.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无素材</div>}
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
  padding: '2px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 16,
};
