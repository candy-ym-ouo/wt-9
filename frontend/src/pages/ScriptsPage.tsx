import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: '#f39c12', bg: 'rgba(243, 156, 18, 0.15)' },
  published: { label: '已发布', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.15)' },
  archived: { label: '已归档', color: '#7f8c8d', bg: 'rgba(127, 140, 141, 0.15)' },
};

const FORMAT_LABELS: Record<string, string> = {
  plain_text: '纯文本',
  fountain: 'Fountain',
  final_draft: 'Final Draft',
  word: 'Word',
};

export default function ScriptsPage() {
  const navigate = useNavigate();
  const { isDirector } = useAuth();

  const [scripts, setScripts] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [authorFilter, setAuthorFilter] = useState<string>('__all__');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [allAuthors, setAllAuthors] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadAutoParse, setUploadAutoParse] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedFileName, setPastedFileName] = useState('');

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);

  const loadMeta = async () => {
    try {
      const [authors, tags] = await Promise.all([api.scripts.getAuthors(), api.scripts.getTags()]);
      setAllAuthors(authors);
      setAllTags(tags);
    } catch {}
  };

  const loadList = async () => {
    try {
      const data = await api.scripts.list({
        keyword: keyword.trim() || undefined,
        status: statusFilter !== '__all__' ? statusFilter : undefined,
        author: authorFilter !== '__all__' ? authorFilter : undefined,
        tags: tagFilter.length > 0 ? tagFilter.join(',') : undefined,
      });
      setScripts(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadList(); }, [keyword, statusFilter, authorFilter, tagFilter]);

  const doSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.scripts.search(searchQuery.trim());
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { if (searchMode) doSearch(); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchMode]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setUploadContent(content);
      setPastedFileName(file.name);
      if (!uploadTitle.trim()) {
        const nameNoExt = file.name.replace(/\.[^.]+$/, '');
        setUploadTitle(nameNoExt);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { alert('请填写剧本标题'); return; }
    if (!uploadContent.trim()) { alert('请提供剧本内容（选择文件或粘贴文本）'); return; }
    setUploading(true);
    try {
      await api.scripts.uploadScript({
        title: uploadTitle.trim(),
        author: uploadAuthor.trim() || undefined,
        description: uploadDesc.trim() || undefined,
        content: uploadContent,
        fileName: pastedFileName || undefined,
        fileSize: uploadContent.length,
        format: 'plain_text',
        autoParse: uploadAutoParse,
        tags: uploadTags.split(',').map(s => s.trim()).filter(Boolean),
      } as any);
      alert('上传成功！');
      resetUploadForm();
      setShowUpload(false);
      loadList();
      loadMeta();
    } catch (e: any) {
      alert('上传失败: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadAuthor('');
    setUploadDesc('');
    setUploadContent('');
    setUploadTags('');
    setUploadAutoParse(true);
    setPastedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpen = (id: number) => navigate(`/scripts/${id}`);

  const handlePublish = async (s: any) => {
    try {
      await api.scripts.publish(s.id);
      loadList();
    } catch (e: any) { alert(e.message || '操作失败'); }
  };

  const handleArchive = async (s: any) => {
    if (!confirm('确定归档此剧本吗？')) return;
    try {
      await api.scripts.archive(s.id);
      loadList();
    } catch (e: any) { alert(e.message || '操作失败'); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.scripts.remove(deleteConfirm.id);
      setDeleteConfirm(null);
      loadList();
      loadMeta();
    } catch (e: any) { alert(e.message || '删除失败'); }
  };

  const handleReparse = async (s: any) => {
    if (!confirm('重新解析将重建章节和场次结构，确定继续吗？')) return;
    try {
      await api.scripts.reparse(s.id);
      alert('解析成功！');
      loadList();
    } catch (e: any) { alert(e.message || '解析失败'); }
  };

  const toggleTagFilter = (t: string) => {
    setTagFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const formatWordCount = (n: number) => {
    if (!n) return 0;
    return n.toLocaleString();
  };

  const statusOptions = ['__all__', 'draft', 'published', 'archived'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, color: '#e0e0e0' }}>📚 剧本库</h2>
          <span style={{ fontSize: 12, color: '#888' }}>共 {scripts.length} 个剧本</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => { setSearchMode(!searchMode); setSearchResults([]); setSearchQuery(''); }}
            style={{
              ...secondaryBtnStyle,
              ...(searchMode ? { background: '#e74c3c', borderColor: '#e74c3c', color: '#fff' } : {}),
            }}
          >
            🔍 {searchMode ? '关闭搜索' : '全文搜索'}
          </button>
          {isDirector && (
            <button onClick={() => { setShowUpload(!showUpload); resetUploadForm(); }} style={primaryBtnStyle}>
              {showUpload ? '取消' : '📤 上传剧本'}
            </button>
          )}
        </div>
      </div>

      {searchMode && (
        <div style={{ background: '#1a1a1a', padding: 16, borderRadius: 8, border: '1px solid #333', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              placeholder="输入关键词搜索标题、作者、章节名、场景、角色名、对白..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button onClick={doSearch} disabled={searching} style={primaryBtnStyle}>
              {searching ? '搜索中...' : '搜索'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map((r, i) => (
                <div
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={() => { if (r.type === 'script' || r.scriptId) handleOpen(r.type === 'script' ? r.id : (r.scriptId as number)); }}
                  style={{
                    padding: 10,
                    background: '#222',
                    borderRadius: 6,
                    border: '1px solid #333',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: r.type === 'script' ? 'rgba(155,89,182,0.2)' : r.type === 'chapter' ? 'rgba(52,152,219,0.2)' : 'rgba(230,126,34,0.2)',
                      color: r.type === 'script' ? '#9b59b6' : r.type === 'chapter' ? '#3498db' : '#e67e22',
                      border: `1px solid ${r.type === 'script' ? '#9b59b6' : r.type === 'chapter' ? '#3498db' : '#e67e22'}`,
                    }}>
                      {r.type === 'script' ? '剧本' : r.type === 'chapter' ? '章节' : '场次'}
                    </span>
                    {r.chapterNumber && <span style={{ fontSize: 11, color: '#888' }}>第{r.chapterNumber}章</span>}
                    {r.sceneNumber && <span style={{ fontSize: 11, color: '#888' }}>第{r.sceneNumber}场</span>}
                    <span style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 600, flex: 1 }}>{r.title}</span>
                    <span style={{ fontSize: 11, color: '#f39c12' }}>分数: {r.score}</span>
                  </div>
                  {r.description && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{r.description}</div>}
                  {r.highlights?.slice(0, 2).map((h: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 12, color: '#aaa', background: '#1a1a1a', padding: '4px 8px', borderRadius: 4, marginTop: 2 }}>
                      <span style={{ color: '#666' }}>[{h.field}]</span> {h.text || `...匹配位置 ${h.start}-${h.end}`}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {searchQuery && !searching && searchResults.length === 0 && (
            <div style={{ color: '#555', textAlign: 'center', padding: 16 }}>未找到匹配结果</div>
          )}
        </div>
      )}

      {showUpload && isDirector && (
        <div style={{ background: '#1a1a1a', padding: 20, borderRadius: 8, border: '1px solid #333', marginBottom: 20 }}>
          <div style={{ fontSize: 15, color: '#e0e0e0', marginBottom: 12, fontWeight: 600 }}>上传新剧本</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>剧本标题 *</label>
              <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="如: 雷雨" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>作者</label>
              <input value={uploadAuthor} onChange={(e) => setUploadAuthor(e.target.value)} placeholder="如: 曹禺" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>标签（逗号分隔）</label>
              <input value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="如: 经典,悲剧,四幕剧" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>描述/简介</label>
            <textarea
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="剧本简介、背景等信息..."
              style={{ ...inputStyle, minHeight: 60 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>剧本内容 *</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="file" accept=".txt,.fountain,.md,.html" ref={fileInputRef} onChange={handleFileSelect} style={{ color: '#aaa', fontSize: 13 }} />
              {pastedFileName && <span style={{ fontSize: 12, color: '#2ecc71' }}>📄 已载入: {pastedFileName}</span>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                <input type="checkbox" checked={uploadAutoParse} onChange={(e) => setUploadAutoParse(e.target.checked)} />
                自动解析章节/场次/角色
              </label>
            </div>
            <textarea
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              placeholder="或直接粘贴剧本文本..."
              style={{ ...inputStyle, minHeight: 200, fontFamily: 'Menlo, Consolas, monospace', fontSize: 13 }}
            />
            {uploadContent && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                字符数: {uploadContent.length.toLocaleString()}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={resetUploadForm} style={secondaryBtnStyle}>清空</button>
            <button onClick={handleUpload} disabled={uploading} style={{ ...primaryBtnStyle, opacity: uploading ? 0.6 : 1 }}>
              {uploading ? '上传中...' : '上传并入库'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#1a1a1a', padding: 16, borderRadius: 8, border: '1px solid #333', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle}>关键词</label>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索标题/作者/内容" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>状态</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
              {statusOptions.map(s => (
                <option key={s} value={s}>{s === '__all__' ? '全部状态' : STATUS_LABELS[s]?.label || s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>作者</label>
            <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} style={inputStyle}>
              <option value="__all__">全部作者</option>
              {allAuthors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        {allTags.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>标签筛选</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allTags.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTagFilter(t)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: `1px solid ${tagFilter.includes(t) ? '#9b59b6' : '#444'}`,
                    background: tagFilter.includes(t) ? '#9b59b6' : '#222',
                    color: tagFilter.includes(t) ? '#fff' : '#aaa',
                  }}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {scripts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#555', padding: 48, background: '#1a1a1a', borderRadius: 8, border: '1px dashed #333' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
          {isDirector ? (
            <div>
              <div style={{ marginBottom: 8 }}>剧本库为空，点击上方"上传剧本"开始</div>
            </div>
          ) : (
            <div>暂无剧本，联系导演上传</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {scripts.map((s) => {
            const st = STATUS_LABELS[s.status] || STATUS_LABELS.draft;
            return (
              <div key={s.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleOpen(s.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>{s.title}</h3>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 8,
                        background: st.bg,
                        color: st.color,
                        border: `1px solid ${st.color}40`,
                      }}>
                        {st.label}
                      </span>
                    </div>
                    {s.originalTitle && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>原名: {s.originalTitle}</div>}
                    {s.author && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>✍️ {s.author}{s.translator ? ` · 译: ${s.translator}` : ''}</div>}
                  </div>
                </div>

                {s.description && <div style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                  <div style={statBoxStyle}>
                    <div style={statNumStyle}>{s.chapterCount || 0}</div>
                    <div style={statLabelStyle}>章节</div>
                  </div>
                  <div style={statBoxStyle}>
                    <div style={statNumStyle}>{s.sceneCount || 0}</div>
                    <div style={statLabelStyle}>场次</div>
                  </div>
                  <div style={statBoxStyle}>
                    <div style={statNumStyle}>{formatWordCount(s.wordCount)}</div>
                    <div style={statLabelStyle}>字数</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {s.format && <span style={{ ...miniTagStyle, background: 'rgba(52,152,219,0.15)', color: '#3498db', borderColor: 'rgba(52,152,219,0.3)' }}>{FORMAT_LABELS[s.format] || s.format}</span>}
                  {s.characterNames?.slice(0, 4).map((c: string) => (
                    <span key={c} style={{ ...miniTagStyle, background: 'rgba(230,126,34,0.1)', color: '#e67e22', borderColor: 'rgba(230,126,34,0.3)' }}>🎭 {c}</span>
                  ))}
                  {s.characterNames?.length > 4 && <span style={miniTagStyle}>+{s.characterNames.length - 4}</span>}
                  {s.tags?.slice(0, 3).map((t: string) => (
                    <span key={t} style={{ ...miniTagStyle, background: 'rgba(155,89,182,0.12)', color: '#9b59b6', borderColor: 'rgba(155,89,182,0.3)' }}>#{t}</span>
                  ))}
                </div>

                {s.currentVersion && (
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>
                    📌 当前版本 v{s.currentVersion} · 更新于 {new Date(s.updatedAt).toLocaleString('zh-CN')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => handleOpen(s.id)} style={{ ...secondaryBtnStyle, flex: 1, minWidth: 80 }}>查看详情</button>
                  {isDirector && (
                    <>
                      <button onClick={() => handleReparse(s)} title="重新解析" style={iconBtnStyle}>🔄</button>
                      {s.status === 'draft' && <button onClick={() => handlePublish(s)} title="发布" style={{ ...iconBtnStyle, borderColor: '#2ecc71', color: '#2ecc71' }}>📤</button>}
                      {s.status !== 'archived' && <button onClick={() => handleArchive(s)} title="归档" style={iconBtnStyle}>📦</button>}
                      <button onClick={() => setDeleteConfirm({ id: s.id, title: s.title })} title="删除" style={{ ...iconBtnStyle, borderColor: '#e74c3c', color: '#e74c3c' }}>🗑️</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteConfirm && (
        <div style={modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', color: '#e0e0e0' }}>⚠️ 确认删除</h3>
            <div style={{ color: '#aaa', fontSize: 14, marginBottom: 16 }}>
              确定要永久删除剧本 <strong style={{ color: '#e0e0e0' }}>「{deleteConfirm.title}」</strong> 吗？<br/>
              相关章节、场次、批注和版本历史将全部删除，且无法恢复。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={secondaryBtnStyle}>取消</button>
              <button onClick={handleDelete} style={{ ...primaryBtnStyle, background: '#e74c3c' }}>确认删除</button>
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
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#888',
  marginBottom: 4,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#e74c3c',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  whiteSpace: 'nowrap',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#333',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#ccc',
  cursor: 'pointer',
  fontSize: 14,
  whiteSpace: 'nowrap',
};

const iconBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: 'none',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#888',
  cursor: 'pointer',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 10,
  border: '1px solid #333',
  padding: 16,
  transition: 'all 0.2s',
};

const statBoxStyle: React.CSSProperties = {
  background: '#222',
  borderRadius: 6,
  padding: '6px 4px',
  textAlign: 'center',
};

const statNumStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#e74c3c',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#888',
  marginTop: 2,
};

const miniTagStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 7px',
  borderRadius: 8,
  border: '1px solid #444',
  background: '#2a2a2a',
  color: '#aaa',
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
};

const modalContent: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 12,
  padding: 24,
  width: '90%',
  maxWidth: 480,
};
