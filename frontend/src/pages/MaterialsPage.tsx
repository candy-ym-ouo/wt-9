import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  version: number;
  baseName: string;
  referenceCount?: { rehearsals: number; annotations: number; total: number };
  references?: MaterialReference[];
  systemTags?: TagInfo[];
}

interface TagInfo {
  id: number;
  name: string;
  color: string;
}

interface DuplicateMaterial {
  id: number;
  originalName: string;
  version: number;
  baseName: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

const PRESET_CATEGORIES = ['general', 'script', 'music', 'costume', 'set', 'prop', 'video', 'photo'];
const ALL_ROLES = ['admin', 'director', 'actor', 'viewer'];
const ROLE_LABELS: Record<string, string> = { admin: '管理员', director: '导演', actor: '演员', viewer: '观察者' };

export default function MaterialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [materials, setMaterials] = useState<Material[]>([]);

  const urlCats = searchParams.get('categories');
  const urlTags = searchParams.get('tags');
  const urlQ = searchParams.get('q') || '';

  const [filterCats, setFilterCats] = useState<string[]>(urlCats ? urlCats.split(',') : []);
  const [filterTags, setFilterTags] = useState<string[]>(urlTags ? urlTags.split(',') : []);
  const [keyword, setKeyword] = useState(urlQ);
  const [availableCategories, setAvailableCategories] = useState<string[]>(PRESET_CATEGORIES);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [systemTags, setSystemTags] = useState<TagInfo[]>([]);
  const [selectedSystemTagIds, setSelectedSystemTagIds] = useState<number[]>(
    searchParams.get('tagIds') ? searchParams.get('tagIds')!.split(',').map(Number).filter(Boolean) : []
  );

