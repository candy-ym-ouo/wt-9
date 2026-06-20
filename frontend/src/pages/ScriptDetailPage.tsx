import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type TabKey = 'overview' | 'chapters' | 'scenes' | 'content' | 'annotations' | 'versions' | 'search';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: '#f39c12', bg: 'rgba(243, 156, 18, 0.15)' },
  published: { label: '已发布', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.15)' },
  archived: { label: '已归档', color: '#7f8c8d', bg: 'rgba(127, 140, 141, 0.15)' },
};

const VERSION_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: '创建', color: '#2ecc71' },
  update: { label: '更新', color: '#3498db' },
  upload: { label: '上传', color: '#9b59b6' },
  restore: { label: '恢复', color: '#f39c12' },
  publish: { label: '发布', color: '#1abc9c' },
  archive: { label: '归档', color: '#7f8c8d' },
};

const LOC_TYPE_LABELS: Record<string, string> = {
  int: '内景', ext: '外景', int_ext: '内/外景', unknown: '场景类型未知',
};
const TOD_LABELS: Record<string, string> = {
  day: '白天', night: '夜晚', dawn: '黎明', dusk: '黄昏', unknown: '时间未知',
};

export default function ScriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const scriptId = id ? Number(id) : 0;
  const navigate = useNavigate();
  const { isDirector, user } = useAuth();

  const [script, setScript] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);

  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [annotationScope, setAnnotationScope] = useState<{ chapterId?: number; sceneId?: number; sceneNumber?: number } | null>(null);
  const [annForm, setAnnForm] = useState({ scriptContent: '', note: '', tag: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [highlightChapterId, setHighlightChapterId] = useState<number | null>(null);
  const [highlightSceneId, setHighlightSceneId] = useState<number | null>(null);

  const [allMaterials, setAllMaterials] = useState<any[]>([]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: '概览', icon: '📋' },
    { key: 'chapters', label: '章节', icon: '📖' },
    { key: 'scenes', label: '场次', icon: '🎬' },
    { key: 'content', label: '原文', icon: '📄' },
    { key: 'annotations', label: '批注', icon: '📝' },
    { key: 'versions', label: '版本', icon: '🕐' },
    { key: 'search', label: '站内搜索', icon: '🔍' },
  ];

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await api.scripts.get(scriptId);
      setScript(data);
      setEditForm({
        title: data.title,
        originalTitle: data.originalTitle,
        author: data.author,
        translator: data.translator,
        description: data.description,
        synopsis: data.synopsis,
        estimatedDuration: data.estimatedDuration,
        tags: data.tags?.join(',') || '',
        genre: data.genre?.join(',') || '',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const vs = await api.scripts.getVersions(scriptId);
      setVersions(vs);
    } catch {}
  };

  const loadMaterials = async () => {
    try {
      const ms = await api.materials.list();
      setAllMaterials(ms);
    } catch {}
  };

  useEffect(() => { loadAll(); loadMaterials(); }, [scriptId]);
  useEffect(() => { if (activeTab === 'versions') loadVersions(); }, [activeTab]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === 'search' && searchQuery.trim()) {
        doSearch();
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, activeTab]);

  const doSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.scripts.search(searchQuery.trim(), scriptId);
      setSearchResults(res);
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!editForm.title?.trim()) { alert('标题不能为空'); return; }
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        tags: editForm.tags ? editForm.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        genre: editForm.genre ? editForm.genre.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        estimatedDuration: editForm.estimatedDuration ? Number(editForm.estimatedDuration) : undefined,
        changeNote: editNote || undefined,
      };
      const updated = await api.scripts.update(scriptId, payload);
      setScript(updated);
      setEditing(false);
      setEditNote('');
    } catch (e: any) {
      alert('保存失败: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId: number) => {
    try {
      const updated = await api.scripts.restoreVersion(scriptId, versionId);
      setScript(updated);
      setRestoreConfirm(null);
      setShowVersions(false);
      alert('恢复成功！');
      loadAll();
      loadVersions();
    } catch (e: any) {
      alert('恢复失败: ' + (e.message || e));
    }
  };

  const handlePublish = async () => {
    try {
      await api.scripts.publish(scriptId);
      loadAll();
    } catch (e: any) { alert(e.message || '操作失败'); }
  };

  const handleArchive = async () => {
    if (!confirm('确定归档此剧本吗？')) return;
    try {
      await api.scripts.archive(scriptId);
      loadAll();
    } catch (e: any) { alert(e.message || '操作失败'); }
  };

  const handleReparse = async () => {
    if (!confirm('重新解析将重建章节和场次，确定吗？')) return;
    try {
      const updated = await api.scripts.reparse(scriptId);
      setScript(updated);
      alert('重新解析成功！');
    } catch (e: any) { alert(e.message || '解析失败'); }
  };

  const openAnnotationForm = (scope: { chapterId?: number; sceneId?: number; sceneNumber?: number } | null) => {
    setAnnotationScope(scope);
    setAnnForm({ scriptContent: '', note: '', tag: '' });
    setShowAnnotationForm(true);
  };

  const handleCreateAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.scriptContent.trim()) { alert('请填写剧本原文'); return; }
    try {
      const sc = script?.scenes?.find((s: any) => s.id === annotationScope?.sceneId);
      await api.annotations.create({
        scriptContent: annForm.scriptContent,
        note: annForm.note || undefined,
        tag: annForm.tag || undefined,
        scriptId: scriptId,
        chapterId: annotationScope?.chapterId || undefined,
        sceneId: annotationScope?.sceneId || undefined,
        sceneNumber: annotationScope?.sceneNumber || sc?.sceneNumber || undefined,
      });
      alert('批注创建成功！');
      setShowAnnotationForm(false);
      setAnnotationScope(null);
      setAnnForm({ scriptContent: '', note: '', tag: '' });
      loadAll();
    } catch (e: any) {
      alert('创建失败: ' + (e.message || e));
    }
  };

  const scrollToChapter = (chapterId: number) => {
    setActiveTab('chapters');
    setHighlightChapterId(chapterId);
    setTimeout(() => {
      const el = document.getElementById(`chapter-${chapterId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => setHighlightChapterId(null), 2000);
    }, 200);
  };

  const scrollToScene = (sceneId: number) => {
    setActiveTab('scenes');
    setHighlightSceneId(sceneId);
    setTimeout(() => {
      const el = document.getElementById(`scene-${sceneId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => setHighlightSceneId(null), 2000);
    }, 200);
  };

  const statusBadge = (s: any) => {
    const st = STATUS_LABELS[s?.status || 'draft'];
    return (
      <span style={{
        fontSize: 11, padding: '2px 10px', borderRadius: 10,
        background: st.bg, color: st.color, border: `1px solid ${st.color}40`,
      }}>
        {st.label}
      </span>
    );
  };

  const totalAnnotations = script?.annotationCount || script?.annotations?.length || 0;
  const characters = script?.characterNames || [];
  const chapters = script?.chapters || [];
  const scenes = script?.scenes || [];
  const annotations = script?.annotations || [];
  const groupedAnnotations = useMemo(() => {
    const groups: Record<string, any> = {};
    groups['__all__'] = { label: '全部批注', items: [] as any[] };
    (script?.annotations || []).forEach((a: any) => {
      groups['__all__'].items.push(a);
      const key = a.sceneId ? `scene_${a.sceneId}` : a.chapterId ? `chapter_${a.chapterId}` : 'orphan';
      if (!groups[key]) {
        const sc = script?.scenes?.find((s: any) => s.id === a.sceneId);
        const ch = script?.chapters?.find((c: any) => c.id === a.chapterId);
        groups[key] = {
          label: sc ? `第${sc.sceneNumber}场 · ${sc.location || '未命名'}` : ch ? `第${ch.chapterNumber}章 · ${ch.title || '未命名'}` : '未指定位置',
          sceneId: sc?.id,
          chapterId: ch?.id,
          items: [] as any[],
        };
      }
      groups[key].items.push(a);
    });
    return groups;
  }, [script]);

  if (loading && !script) {
    return <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>加载中...</div>;
  }

  if (!script) {
    return <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>剧本不存在或加载失败</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/scripts')} style={{ ...iconBtnStyle, fontSize: 18 }} title="返回列表">←</button>
            <h2 style={{ margin: 0, color: '#e0e0e0', fontSize: 22 }}>{script.title}</h2>
            {statusBadge(script)}
            {script.currentVersion && (
              <span style={{ fontSize: 11, color: '#9b59b6', background: 'rgba(155,89,182,0.15)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(155,89,182,0.3)' }}>
                v{script.currentVersion}
              </span>
            )}
          </div>
          {script.originalTitle && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>原名: {script.originalTitle}</div>}
          <div style={{ fontSize: 13, color: '#888' }}>
            {script.author && <span>✍️ 作者: {script.author}</span>}
            {script.translator && <span style={{ marginLeft: 12 }}>📖 译者: {script.translator}</span>}
            {script.createdAt && <span style={{ marginLeft: 12 }}>📅 创建: {new Date(script.createdAt).toLocaleDateString('zh-CN')}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isDirector && (
            <>
              <button onClick={() => setEditing(true)} style={secondaryBtnStyle}>✏️ 编辑</button>
              <button onClick={handleReparse} style={secondaryBtnStyle}>🔄 重新解析</button>
              {script.status === 'draft' && <button onClick={handlePublish} style={{ ...secondaryBtnStyle, borderColor: '#2ecc71', color: '#2ecc71' }}>📤 发布</button>}
              {script.status !== 'archived' && <button onClick={handleArchive} style={secondaryBtnStyle}>📦 归档</button>}
            </>
          )}
          <button onClick={() => { setShowVersions(true); loadVersions(); }} style={secondaryBtnStyle}>
            🕐 历史版本 {versions.length > 0 ? `(${versions.length})` : ''}
          </button>
        </div>
      </div>

      {editing && isDirector && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>编辑剧本信息</h3>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div><label style={labelStyle}>标题</label><input value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>原名</label><input value={editForm.originalTitle || ''} onChange={(e) => setEditForm({ ...editForm, originalTitle: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>作者</label><input value={editForm.author || ''} onChange={(e) => setEditForm({ ...editForm, author: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>译者</label><input value={editForm.translator || ''} onChange={(e) => setEditForm({ ...editForm, translator: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>预计时长（分钟）</label><input type="number" value={editForm.estimatedDuration || ''} onChange={(e) => setEditForm({ ...editForm, estimatedDuration: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>类型（逗号分隔）</label><input value={editForm.genre || ''} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })} placeholder="如: 悲剧,正剧" style={inputStyle} /></div>
            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>标签（逗号分隔）</label><input value={editForm.tags || ''} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="如: 经典,必看" style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>描述/简介</label>
            <textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>剧情梗概</label>
            <textarea value={editForm.synopsis || ''} onChange={(e) => setEditForm({ ...editForm, synopsis: e.target.value })} style={{ ...inputStyle, minHeight: 80 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>变更说明（可选，将写入版本历史）</label>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="如: 更新简介" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={secondaryBtnStyle}>取消</button>
            <button onClick={handleSave} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#1a1a1a', padding: 4, borderRadius: 8, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, minWidth: 80,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === t.key ? '#e74c3c' : 'transparent',
              color: activeTab === t.key ? '#fff' : '#aaa',
              fontWeight: activeTab === t.key ? 600 : 400,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={panelStyle}>
            <h4 style={{ margin: '0 0 10px', color: '#ccc', fontSize: 13 }}>基础信息</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <StatRow label="格式" value={script.format ? ({ plain_text: '纯文本', fountain: 'Fountain', final_draft: 'Final Draft', word: 'Word' } as any)[script.format] : '-'} />
              <StatRow label="章节数" value={script.chapterCount || 0} highlight />
              <StatRow label="场次" value={script.sceneCount || 0} highlight />
              <StatRow label="字数" value={(script.wordCount || 0).toLocaleString()} />
              <StatRow label="字符数" value={(script.characterCount || 0).toLocaleString()} />
              <StatRow label="批注" value={totalAnnotations} />
              {script.sourceFileName && <StatRow label="源文件" value={script.sourceFileName} />}
              {script.sourceFileSize && <StatRow label="源文件大小" value={`${(script.sourceFileSize / 1024).toFixed(1)} KB`} />}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, color: '#ccc', fontSize: 13 }}>角色列表（{characters.length}）</h4>
              <span style={{ fontSize: 11, color: '#666' }}>自动提取</span>
            </div>
            {characters.length === 0 ? (
              <div style={{ fontSize: 12, color: '#555' }}>暂无角色</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {characters.map((c: string) => (
                  <span key={c} style={{
                    padding: '4px 10px', background: 'rgba(230,126,34,0.1)',
                    border: '1px solid rgba(230,126,34,0.3)',
                    color: '#e67e22', borderRadius: 12, fontSize: 12,
                  }}>
                    🎭 {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, color: '#ccc', fontSize: 13 }}>标签</h4>
            </div>
            {!script.tags || script.tags.length === 0 ? (
              <div style={{ fontSize: 12, color: '#555' }}>暂无标签</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {script.tags.map((t: string) => (
                  <span key={t} style={{
                    padding: '3px 10px', background: 'rgba(155,89,182,0.12)',
                    border: '1px solid rgba(155,89,182,0.3)',
                    color: '#9b59b6', borderRadius: 10, fontSize: 11,
                  }}>#{t}</span>
                ))}
              </div>
            )}
          </div>

          {script.description && (
            <div style={{ gridColumn: '1 / -1', ...panelStyle }}>
              <h4 style={{ margin: '0 0 8px', color: '#ccc', fontSize: 13 }}>描述/简介</h4>
              <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7 }}>{script.description}</div>
            </div>
          )}

          {script.synopsis && (
            <div style={{ gridColumn: '1 / -1', ...panelStyle }}>
              <h4 style={{ margin: '0 0 8px', color: '#ccc', fontSize: 13 }}>剧情梗概</h4>
              <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{script.synopsis}</div>
            </div>
          )}

          {chapters.length > 0 && (
            <div style={{ gridColumn: '1 / -1', ...panelStyle }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ margin: 0, color: '#ccc', fontSize: 13 }}>章节目录（{chapters.length}）</h4>
                <button onClick={() => setActiveTab('chapters')} style={{ fontSize: 12, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer' }}>详细 →</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {chapters.map((ch: any, idx: number) => (
                  <div
                    key={ch.id}
                    onClick={() => scrollToChapter(ch.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(231,76,60,0.08)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'; }}
                  >
                    <div style={{ fontSize: 13, color: '#ddd' }}>
                      <span style={{ color: '#e74c3c', fontWeight: 600, marginRight: 8 }}>第{ch.chapterNumber}章</span>
                      {ch.title}
                      {ch.sceneCount > 0 && <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>{ch.sceneCount} 场</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#666' }}>{(ch.wordCount || 0).toLocaleString()} 字</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'chapters' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <div style={panelStyle}>
              <div style={{ fontWeight: 600, color: '#ccc', fontSize: 13, marginBottom: 10 }}>章节导航</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {chapters.map((ch: any) => (
                  <button
                    key={ch.id}
                    onClick={() => { setSelectedChapterId(ch.id); document.getElementById(`chapter-${ch.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    style={{
                      textAlign: 'left', padding: '6px 10px', fontSize: 12,
                      borderRadius: 6, cursor: 'pointer',
                      background: selectedChapterId === ch.id ? 'rgba(231,76,60,0.15)' : 'transparent',
                      border: `1px solid ${selectedChapterId === ch.id ? '#e74c3c' : 'transparent'}`,
                      color: selectedChapterId === ch.id ? '#e74c3c' : '#aaa',
                    }}
                  >
                    第{ch.chapterNumber}章 {ch.title?.slice(0, 14)}
                    {ch.title?.length > 14 ? '...' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {chapters.length === 0 ? (
              <div style={panelStyle}><div style={{ textAlign: 'center', color: '#555', padding: 24 }}>暂无章节信息</div></div>
            ) : chapters.map((ch: any) => {
              const chAnnotations = annotations.filter((a: any) => a.chapterId === ch.id);
              return (
                <div
                  key={ch.id}
                  id={`chapter-${ch.id}`}
                  style={{
                    ...panelStyle,
                    scrollMarginTop: 80,
                    ...(highlightChapterId === ch.id ? { borderColor: '#f39c12', boxShadow: '0 0 12px rgba(243,156,18,0.3)' } : {}),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#e74c3c' }}>第{ch.chapterNumber}章</span>
                        <h3 style={{ margin: 0, fontSize: 18, color: '#e0e0e0' }}>{ch.title}</h3>
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {ch.sceneCount} 场 · {(ch.wordCount || 0).toLocaleString()} 字
                        {chAnnotations.length > 0 && ` · 📝 ${chAnnotations.length} 条批注`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isDirector && (
                        <button
                          onClick={() => alert('章节编辑功能开发中')}
                          style={{ ...iconBtnStyle, width: 'auto', padding: '4px 10px', fontSize: 12 }}
                        >✏️ 编辑</button>
                      )}
                      <button
                        onClick={() => openAnnotationForm({ chapterId: ch.id })}
                        style={{ ...iconBtnStyle, width: 'auto', padding: '4px 10px', fontSize: 12, borderColor: '#9b59b6', color: '#9b59b6' }}
                      >📝 + 批注</button>
                    </div>
                  </div>
                  {ch.summary && <div style={{ color: '#888', fontSize: 12, marginBottom: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>📌 {ch.summary}</div>}
                  {ch.content && (
                    <div style={{
                      maxHeight: 300, overflow: 'auto',
                      background: '#0f0f0f', padding: 12, borderRadius: 6,
                      fontFamily: 'Menlo, Consolas, monospace', fontSize: 12,
                      lineHeight: 1.8, color: '#bbb', whiteSpace: 'pre-wrap',
                      border: '1px solid #2a2a2a',
                    }}>
                      {ch.content}
                    </div>
                  )}

                  {ch.scenes?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>本章场次（{ch.scenes.length}）</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ch.scenes.map((sc: any) => (
                          <button
                            key={sc.id}
                            onClick={() => scrollToScene(sc.id)}
                            style={{
                              padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                              background: 'rgba(230,126,34,0.1)',
                              border: '1px solid rgba(230,126,34,0.3)',
                              color: '#e67e22', borderRadius: 10,
                            }}
                          >
                            🎬 第{sc.sceneNumber}场 {sc.location?.slice(0, 8)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chAnnotations.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>本章批注（{chAnnotations.length}）</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {chAnnotations.slice(0, 3).map((a: any) => (
                          <div key={a.id} style={{ padding: 8, background: 'rgba(155,89,182,0.08)', borderRadius: 6, border: '1px solid rgba(155,89,182,0.2)', fontSize: 12 }}>
                            <div style={{ color: '#ccc', fontStyle: 'italic' }}>"{a.scriptContent.slice(0, 60)}{a.scriptContent.length > 60 ? '...' : ''}"</div>
                            {a.note && <div style={{ color: '#aaa', marginTop: 4 }}>→ {a.note}</div>}
                          </div>
                        ))}
                        {chAnnotations.length > 3 && <div style={{ fontSize: 11, color: '#666' }}>还有 {chAnnotations.length - 3} 条...</div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'scenes' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 220, flexShrink: 0, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <div style={panelStyle}>
              <div style={{ fontWeight: 600, color: '#ccc', fontSize: 13, marginBottom: 10 }}>场次导航</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {scenes.map((sc: any) => (
                  <button
                    key={sc.id}
                    onClick={() => { setSelectedSceneId(sc.id); document.getElementById(`scene-${sc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    style={{
                      textAlign: 'left', padding: '6px 10px', fontSize: 11,
                      borderRadius: 6, cursor: 'pointer',
                      background: selectedSceneId === sc.id ? 'rgba(230,126,34,0.15)' : 'transparent',
                      border: `1px solid ${selectedSceneId === sc.id ? '#e67e22' : 'transparent'}`,
                      color: selectedSceneId === sc.id ? '#e67e22' : '#aaa',
                    }}
                  >
                    #{sc.sceneNumber} {sc.location?.slice(0, 10)}
                    {sc.location?.length > 10 ? '...' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {scenes.length === 0 ? (
              <div style={panelStyle}><div style={{ textAlign: 'center', color: '#555', padding: 24 }}>暂无场次信息</div></div>
            ) : scenes.map((sc: any, idx: number) => {
              const scAnnotations = annotations.filter((a: any) => a.sceneId === sc.id);
              return (
                <div
                  key={sc.id}
                  id={`scene-${sc.id}`}
                  style={{
                    ...panelStyle,
                    scrollMarginTop: 80,
                    borderLeft: `3px solid ${highlightSceneId === sc.id ? '#f39c12' : '#e67e22'}`,
                    ...(highlightSceneId === sc.id ? { boxShadow: '0 0 12px rgba(243,156,18,0.3)' } : {}),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#e67e22' }}>第{sc.sceneNumber}场</span>
                        <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>{sc.location || '未命名场景'}</h3>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        <span style={miniTagStyle(LOC_TYPE_LABELS[sc.locationType || 'unknown'], '#e67e22')}>
                          📍 {LOC_TYPE_LABELS[sc.locationType || 'unknown']}
                        </span>
                        <span style={miniTagStyle(TOD_LABELS[sc.timeOfDay || 'unknown'], '#3498db')}>
                          🌅 {TOD_LABELS[sc.timeOfDay || 'unknown']}
                        </span>
                        {sc.dialogueCount > 0 && <span style={miniTagStyle(`${sc.dialogueCount} 段对话`, '#9b59b6')}>💬 {sc.dialogueCount} 段</span>}
                        <span style={miniTagStyle(`${(sc.wordCount || 0).toLocaleString()} 字`, '#2ecc71')}>✍️ {(sc.wordCount || 0).toLocaleString()}</span>
                        {sc.estimatedDuration > 0 && <span style={miniTagStyle(`约${sc.estimatedDuration}分钟`, '#1abc9c')}>⏱️ 约{sc.estimatedDuration}分</span>}
                        {scAnnotations.length > 0 && <span style={miniTagStyle(`${scAnnotations.length} 批注`, '#e74c3c')}>📝 {scAnnotations.length}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isDirector && (
                        <button onClick={() => alert('场次编辑开发中')} style={{ ...iconBtnStyle, width: 'auto', padding: '4px 10px', fontSize: 12 }}>✏️ 编辑</button>
                      )}
                      <button
                        onClick={() => openAnnotationForm({ sceneId: sc.id, sceneNumber: sc.sceneNumber })}
                        style={{ ...iconBtnStyle, width: 'auto', padding: '4px 10px', fontSize: 12, borderColor: '#e74c3c', color: '#e74c3c' }}
                      >📝 + 批注</button>
                    </div>
                  </div>

                  {sc.characterNames && sc.characterNames.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>登场角色:</span>
                      {sc.characterNames.map((c: string) => (
                        <span key={c} style={{
                          fontSize: 11, padding: '1px 8px', marginRight: 4,
                          background: 'rgba(230,126,34,0.1)',
                          border: '1px solid rgba(230,126,34,0.3)',
                          color: '#e67e22', borderRadius: 8,
                        }}>🎭 {c}</span>
                      ))}
                    </div>
                  )}
                  {sc.summary && <div style={{ color: '#888', fontSize: 12, marginBottom: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>📌 {sc.summary}</div>}
                  {sc.content && (
                    <div style={{
                      maxHeight: 350, overflow: 'auto',
                      background: '#0f0f0f', padding: 14, borderRadius: 6,
                      fontFamily: 'Menlo, Consolas, monospace', fontSize: 12,
                      lineHeight: 1.8, color: '#bbb', whiteSpace: 'pre-wrap',
                      border: '1px solid #2a2a2a',
                    }}>
                      {sc.content}
                    </div>
                  )}

                  {scAnnotations.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 8, fontWeight: 600 }}>📝 场次批注（{scAnnotations.length}）</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {scAnnotations.map((a: any) => (
                          <div key={a.id} style={{
                            padding: 10, background: 'rgba(231,76,60,0.06)',
                            borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)',
                          }}>
                            <div style={{ fontSize: 12, color: '#ddd', fontStyle: 'italic', marginBottom: 4 }}>
                              "{a.scriptContent.slice(0, 80)}{a.scriptContent.length > 80 ? '...' : ''}"
                            </div>
                            {a.note && <div style={{ fontSize: 12, color: '#aaa' }}>💭 {a.note}</div>}
                            {a.tag && <span style={{ fontSize: 10, padding: '1px 6px', background: '#3498db40', color: '#3498db', borderRadius: 8 }}>#{a.tag}</span>}
                            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{new Date(a.createdAt).toLocaleString('zh-CN')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, color: '#ccc', fontSize: 14 }}>📄 剧本原文</h4>
            <div style={{ fontSize: 12, color: '#888' }}>
              {script.characterCount?.toLocaleString()} 字符 · {script.wordCount?.toLocaleString()} 字
            </div>
          </div>
          <div style={{
            maxHeight: '70vh', overflow: 'auto',
            background: '#0f0f0f', padding: 20, borderRadius: 6,
            fontFamily: 'Menlo, Consolas, "Songti SC", "宋体", monospace',
            fontSize: 14, lineHeight: 2, color: '#bbb',
            whiteSpace: 'pre-wrap', border: '1px solid #2a2a2a',
          }}>
            {script.rawContent || script.parsedContent || '（无内容）'}
          </div>
        </div>
      )}

      {activeTab === 'annotations' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 240, flexShrink: 0, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, color: '#ccc', fontSize: 13 }}>批注分组</div>
                <span style={{ fontSize: 10, color: '#888' }}>{totalAnnotations} 条</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(groupedAnnotations)
                  .filter(([k]) => k !== '__all__' || true)
                  .sort(([ka, a], [kb, b]) => {
                    if (ka === '__all__') return -1;
                    if (kb === '__all__') return 1;
                    return 0;
                  })
                  .map(([key, g]: any) => (
                    <button
                      key={key}
                      onClick={() => {
                        const el = document.getElementById(`ann-group-${key}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      style={{
                        textAlign: 'left', padding: '6px 10px', fontSize: 11,
                        borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(155,89,182,0.08)',
                        border: '1px solid rgba(155,89,182,0.2)',
                        color: '#bbb',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                        <span style={{ color: '#9b59b6', fontWeight: 600, marginLeft: 6 }}>{g.items.length}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>📝 所有批注</h3>
              <button
                onClick={() => openAnnotationForm(null)}
                style={primaryBtnStyle}
              >+ 新建批注</button>
            </div>

            {totalAnnotations === 0 ? (
              <div style={panelStyle}>
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                  <div style={{ color: '#666' }}>暂无批注，点击上方按钮新建</div>
                </div>
              </div>
            ) : (
              Object.entries(groupedAnnotations)
                .filter(([k, g]) => k === '__all__' || g.items.length > 0)
                .map(([key, g]: any) => (
                  <div key={key} id={`ann-group-${key}`} style={{ marginBottom: 20, scrollMarginTop: 80 }}>
                    {key !== '__all__' && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        marginBottom: 10,
                        background: 'linear-gradient(90deg, rgba(155,89,182,0.15) 0%, transparent 100%)',
                        borderLeft: '3px solid #9b59b6',
                        borderRadius: '0 6px 6px 0',
                      }}>
                        <h4 style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>{g.label}</h4>
                        <span style={{ fontSize: 11, padding: '1px 8px', background: '#9b59b630', color: '#9b59b6', borderRadius: 10 }}>{g.items.length} 条</span>
                        {g.sceneId && (
                          <button onClick={() => scrollToScene(g.sceneId)} style={{ fontSize: 11, color: '#e67e22', background: 'none', border: 'none', cursor: 'pointer' }}>
                            跳转到场次 →
                          </button>
                        )}
                        {g.chapterId && !g.sceneId && (
                          <button onClick={() => scrollToChapter(g.chapterId)} style={{ fontSize: 11, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer' }}>
                            跳转到章节 →
                          </button>
                        )}
                      </div>
                    )}
                    {key === '__all__' ? null : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {g.items.map((a: any) => (
                          <div key={a.id} style={{
                            padding: 12, background: '#1a1a1a',
                            borderRadius: 8, border: '1px solid #333',
                            ...(a.tag ? { borderLeft: `3px solid #3498db` } : {}),
                          }}>
                            <div style={{ fontSize: 13, color: '#ddd', fontStyle: 'italic', marginBottom: 6 }}>
                              "{a.scriptContent.slice(0, 100)}{a.scriptContent.length > 100 ? '...' : ''}"
                            </div>
                            {a.note && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>💭 {a.note}</div>}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              {a.tag && <span style={{ fontSize: 10, padding: '1px 8px', background: '#3498db30', color: '#3498db', borderRadius: 10 }}>#{a.tag}</span>}
                              {a.sceneNumber && <span style={{ fontSize: 10, padding: '1px 8px', background: '#e67e2230', color: '#e67e22', borderRadius: 10 }}>🎬 第{a.sceneNumber}场</span>}
                              {a.materialIds && a.materialIds.length > 0 && (
                                <span style={{ fontSize: 10, padding: '1px 8px', background: '#1abc9c30', color: '#1abc9c', borderRadius: 10 }}>📁 {a.materialIds.length}个素材</span>
                              )}
                              <span style={{ fontSize: 10, color: '#555', marginLeft: 'auto' }}>{new Date(a.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'versions' && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>🕐 版本历史</h3>
            <span style={{ fontSize: 12, color: '#888' }}>当前版本: v{script.currentVersion}</span>
          </div>
          {versions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: 24 }}>暂无版本历史</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {versions.map((v, idx) => {
                const act = VERSION_ACTION_LABELS[v.action] || { label: v.action, color: '#666' };
                return (
                  <div key={v.id} style={{
                    padding: 14, background: '#111', borderRadius: 8,
                    border: `1px solid ${idx === 0 ? 'rgba(231,76,60,0.4)' : '#2a2a2a'}`,
                    ...(idx === 0 ? { background: 'rgba(231,76,60,0.05)' } : {}),
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 18, fontWeight: 700, color: idx === 0 ? '#e74c3c' : '#888',
                        }}>v{v.versionNumber}</span>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 8,
                          background: `${act.color}20`, color: act.color,
                          border: `1px solid ${act.color}40`,
                        }}>{act.label}</span>
                        {idx === 0 && <span style={{ fontSize: 10, padding: '2px 8px', background: '#e74c3c', color: '#fff', borderRadius: 8 }}>当前</span>}
                        <span style={{ fontSize: 11, color: '#888' }}>
                          👤 {v.actionByName || v.actionBy}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#666' }}>{new Date(v.createdAt).toLocaleString('zh-CN')}</span>
                        {isDirector && idx !== 0 && v.action !== 'delete' && (
                          restoreConfirm === v.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleRestore(v.id)} style={{
                                padding: '3px 8px', background: '#e74c3c',
                                border: 'none', borderRadius: 4,
                                color: '#fff', cursor: 'pointer', fontSize: 11,
                              }}>确认恢复</button>
                              <button onClick={() => setRestoreConfirm(null)} style={secondaryBtnStyle}>取消</button>
                            </div>
                          ) : (
                            <button onClick={() => setRestoreConfirm(v.id)} style={{
                              padding: '4px 10px', fontSize: 12,
                              background: 'rgba(243,156,18,0.1)',
                              border: '1px solid rgba(243,156,18,0.3)',
                              color: '#f39c12', borderRadius: 4, cursor: 'pointer',
                            }}>恢复到此版本</button>
                          )
                        )}
                      </div>
                    </div>
                    {v.changeNote && (
                      <div style={{
                        fontSize: 12, color: '#aaa', padding: '6px 10px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: 4, marginBottom: 6,
                        borderLeft: '2px solid #f39c12',
                      }}>
                        📝 {v.changeNote}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: '#666' }}>
                      {v.title && <span>标题: {v.title}</span>}
                      {v.metadata?.chapterCount != null && <span>{v.metadata.chapterCount} 章</span>}
                      {v.metadata?.sceneCount != null && <span>{v.metadata.sceneCount} 场</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'search' && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              placeholder="在此剧本内搜索：章节标题、场景、角色、对白、内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button onClick={doSearch} disabled={searching} style={primaryBtnStyle}>
              {searching ? '搜索中...' : '🔍 搜索'}
            </button>
          </div>
          {!searchQuery.trim() ? (
            <div style={{ textAlign: 'center', color: '#555', padding: 24 }}>输入关键词开始搜索</div>
          ) : searching ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>搜索中...</div>
          ) : searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: 24 }}>未找到匹配结果</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map((r, i) => (
                <div
                  key={`${r.type}-${r.id}-${i}`}
                  style={{
                    padding: 12, background: '#111', borderRadius: 6,
                    border: '1px solid #2a2a2a', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => {
                    if (r.type === 'chapter' && r.chapterId) scrollToChapter(r.chapterId);
                    else if (r.type === 'scene' && r.sceneId) scrollToScene(r.sceneId);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 8,
                      background: r.type === 'chapter' ? 'rgba(52,152,219,0.2)' : 'rgba(230,126,34,0.2)',
                      color: r.type === 'chapter' ? '#3498db' : '#e67e22',
                      border: `1px solid ${r.type === 'chapter' ? '#3498db' : '#e67e22'}`,
                    }}>
                      {r.type === 'chapter' ? '章节' : '场次'}
                    </span>
                    {r.chapterNumber && <span style={{ fontSize: 11, color: '#888' }}>第{r.chapterNumber}章</span>}
                    {r.sceneNumber && <span style={{ fontSize: 11, color: '#888' }}>第{r.sceneNumber}场</span>}
                    <span style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 600, flex: 1 }}>{r.title}</span>
                    <span style={{ fontSize: 11, color: '#f39c12' }}>相关度: {r.score}</span>
                  </div>
                  {r.description && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{r.description}</div>}
                  {r.highlights && r.highlights.slice(0, 3).map((h: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 11, color: '#aaa', background: '#0a0a0a', padding: '4px 8px', borderRadius: 4, marginTop: 2 }}>
                      <span style={{ color: '#666' }}>[{h.field}]</span> {h.text || `位置 ${h.start}-${h.end}`}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>
                    💡 点击跳转到对应{ r.type === 'chapter' ? '章节' : '场次'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showVersions && (
        <div style={modalOverlay} onClick={() => setShowVersions(false)}>
          <div style={{ ...modalContent, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#e0e0e0' }}>🕐 版本历史</h3>
              <button onClick={() => setShowVersions(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            {versions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', padding: 24 }}>暂无版本历史</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {versions.map((v, idx) => {
                  const act = VERSION_ACTION_LABELS[v.action] || { label: v.action, color: '#666' };
                  return (
                    <div key={v.id} style={{
                      padding: 10, background: '#111', borderRadius: 6, border: '1px solid #2a2a2a',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: idx === 0 ? '#e74c3c' : '#aaa' }}>v{v.versionNumber}</span>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 8,
                          background: `${act.color}20`, color: act.color,
                        }}>{act.label}</span>
                        <span style={{ fontSize: 11, color: '#666' }}>{v.actionByName || '系统'} · {new Date(v.createdAt).toLocaleString('zh-CN')}</span>
                        {v.changeNote && <span style={{ fontSize: 11, color: '#aaa', flex: 1 }}>📝 {v.changeNote}</span>}
                        {isDirector && idx !== 0 && v.action !== 'delete' && (
                          restoreConfirm === v.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleRestore(v.id)} style={{
                                padding: '2px 8px', background: '#e74c3c', border: 'none',
                                borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11,
                              }}>确认</button>
                              <button onClick={() => setRestoreConfirm(null)} style={{ ...secondaryBtnStyle, padding: '2px 8px', fontSize: 11 }}>取消</button>
                            </div>
                          ) : (
                            <button onClick={() => setRestoreConfirm(v.id)} style={{
                              padding: '3px 10px', background: 'none',
                              border: '1px solid #f39c12', color: '#f39c12',
                              borderRadius: 4, cursor: 'pointer', fontSize: 11,
                            }}>恢复</button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showAnnotationForm && (
        <div style={modalOverlay} onClick={() => { setShowAnnotationForm(false); setAnnotationScope(null); }}>
          <div style={{ ...modalContent, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#e0e0e0' }}>📝 新建批注</h3>
              <button onClick={() => { setShowAnnotationForm(false); setAnnotationScope(null); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            {annotationScope && (
              <div style={{
                fontSize: 12, padding: '6px 10px', marginBottom: 12, borderRadius: 6,
                background: 'rgba(155,89,182,0.1)', color: '#9b59b6',
                border: '1px solid rgba(155,89,182,0.3)',
              }}>
                📍 批注位置：
                {annotationScope.sceneNumber ? ` 第${annotationScope.sceneNumber}场` : annotationScope.chapterId ? ` 章节` : ' 全文'}
              </div>
            )}
            <form onSubmit={handleCreateAnnotation} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelStyle}>剧本原文 *</label>
                <textarea
                  required
                  value={annForm.scriptContent}
                  onChange={(e) => setAnnForm({ ...annForm, scriptContent: e.target.value })}
                  placeholder="摘录需要批注的原文片段"
                  style={{ ...inputStyle, minHeight: 90 }}
                />
              </div>
              <div>
                <label style={labelStyle}>批注笔记</label>
                <textarea
                  value={annForm.note}
                  onChange={(e) => setAnnForm({ ...annForm, note: e.target.value })}
                  placeholder="导演/演员的想法、舞台指示、表演提示等"
                  style={{ ...inputStyle, minHeight: 70 }}
                />
              </div>
              <div>
                <label style={labelStyle}>标签</label>
                <input
                  value={annForm.tag}
                  onChange={(e) => setAnnForm({ ...annForm, tag: e.target.value })}
                  placeholder="如: 舞台指示、情感、节奏、走位、道具、灯光"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => { setShowAnnotationForm(false); setAnnotationScope(null); }} style={secondaryBtnStyle}>取消</button>
                <button type="submit" style={primaryBtnStyle}>创建批注</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: highlight ? '#e74c3c' : '#ddd', fontWeight: highlight ? 700 : 500 }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#222', border: '1px solid #444',
  borderRadius: 6, color: '#e0e0e0', fontSize: 14, outline: 'none',
  width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#888', marginBottom: 4,
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px', background: '#e74c3c', border: 'none',
  borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14,
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px', background: '#333', border: '1px solid #555',
  borderRadius: 6, color: '#ccc', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap',
};
const iconBtnStyle: React.CSSProperties = {
  width: 36, height: 36, background: 'none', border: '1px solid #444',
  borderRadius: 6, color: '#888', cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const panelStyle: React.CSSProperties = {
  background: '#1a1a1a', borderRadius: 10, border: '1px solid #333', padding: 18,
};
function miniTagStyle(text: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11, padding: '2px 8px', marginRight: 4,
    background: `${color}15`, color,
    border: `1px solid ${color}40`, borderRadius: 8,
  } as any;
}
const modalOverlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
};
const modalContent: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #333', borderRadius: 12,
  padding: 24, width: '100%', maxHeight: '85vh', overflowY: 'auto',
};
