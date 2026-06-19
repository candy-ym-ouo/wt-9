import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface MaterialReference {
  type: 'rehearsal' | 'annotation';
  id: number;
  title: string;
  detail?: string;
}

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
  referenceCount?: { rehearsals: number; annotations: number; total: number };
  references?: MaterialReference[];
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

  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; refs?: { rehearsals: number; annotations: number; total: number } } | null>(null);

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

  const handleDeleteClick = async (m: Material) => {
    const refCount = m.referenceCount;
    if (refCount && refCount.total > 0) {
      setDeleteConfirm({ id: m.id, name: m.originalName, refs: refCount });
    } else {
      setDeleteConfirm({ id: m.id, name: m.originalName });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await api.materials.remove(deleteConfirm.id);
      setDeleteConfirm(null);
      load();
      loadMeta();
    } catch (e: any) {
      const msg = e.message || '删除失败';
      try {
        const parsed = JSON.parse(msg);
        alert(parsed.message || msg);
      } catch {
        alert(msg);
      }
      setDeleteConfirm(null);
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const data = await api.materials.get(id);
      setDetailMaterial(data);
    } catch {}
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
                <div
                  style={{ fontSize: 14, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                  onClick={() => handleViewDetail(m.id)}
                  title="查看详情"
                >
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
                {m.referenceCount && m.referenceCount.total > 0 && (
                  <div style={{ fontSize: 11, color: '#f39c12', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>🔗 引用: {m.referenceCount.rehearsals} 个排练, {m.referenceCount.annotations} 个批注</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => handleViewDetail(m.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3498db',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                }}
              >
                详情
              </button>
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
                <button onClick={() => handleDeleteClick(m)} style={deleteBtnStyle}>删除</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {materials.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无素材</div>}

      {detailMaterial && (
        <div style={modalOverlayStyle} onClick={() => setDetailMaterial(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>素材详情</h3>
              <button onClick={() => setDetailMaterial(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 36 }}>{getIcon(detailMaterial.mimeType)}</span>
              <div>
                <div style={{ color: '#e0e0e0', fontSize: 15, fontWeight: 600 }}>{detailMaterial.originalName}</div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                  {formatSize(detailMaterial.size)} · {detailMaterial.mimeType}
                </div>
              </div>
            </div>

            {detailMaterial.description && (
              <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>{detailMaterial.description}</div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {(detailMaterial.categories || []).map((c) => (
                <span key={c} style={{ ...tagStyle, background: '#3a1a1a', color: '#e74c3c', border: '1px solid #5a2a2a' }}>{c}</span>
              ))}
              {(detailMaterial.tags || []).map((t) => (
                <span key={t} style={{ ...tagStyle, background: '#1a2a3a', color: '#3498db', border: '1px solid #2a3a5a' }}>#{t}</span>
              ))}
            </div>

            {detailMaterial.downloadRoles && detailMaterial.downloadRoles.length > 0 && (
              <div style={{ fontSize: 12, color: '#f39c12', marginBottom: 12 }}>
                🔒 下载权限: {detailMaterial.downloadRoles.map((r) => ROLE_LABELS[r] || r).join(', ')}
              </div>
            )}

            <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
              创建时间: {new Date(detailMaterial.createdAt).toLocaleString('zh-CN')}
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
              <div style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 600, marginBottom: 12 }}>
                🔗 引用关系
                {detailMaterial.referenceCount && detailMaterial.referenceCount.total > 0 && (
                  <span style={{ fontWeight: 400, fontSize: 12, color: '#f39c12', marginLeft: 8 }}>
                    ({detailMaterial.referenceCount.rehearsals} 个排练, {detailMaterial.referenceCount.annotations} 个批注)
                  </span>
                )}
              </div>
              {detailMaterial.references && detailMaterial.references.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detailMaterial.references.map((ref, idx) => (
                    <div
                      key={`${ref.type}-${ref.id}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: '#222',
                        borderRadius: 6,
                        border: '1px solid #333',
                      }}
                    >
                      <span style={{ fontSize: 16 }}>
                        {ref.type === 'rehearsal' ? '📅' : '📝'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#e0e0e0' }}>
                          {ref.title}
                        </div>
                        {ref.detail && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{ref.detail}</div>
                        )}
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        background: ref.type === 'rehearsal' ? 'rgba(230,126,34,0.15)' : 'rgba(46,204,113,0.15)',
                        border: `1px solid ${ref.type === 'rehearsal' ? '#e67e22' : '#2ecc71'}`,
                        color: ref.type === 'rehearsal' ? '#e67e22' : '#2ecc71',
                        borderRadius: 10,
                        fontSize: 11,
                      }}>
                        {ref.type === 'rehearsal' ? '排练' : '批注'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 16 }}>暂无引用</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => handleDownload(detailMaterial)} style={{
                ...primaryBtnStyle,
                background: canDownload(detailMaterial) ? '#3498db' : '#555',
                cursor: canDownload(detailMaterial) ? 'pointer' : 'not-allowed',
              }}>
                {canDownload(detailMaterial) ? '下载' : '🔒 无权限'}
              </button>
              <button onClick={() => setDetailMaterial(null)} style={{
                padding: '8px 16px',
                background: '#333',
                border: 'none',
                borderRadius: 6,
                color: '#aaa',
                cursor: 'pointer',
                fontSize: 14,
              }}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={modalOverlayStyle} onClick={() => setDeleteConfirm(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#e0e0e0', fontSize: 16 }}>确认删除</h3>

            <div style={{ color: '#aaa', fontSize: 14, marginBottom: 16 }}>
              确定要删除文件 <strong style={{ color: '#e0e0e0' }}>{deleteConfirm.name}</strong> 吗？
            </div>

            {deleteConfirm.refs && deleteConfirm.refs.total > 0 && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(231, 76, 60, 0.1)',
                border: '1px solid rgba(231, 76, 60, 0.3)',
                borderRadius: 8,
                marginBottom: 16,
              }}>
                <div style={{ color: '#e74c3c', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  ⚠️ 该素材正在被引用
                </div>
                <div style={{ color: '#e74c3c', fontSize: 12 }}>
                  被 {deleteConfirm.refs.rehearsals} 个排练和 {deleteConfirm.refs.annotations} 个批注引用
                </div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
                  删除后相关排练和批注中的引用将失效，是否继续？
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 16px',
                  background: '#333',
                  border: 'none',
                  borderRadius: 6,
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: '8px 16px',
                  background: '#e74c3c',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
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

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 12,
  padding: 24,
  width: '90%',
  maxWidth: 560,
  maxHeight: '80vh',
  overflowY: 'auto',
};