  const [uploadCategories, setUploadCategories] = useState<string[]>(['general']);
  const [uploadTags, setUploadTags] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadDownloadRoles, setUploadDownloadRoles] = useState<string[]>([]);
  const [uploadCustomCat, setUploadCustomCat] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isDirector, user } = useAuth();

  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; refs?: { rehearsals: number; annotations: number; total: number } } | null>(null);

  const [duplicateModal, setDuplicateModal] = useState<{
    filename: string;
    duplicates: DuplicateMaterial[];
    pendingFile: File;
  } | null>(null);
  const [overwriteTargetId, setOverwriteTargetId] = useState<number | null>(null);

  const loadMeta = async () => {
    try {
      const [cats, tags] = await Promise.all([api.materials.getCategories(), api.materials.getTags()]);
      const merged = Array.from(new Set([...PRESET_CATEGORIES, ...cats])).sort();
      setAvailableCategories(merged);
      setAvailableTags(tags);
    } catch {}
  };

  const loadSystemTags = async () => {
    try {
      const data = await api.tags.list({ category: 'material' });
      setSystemTags(data);
    } catch {}
  };

  const load = async () => {
    let data = await api.materials.list({
      categories: filterCats.length > 0 ? filterCats.join(',') : undefined,
      tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
      keyword: keyword || undefined,
    });

    if (selectedSystemTagIds.length > 0) {
      try {
        const filterResult = await api.tags.filterByTags(selectedSystemTagIds, 'material');
        const validIds = new Set(filterResult.targetIds);
        data = data.filter((m: any) => validIds.has(m.id));
      } catch {}
    }

    const materialsWithTags = await Promise.all(
      data.map(async (m: any) => {
        try {
          const tags = await api.tags.getTagsForTarget('material', m.id);
          return { ...m, systemTags: tags };
        } catch {
          return m;
        }
      })
    );
    setMaterials(materialsWithTags);
  };

  useEffect(() => { loadMeta(); loadSystemTags(); }, []);
  useEffect(() => { load(); }, [filterCats, filterTags, keyword, selectedSystemTagIds]);

  const syncUrlParams = () => {
    const params = new URLSearchParams(searchParams);
    if (keyword.trim()) {
      params.set('q', keyword.trim());
    } else {
      params.delete('q');
    }
    if (filterCats.length > 0) {
      params.set('categories', filterCats.join(','));
    } else {
      params.delete('categories');
    }
    if (filterTags.length > 0) {
      params.set('tags', filterTags.join(','));
    } else {
      params.delete('tags');
    }
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    syncUrlParams();
  }, [keyword, filterCats, filterTags]);

  useEffect(() => {
    const materialIdParam = searchParams.get('materialId');
    const qParam = searchParams.get('q');
    const catsParam = searchParams.get('categories');
    const tagsParam = searchParams.get('tags');

    if (qParam && qParam !== keyword) {
      setKeyword(qParam);
    }
    if (catsParam && catsParam !== filterCats.join(',')) {
      setFilterCats(catsParam.split(','));
    }
    if (tagsParam && tagsParam !== filterTags.join(',')) {
      setFilterTags(tagsParam.split(','));
    }

    if (materialIdParam && materials.length > 0) {
      const id = Number(materialIdParam);
      const exists = materials.some((m) => m.id === id);
      if (exists) {
        handleViewDetail(id);
        const params = new URLSearchParams(searchParams);
        params.delete('materialId');
        setSearchParams(params, { replace: true });
      }
    }
  }, [searchParams, materials]);

  const buildUploadParams = () => {
    let finalCategories = uploadCategories;
    if (uploadCustomCat.trim()) {
      finalCategories = [...uploadCategories, uploadCustomCat.trim()];
    }
    return {
      category: finalCategories[0] || 'general',
      description: uploadDesc,
      categories: finalCategories.join(','),
      tags: uploadTags,
      downloadRoles: uploadDownloadRoles.join(','),
    };
  };

  const resetUploadForm = () => {
    if (fileRef.current) fileRef.current.value = '';
    setUploadDesc('');
    setUploadTags('');
    setUploadCustomCat('');
    setUploadCategories(['general']);
    setUploadDownloadRoles([]);
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const result = await api.materials.checkDuplicate(file.name);
      if (result.exists && result.materials.length > 0) {
        setDuplicateModal({
          filename: file.name,
          duplicates: result.materials as DuplicateMaterial[],
          pendingFile: file,
        });
        setOverwriteTargetId(result.materials[result.materials.length - 1].id);
        setUploading(false);
        return;
      }

      await api.materials.upload(file, buildUploadParams());
      resetUploadForm();
      load();
      loadMeta();
    } catch (e) {
      alert('上传失败: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDuplicateNewVersion = async () => {
    if (!duplicateModal) return;
    setUploading(true);
    try {
      await api.materials.upload(duplicateModal.pendingFile, {
        ...buildUploadParams(),
        onDuplicate: 'new_version',
      });
      resetUploadForm();
      setDuplicateModal(null);
      setOverwriteTargetId(null);
      load();
      loadMeta();
    } catch (e) {
      alert('上传失败: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDuplicateOverwrite = async () => {
    if (!duplicateModal || !overwriteTargetId) return;
    setUploading(true);
    try {
      await api.materials.upload(duplicateModal.pendingFile, {
        ...buildUploadParams(),
        onDuplicate: 'overwrite',
        overwriteTargetId,
      });
      resetUploadForm();
      setDuplicateModal(null);
      setOverwriteTargetId(null);
      load();
      loadMeta();
    } catch (e) {
      alert('覆盖失败: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateModal(null);
    setOverwriteTargetId(null);
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

  const versionBadge = (version: number) => {
    if (!version || version <= 1) return null;
    return (
      <span style={{
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 8,
        background: 'rgba(155, 89, 182, 0.2)',
        color: '#9b59b6',
        border: '1px solid rgba(155, 89, 182, 0.4)',
        marginLeft: 6,
        fontWeight: 600,
      }}>
        v{version}
      </span>
    );
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

        {systemTags.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #333' }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
              🏷️ 统一标签筛选 {selectedSystemTagIds.length > 0 && <span style={{ color: '#3498db' }}>(已选 {selectedSystemTagIds.length} 个)</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {systemTags.map((tag) => {
                const selected = selectedSystemTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setSelectedSystemTagIds((prev) =>
                        selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                      );
                      const params = new URLSearchParams(searchParams);
                      const newIds = selected
                        ? selectedSystemTagIds.filter((id) => id !== tag.id)
                        : [...selectedSystemTagIds, tag.id];
                      if (newIds.length > 0) {
                        params.set('tagIds', newIds.join(','));
                      } else {
                        params.delete('tagIds');
                      }
                      setSearchParams(params, { replace: true });
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 14,
                      border: `1px solid ${selected ? tag.color : '#444'}`,
                      background: selected ? `${tag.color}20` : 'transparent',
                      color: selected ? tag.color : '#aaa',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: tag.color,
                    }} />
                    {tag.name}
                  </button>
                );
              })}
              {selectedSystemTagIds.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedSystemTagIds([]);
                    const params = new URLSearchParams(searchParams);
                    params.delete('tagIds');
                    setSearchParams(params, { replace: true });
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 14,
                    border: '1px solid #555',
                    background: 'transparent',
                    color: '#888',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  清除
                </button>
              )}
            </div>
          </div>
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
            <button onClick={handleUpload} disabled={uploading} style={{
              ...primaryBtnStyle,
              opacity: uploading ? 0.6 : 1,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}>
              {uploading ? '上传中...' : '上传'}
            </button>
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
                  style={{ fontSize: 14, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => handleViewDetail(m.id)}
                  title="查看详情"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.originalName}</span>
                  {versionBadge(m.version)}
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
                {m.systemTags && m.systemTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {m.systemTags.map((tag) => (
                      <span
                        key={tag.id}
                        style={{
                          padding: '2px 8px',
                          background: `${tag.color}20`,
                          border: `1px solid ${tag.color}40`,
                          color: tag.color,
                          borderRadius: 10,
                          fontSize: 10,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
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

      {duplicateModal && (
        <div style={modalOverlayStyle} onClick={handleDuplicateCancel}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>⚠️ 检测到同名素材</h3>
              <button onClick={handleDuplicateCancel} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{
              padding: '12px 16px',
              background: 'rgba(243, 156, 18, 0.1)',
              border: '1px solid rgba(243, 156, 18, 0.3)',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{ color: '#f39c12', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                文件「{duplicateModal.filename}」已存在 {duplicateModal.duplicates.length} 个版本
              </div>
              <div style={{ color: '#aaa', fontSize: 12 }}>
                请选择上传方式：创建为新版本，或覆盖已有版本的文件内容
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>已有版本：</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {duplicateModal.duplicates.map((d) => (
                  <label
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: overwriteTargetId === d.id ? '#2a1a2a' : '#222',
                      border: `1px solid ${overwriteTargetId === d.id ? '#9b59b6' : '#333'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="overwriteTarget"
                      checked={overwriteTargetId === d.id}
                      onChange={() => setOverwriteTargetId(d.id)}
                      style={{ accentColor: '#9b59b6' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e0e0e0', display: 'flex', alignItems: 'center' }}>
                        {d.originalName}
                        {versionBadge(d.version)}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {formatSize(d.size)} · {new Date(d.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleDuplicateCancel}
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
                onClick={handleDuplicateOverwrite}
                disabled={!overwriteTargetId || uploading}
                style={{
                  padding: '8px 16px',
                  background: overwriteTargetId && !uploading ? '#e67e22' : '#555',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: overwriteTargetId && !uploading ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {uploading ? '覆盖中...' : '覆盖所选版本'}
              </button>
              <button
                onClick={handleDuplicateNewVersion}
                disabled={uploading}
                style={{
                  padding: '8px 16px',
                  background: !uploading ? '#9b59b6' : '#555',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: !uploading ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {uploading ? '创建中...' : '创建为新版本'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div style={{ color: '#e0e0e0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  {detailMaterial.originalName}
                  {versionBadge(detailMaterial.version)}
                </div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                  {formatSize(detailMaterial.size)} · {detailMaterial.mimeType}
                </div>
              </div>
            </div>

            {detailMaterial.version > 1 && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(155, 89, 182, 0.1)',
                border: '1px solid rgba(155, 89, 182, 0.3)',
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 12,
                color: '#9b59b6',
              }}>
                📌 版本 {detailMaterial.version} · 原始文件名: {detailMaterial.baseName}
              </div>
            )}

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
            {detailMaterial.systemTags && detailMaterial.systemTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {detailMaterial.systemTags.map((tag) => (
                  <span
                    key={tag.id}
                    style={{
                      padding: '2px 8px',
                      background: `${tag.color}20`,
                      border: `1px solid ${tag.color}40`,
                      color: tag.color,
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

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
                {canDownload(detailMaterial) ? `下载${detailMaterial.version > 1 ? ` (v${detailMaterial.version})` : ''}` : '🔒 无权限'}
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
