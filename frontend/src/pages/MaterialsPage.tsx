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
  categories: string[];
  tags: string[];
  downloadRoles: string[];
  description: string;
  createdAt: string;
}

const PRESET_CATEGORIES = ['general', 'script', 'music', 'costume', 'set', 'prop', 'video', 'photo'];
const ALL_ROLES = ['admin', 'director', 'actor', 'viewer'];
const ROLE_LABELS: Record<string, string> = { admin: '管理员', director: '导演', actor: '演员', viewer: '观察者' };

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(PRESET_CATEGORIES);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const [uploadCategories, setUploadCategories] = useState<string[]>(['general']);
  const [uploadTags, setUploadTags] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadDownloadRoles, setUploadDownloadRoles] = useState<string[]>([]);
  const [uploadCustomCat, setUploadCustomCat] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { isDirector, user } = useAuth();

  const loadMeta = async () => {
    try {
      const [cats, tags] = await Promise.all([api.materials.getCategories(), api.materials.getTags()]);
      const merged = Array.from(new Set([...PRESET_CATEGORIES, ...cats])).sort();
      setAvailableCategories(merged);
      setAvailableTags(tags);
    } catch {}
  };

  const load = async () => {
    const data = await api.materials.list({
      categories: filterCats.length > 0 ? filterCats.join(',') : undefined,
      tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
      keyword: keyword || undefined,
    });
    setMaterials(data);
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { load(); }, [filterCats, filterTags, keyword]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    let finalCategories = uploadCategories;
    if (uploadCustomCat.trim()) {
      finalCategories = [...uploadCategories, uploadCustomCat.trim()];
    }

    await api.materials.upload(file, {
      category: finalCategories[0] || 'general',
      description: uploadDesc,
      categories: finalCategories.join(','),
      tags: uploadTags,
      downloadRoles: uploadDownloadRoles.join(','),
    });
    if (fileRef.current) fileRef.current.value = '';
    setUploadDesc('');
    setUploadTags('');
    setUploadCustomCat('');
    setUploadCategories(['general']);
    setUploadDownloadRoles([]);
    load();
    loadMeta();
  };

  const handleDelete = async (id: number) => {
    await api.materials.remove(id);
    load();
    loadMeta();
  };

  const canDownload = (m: Material) => {
    if (!m.downloadRoles || m.downloadRoles.length === 0) return true;
    return user ? m.downloadRoles.includes(user.role) : false;
  };

  const handleDownload = async (m: Material) => {
    if (!canDownload(m)) {
      alert('无下载权限');
      return;
    }
    try {
      await api.materials.download(m.id);
    } catch (e) {
      alert('下载失败: ' + (e as Error).message);
    }
  };

  const toggleFilterCat = (cat: string) => {
    setFilterCats((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  };

  const toggleFilterTag = (tag: string) => {
    setFilterTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const toggleUploadCategory = (cat: string) => {
    setUploadCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  };

  const toggleUploadDownloadRole = (role: string) => {
    setUploadDownloadRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>素材库</h2>
      </div>

      <div style={{ background: '#1a1a1a', padding: 20, borderRadius: 8, border: '1px solid #333', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>分类筛选</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleFilterCat(cat)}
              style={{
                ...chipStyle,
                background: filterCats.includes(cat) ? '#e74c3c' : '#222',
                color: filterCats.includes(cat) ? '#fff' : '#aaa',
                borderColor: filterCats.includes(cat) ? '#e74c3c' : '#444',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        {availableTags.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#888', marginTop: 12, marginBottom: 8 }}>标签筛选</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleFilterTag(tag)}
                  style={{
                    ...chipStyle,
                    background: filterTags.includes(tag) ? '#3498db' : '#222',
                    color: filterTags.includes(tag) ? '#fff' : '#aaa',
                    borderColor: filterTags.includes(tag) ? '#3498db' : '#444',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ marginTop: 12 }}>
          <input
            placeholder="搜索关键词..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {isDirector && (
        <div style={{
          background: '#1a1a1a',
          padding: 20,
          borderRadius: 8,
          border: '1px solid #333',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 14, color: '#e0e0e0', marginBottom: 12, fontWeight: 600 }}>上传素材</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>选择文件</label>
              <input type="file" ref={fileRef} style={{ color: '#aaa', fontSize: 14 }} />
            </div>
            <div style={{ minWidth: 240 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>分类（多选）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleUploadCategory(cat)}
                    style={{
                      ...chipStyle,
                      fontSize: 11,
                      padding: '2px 8px',
                      background: uploadCategories.includes(cat) ? '#e74c3c' : '#222',
                      color: uploadCategories.includes(cat) ? '#fff' : '#aaa',
                      borderColor: uploadCategories.includes(cat) ? '#e74c3c' : '#444',
                    }}
                  >
                    {cat}
                  </button>
                ))}
                <input
                  placeholder="+新分类"
                  value={uploadCustomCat}
                  onChange={(e) => setUploadCustomCat(e.target.value)}
                  style={{ ...inputStyle, width: 80, padding: '2px 8px', fontSize: 11 }}
                />
              </div>
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>标签（逗号分隔）</label>
              <input
                placeholder="如: 第一幕,定稿"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>描述</label>
              <input placeholder="描述" value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>下载权限（空=所有人）</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleUploadDownloadRole(role)}
                    style={{
                      ...chipStyle,
                      fontSize: 11,
                      padding: '2px 8px',
                      background: uploadDownloadRoles.includes(role) ? '#2ecc71' : '#222',
                      color: uploadDownloadRoles.includes(role) ? '#fff' : '#aaa',
                      borderColor: uploadDownloadRoles.includes(role) ? '#2ecc71' : '#444',
                    }}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleUpload} style={primaryBtnStyle}>上传</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {materials.map((m) => (
          <div key={m.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{getIcon(m.mimeType)}</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 14, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.originalName}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {formatSize(m.size)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {(m.categories || (m.category ? [m.category] : [])).map((c) => (
                    <span key={c} style={{ ...tagStyle, background: '#3a1a1a', color: '#e74c3c', border: '1px solid #5a2a2a' }}>{c}</span>
                  ))}
                  {(m.tags || []).map((t) => (
                    <span key={t} style={{ ...tagStyle, background: '#1a2a3a', color: '#3498db', border: '1px solid #2a3a5a' }}>#{t}</span>
                  ))}
                </div>
                {m.description && (
                  <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{m.description}</div>
                )}
                {m.downloadRoles && m.downloadRoles.length > 0 && (
                  <div style={{ fontSize: 11, color: '#f39c12', marginTop: 4 }}>
                    🔒 限: {m.downloadRoles.map((r) => ROLE_LABELS[r] || r).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => handleDownload(m)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: canDownload(m) ? '#3498db' : '#555',
                  cursor: canDownload(m) ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  padding: 0,
                }}
              >
                {canDownload(m) ? '下载' : '🔒 无权限'}
              </button>
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

const chipStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #444',
  borderRadius: 12,
  cursor: 'pointer',
  fontSize: 12,
  transition: 'all 0.15s',
};

const tagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '1px 6px',
  borderRadius: 8,
};
