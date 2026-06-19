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
  updatedAt: string;
  highlights?: { field: string; start: number; end: number }[];
}

interface AnnotationVersion {
  id: number;
  annotationId: number;
  scriptContent: string;
  note: string;
  startOffset: number | null;
  endOffset: number | null;
  tag: string;
  sceneNumber: number | null;
  createdBy: number;
  action: string;
  actionBy: number;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  restore: '恢复',
};

const actionColors: Record<string, string> = {
  create: '#2ecc71',
  update: '#3498db',
  delete: '#e74c3c',
  restore: '#9b59b6',
};

export default function AnnotationsPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [sceneFilter, setSceneFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    scriptContent: '',
    note: '',
    tag: '',
    sceneNumber: '',
    startOffset: '',
    endOffset: '',
  });
  const [versions, setVersions] = useState<Record<number, AnnotationVersion[]>>({});
  const [showVersions, setShowVersions] = useState<number | null>(null);
  const { user, isDirector } = useAuth();

  const canModify = (annotation: Annotation) => {
    if (isDirector) return true;
    return user?.id === annotation.createdBy;
  };

  const load = async () => {
    const data = await api.annotations.list(sceneFilter || undefined);
    setAnnotations(data);
  };

  useEffect(() => {
    load();
  }, [sceneFilter]);

  const loadVersions = async (annotationId: number) => {
    if (versions[annotationId]) return;
    const data = await api.annotations.getVersions(annotationId);
    setVersions((prev) => ({ ...prev, [annotationId]: data }));
  };

  const toggleVersions = async (annotationId: number) => {
    if (showVersions === annotationId) {
      setShowVersions(null);
    } else {
      await loadVersions(annotationId);
      setShowVersions(annotationId);
    }
  };

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

  const handleEdit = (annotation: Annotation) => {
    setEditingId(annotation.id);
    setForm({
      scriptContent: annotation.scriptContent,
      note: annotation.note || '',
      tag: annotation.tag || '',
      sceneNumber: annotation.sceneNumber?.toString() || '',
      startOffset: annotation.startOffset?.toString() || '',
      endOffset: annotation.endOffset?.toString() || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await api.annotations.update(editingId, {
        scriptContent: form.scriptContent,
        note: form.note || undefined,
        tag: form.tag || undefined,
        sceneNumber: form.sceneNumber ? Number(form.sceneNumber) : undefined,
        startOffset: form.startOffset ? Number(form.startOffset) : undefined,
        endOffset: form.endOffset ? Number(form.endOffset) : undefined,
      });
      setEditingId(null);
      setForm({ scriptContent: '', note: '', tag: '', sceneNumber: '', startOffset: '', endOffset: '' });
      load();
    } catch (err: any) {
      alert(err.message || '更新失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ scriptContent: '', note: '', tag: '', sceneNumber: '', startOffset: '', endOffset: '' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条批注吗？删除后可从版本历史中恢复。')) return;
    try {
      await api.annotations.remove(id);
      load();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const handleRestore = async (annotationId: number, versionId: number) => {
    if (!confirm('确定要恢复到此版本吗？')) return;
    try {
      await api.annotations.restoreToVersion(annotationId, versionId);
      setShowVersions(null);
      setVersions((prev) => {
        const next = { ...prev };
        delete next[annotationId];
        return next;
      });
      load();
    } catch (err: any) {
      alert(err.message || '恢复失败');
    }
  };

  const highlightText = (text: string, highlights?: { field: string; start: number; end: number }[], fieldName?: string) => {
    if (!highlights || highlights.length === 0 || !fieldName) {
      return <span>{text}</span>;
    }

    const fieldHighlights = highlights.filter((h) => h.field === fieldName);
    if (fieldHighlights.length === 0) {
      return <span>{text}</span>;
    }

    fieldHighlights.sort((a, b) => a.start - b.start);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const h of fieldHighlights) {
      if (h.start > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, h.start)}</span>);
      }
      parts.push(
        <mark key={`hl-${h.start}`} style={{ background: '#f39c12', color: '#000', padding: '0 2px', borderRadius: 2 }}>
          {text.slice(h.start, h.end)}
        </mark>
      );
      lastIndex = h.end;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  const filteredAnnotations = annotations.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.scriptContent.toLowerCase().includes(q) ||
      (a.note && a.note.toLowerCase().includes(q)) ||
      (a.tag && a.tag.toLowerCase().includes(q))
    );
  });

  const displayedAnnotations = searchQuery
    ? filteredAnnotations.map((a) => {
        const lowerQ = searchQuery.toLowerCase();
        const highlights: { field: string; start: number; end: number }[] = [];

        const contentLower = a.scriptContent.toLowerCase();
        let idx = contentLower.indexOf(lowerQ);
        while (idx !== -1) {
          highlights.push({ field: 'scriptContent', start: idx, end: idx + searchQuery.length });
          idx = contentLower.indexOf(lowerQ, idx + 1);
        }

        if (a.note) {
          const noteLower = a.note.toLowerCase();
          let nidx = noteLower.indexOf(lowerQ);
          while (nidx !== -1) {
            highlights.push({ field: 'note', start: nidx, end: nidx + searchQuery.length });
            nidx = noteLower.indexOf(lowerQ, nidx + 1);
          }
        }

        return { ...a, highlights };
      })
    : annotations;

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
            placeholder="搜索批注..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
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
          <h4 style={{ margin: '0 0 8px 0', color: '#ccc' }}>新建批注</h4>
          <textarea
            placeholder="剧本原文"
            value={form.scriptContent}
            onChange={(e) => setForm({ ...form, scriptContent: e.target.value })}
            required
            style={{ ...inputStyle, minHeight: 80 }}
          />
          <textarea
            placeholder="批注笔记"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            style={{ ...inputStyle, minHeight: 60 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <input
              placeholder="标签"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="场次"
              type="number"
              value={form.sceneNumber}
              onChange={(e) => setForm({ ...form, sceneNumber: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="起始偏移"
              type="number"
              value={form.startOffset}
              onChange={(e) => setForm({ ...form, startOffset: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              placeholder="结束偏移"
              type="number"
              value={form.endOffset}
              onChange={(e) => setForm({ ...form, endOffset: e.target.value })}
              style={inputStyle}
            />
            <div />
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="submit" style={primaryBtnStyle}>
              创建
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayedAnnotations.map((a) => (
          <div key={a.id} style={cardStyle}>
            {editingId === a.id ? (
              <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, color: '#ccc' }}>编辑批注</h4>
                <textarea
                  placeholder="剧本原文"
                  value={form.scriptContent}
                  onChange={(e) => setForm({ ...form, scriptContent: e.target.value })}
                  required
                  style={{ ...inputStyle, minHeight: 80 }}
                />
                <textarea
                  placeholder="批注笔记"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  style={{ ...inputStyle, minHeight: 60 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input
                    placeholder="标签"
                    value={form.tag}
                    onChange={(e) => setForm({ ...form, tag: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    placeholder="场次"
                    type="number"
                    value={form.sceneNumber}
                    onChange={(e) => setForm({ ...form, sceneNumber: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    placeholder="起始偏移"
                    type="number"
                    value={form.startOffset}
                    onChange={(e) => setForm({ ...form, startOffset: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    placeholder="结束偏移"
                    type="number"
                    value={form.endOffset}
                    onChange={(e) => setForm({ ...form, endOffset: e.target.value })}
                    style={inputStyle}
                  />
                  <div />
                </div>
                <div style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={handleCancelEdit} style={secondaryBtnStyle}>
                    取消
                  </button>
                  <button type="submit" style={primaryBtnStyle}>
                    保存
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        color: '#e0e0e0',
                        lineHeight: 1.6,
                        marginBottom: 8,
                        fontStyle: 'italic',
                        borderLeft: '3px solid #444',
                        paddingLeft: 12,
                      }}
                    >
                      "{highlightText(a.scriptContent, a.highlights, 'scriptContent')}"
                    </div>
                    {a.note && (
                      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8, paddingLeft: 12 }}>
                        → {highlightText(a.note, a.highlights, 'note')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {a.tag && (
                        <span
                          style={{
                            background: tagColors[a.tag] || '#555',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                          }}
                        >
                          {a.tag}
                        </span>
                      )}
                      {a.sceneNumber && (
                        <span
                          style={{
                            background: '#2a2a2a',
                            color: '#888',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                          }}
                        >
                          第{a.sceneNumber}场
                        </span>
                      )}
                      {(a.startOffset !== null || a.endOffset !== null) && (
                        <span
                          style={{
                            background: '#1a3a4a',
                            color: '#4aa3c7',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                          }}
                        >
                          定位: {a.startOffset ?? '-'} - {a.endOffset ?? '-'}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: '#555' }}>
                        创建于 {new Date(a.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 12 }}>
                    <button
                      onClick={() => toggleVersions(a.id)}
                      style={{
                        ...iconBtnStyle,
                        color: showVersions === a.id ? '#f39c12' : '#888',
                        borderColor: showVersions === a.id ? '#f39c12' : '#444',
                      }}
                    >
                      历史
                    </button>
                    {canModify(a) && (
                      <>
                        <button onClick={() => handleEdit(a)} style={{ ...iconBtnStyle, color: '#3498db', borderColor: '#3498db' }}>
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          style={{ ...iconBtnStyle, color: '#e74c3c', borderColor: '#e74c3c' }}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {showVersions === a.id && versions[a.id] && (
                  <div style={versionsPanelStyle}>
                    <div style={{ fontWeight: 'bold', color: '#ccc', marginBottom: 8, fontSize: 13 }}>
                      版本历史 ({versions[a.id].length} 条记录)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                      {versions[a.id].map((v) => (
                        <div key={v.id} style={versionItemStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  background: actionColors[v.action] || '#666',
                                  color: '#fff',
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  fontSize: 10,
                                }}
                              >
                                {actionLabels[v.action] || v.action}
                              </span>
                              <span style={{ fontSize: 12, color: '#888' }}>
                                #{v.id} · {new Date(v.createdAt).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            {canModify(a) && v.action !== 'delete' && (
                              <button
                                onClick={() => handleRestore(a.id, v.id)}
                                style={{
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  background: 'none',
                                  border: '1px solid #9b59b6',
                                  color: '#9b59b6',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                }}
                              >
                                恢复此版本
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, fontStyle: 'italic' }}>
                            "{v.scriptContent?.slice(0, 80)}
                            {v.scriptContent && v.scriptContent.length > 80 ? '...' : ''}"
                          </div>
                          {v.note && (
                            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                              批注: {v.note.slice(0, 60)}
                              {v.note.length > 60 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {displayedAnnotations.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>
          {searchQuery ? '未找到匹配的批注' : '暂无批注'}
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

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#333',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#ccc',
  cursor: 'pointer',
  fontSize: 14,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #444',
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
  whiteSpace: 'nowrap',
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

const versionsPanelStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  background: '#111',
  borderRadius: 6,
  border: '1px solid #2a2a2a',
};

const versionItemStyle: React.CSSProperties = {
  padding: 8,
  background: '#1a1a1a',
  borderRadius: 4,
  border: '1px solid #2a2a2a',
};
