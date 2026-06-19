import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface SearchResult {
  rehearsals: any[];
  roles: any[];
  annotations: any[];
  materials: any[];
  total: number;
  flatResults?: any[];
}

const MODULE_OPTIONS = [
  { key: 'rehearsals', label: '排练', icon: '📅', color: '#e67e22' },
  { key: 'roles', label: '角色', icon: '🎭', color: '#9b59b6' },
  { key: 'annotations', label: '批注', icon: '📝', color: '#2ecc71' },
  { key: 'materials', label: '素材', icon: '📁', color: '#3498db' },
];

const SORT_OPTIONS = [
  { key: 'relevance', label: '相关度' },
  { key: 'date', label: '日期' },
  { key: 'name', label: '名称' },
];

const DATE_FIELD_OPTIONS = [
  { key: 'createdAt', label: '创建时间' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'startTime', label: '开始时间' },
];

function highlightSearchResult(
  text: string,
  highlights?: { field: string; start: number; end: number }[],
  fieldName?: string
) {
  if (!highlights || highlights.length === 0 || !fieldName) {
    return <span>"{text}"</span>;
  }

  const fieldHighlights = highlights.filter((h) => h.field === fieldName);
  if (fieldHighlights.length === 0) {
    return <span>"{text}"</span>;
  }

  const sorted = [...fieldHighlights].sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const h of sorted) {
    if (h.start > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, h.start)}</span>);
    }
    parts.push(
      <mark
        key={`h-${h.start}`}
        style={{
          background: '#f39c12',
          color: '#000',
          padding: '0 2px',
          borderRadius: 2,
        }}
      >
        {text.slice(h.start, h.end)}
      </mark>
    );
    lastIndex = h.end;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  const [selectedModules, setSelectedModules] = useState<string[]>(['rehearsals', 'roles', 'annotations', 'materials']);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateField, setDateField] = useState('createdAt');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState('desc');
  const [groupByModule, setGroupByModule] = useState(true);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  useEffect(() => {
    api.search.getTags().then(setAllTags).catch(() => {});
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      selectedModules.length < 4 ||
      dateFrom ||
      dateTo ||
      selectedTags.length > 0 ||
      sortBy !== 'relevance' ||
      sortOrder !== 'desc'
    );
  }, [selectedModules, dateFrom, dateTo, selectedTags, sortBy, sortOrder]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    doSearch();
  };

  const doSearch = async () => {
    if (!query.trim() && !hasActiveFilters) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.search.advanced({
        q: query.trim() || undefined,
        modules: selectedModules.length === 4 ? undefined : selectedModules,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        dateField,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sortBy,
        sortOrder,
        groupByModule,
      });
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (results || query.trim() || hasActiveFilters) {
      doSearch();
    }
  }, [sortBy, sortOrder, groupByModule]);

  const toggleModule = (key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedModules(['rehearsals', 'roles', 'annotations', 'materials']);
    setDateFrom('');
    setDateTo('');
    setDateField('createdAt');
    setSelectedTags([]);
    setSortBy('relevance');
    setSortOrder('desc');
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleString('zh-CN');

  const getModuleInfo = (type: string) => {
    return MODULE_OPTIONS.find((m) => m.key === type + 's') || MODULE_OPTIONS.find((m) => m.key === type);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', color: '#e0e0e0' }}>全站检索</h2>

      <form onSubmit={handleSearch} style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
      }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索排练、角色、批注、素材..."
          style={{
            flex: 1,
            padding: '12px 16px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 16,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '12px 16px',
            background: showFilters ? '#e74c3c' : '#2a2a2a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⚙️ 筛选
          {hasActiveFilters && (
            <span style={{
              background: '#e74c3c',
              color: '#fff',
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 10,
              minWidth: 18,
              textAlign: 'center',
            }}>
              !
            </span>
          )}
        </button>
        <button type="submit" disabled={loading} style={{
          padding: '12px 24px',
          background: '#e74c3c',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
        }}>
          {loading ? '搜索中...' : '🔍 搜索'}
        </button>
      </form>

      {showFilters && (
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 15 }}>高级筛选</h3>
            <button
              onClick={clearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              重置筛选
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={filterLabelStyle}>模块类型</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MODULE_OPTIONS.map((mod) => (
                  <label
                    key={mod.key}
                    style={{
                      ...moduleTagStyle,
                      background: selectedModules.includes(mod.key)
                        ? mod.color + '20'
                        : '#2a2a2a',
                      borderColor: selectedModules.includes(mod.key)
                        ? mod.color
                        : '#333',
                      color: selectedModules.includes(mod.key)
                        ? mod.color
                        : '#888',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod.key)}
                      onChange={() => toggleModule(mod.key)}
                      style={{ display: 'none' }}
                    />
                    <span>{mod.icon} {mod.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>排序方式</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={selectStyle}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={selectStyle}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>时间范围</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                  style={{ ...selectStyle, flex: 1 }}
                >
                  {DATE_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={dateInputStyle}
                />
                <span style={{ color: '#666' }}>至</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={dateInputStyle}
                />
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>结果展示方式</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setGroupByModule(true);
                    setViewMode('grouped');
                  }}
                  style={{
                    ...viewModeBtnStyle,
                    background: viewMode === 'grouped' ? '#e74c3c' : '#2a2a2a',
                    borderColor: viewMode === 'grouped' ? '#e74c3c' : '#333',
                  }}
                >
                  按模块分组
                </button>
                <button
                  onClick={() => {
                    setGroupByModule(false);
                    setViewMode('list');
                  }}
                  style={{
                    ...viewModeBtnStyle,
                    background: viewMode === 'list' ? '#e74c3c' : '#2a2a2a',
                    borderColor: viewMode === 'list' ? '#e74c3c' : '#333',
                  }}
                >
                  列表视图
                </button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={filterLabelStyle}>标签筛选</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allTags.map((tag) => (
                    <label
                      key={tag}
                      style={{
                        ...tagStyle,
                        background: selectedTags.includes(tag)
                          ? '#e74c3c30'
                          : '#2a2a2a',
                        borderColor: selectedTags.includes(tag)
                          ? '#e74c3c'
                          : '#333',
                        color: selectedTags.includes(tag)
                          ? '#e74c3c'
                          : '#aaa',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                        style={{ display: 'none' }}
                      />
                      🏷️ {tag}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid #333',
          }}>
            <button
              onClick={() => setShowFilters(false)}
              style={{
                padding: '8px 20px',
                background: '#2a2a2a',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#aaa',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              取消
            </button>
            <button
              onClick={() => {
                doSearch();
                setShowFilters(false);
              }}
              style={{
                padding: '8px 20px',
                background: '#e74c3c',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              应用筛选
            </button>
          </div>
        </div>
      )}

      {results && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, color: '#888' }}>
              共找到 <strong style={{ color: '#e74c3c' }}>{results.total}</strong> 条结果
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setGroupByModule(true);
                  setViewMode('grouped');
                }}
                style={{
                  ...smallBtnStyle,
                  background: viewMode === 'grouped' ? '#e74c3c' : '#2a2a2a',
                }}
              >
                分组
              </button>
              <button
                onClick={() => {
                  setGroupByModule(false);
                  setViewMode('list');
                }}
                style={{
                  ...smallBtnStyle,
                  background: viewMode === 'list' ? '#e74c3c' : '#2a2a2a',
                }}
              >
                列表
              </button>
            </div>
          </div>

          {viewMode === 'grouped' ? (
            <>
              {results.rehearsals.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <h3 style={{ color: '#e67e22', fontSize: 15, marginBottom: 12 }}>📅 排练 ({results.rehearsals.length})</h3>
                  {results.rehearsals.map((r: any) => (
                    <div key={r.id} style={{ ...cardStyle, borderLeft: r.hasConflict ? '4px solid #e74c3c' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ color: '#e0e0e0' }}>{r.title}</strong>
                        {r.hasConflict && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(231, 76, 60, 0.2)',
                            border: '1px solid #e74c3c',
                            color: '#e74c3c',
                            borderRadius: 10,
                            fontSize: 11,
                          }}>
                            ⚠️ 冲突
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {formatDate(r.startTime)}
                        {r.location && ` · 📍 ${r.location}`}
                      </div>
                      {r.description && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{r.description}</div>}
                      {r.participants && r.participants.length > 0 && (
                        <div style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: '#3498db',
                        }}>
                          ✅ 签到: 出勤{r.presentCount || 0} | 缺席{r.absentCount || 0} | 迟到{r.lateCount || 0} | 未签{r.pendingAttendanceCount || 0}
                        </div>
                      )}
                      {r.hasConflict && (
                        <div style={{
                          marginTop: 8,
                          padding: '8px 10px',
                          background: 'rgba(231, 76, 60, 0.08)',
                          borderRadius: 4,
                          fontSize: 12,
                          color: '#e74c3c',
                        }}>
                          {r.timeConflicts && r.timeConflicts.length > 0 && (
                            <div>📅 时间冲突：{r.timeConflicts.map((x: any) => x.title).join('、')}</div>
                          )}
                          {r.participantConflicts && r.participantConflicts.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              👥 参与人占用：{r.participantConflicts.map((p: any) => `${p.userName || '用户#' + p.userId}在${p.conflictingRehearsals.map((x: any) => x.title).join('、')}有安排`).join('；')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {results.roles.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <h3 style={{ color: '#9b59b6', fontSize: 15, marginBottom: 12 }}>🎭 角色 ({results.roles.length})</h3>
                  {results.roles.map((r: any) => {
                    const statusInfo = (() => {
                      if (!r.actorId) return { text: '未分配演员', color: '#888', bg: 'rgba(136,136,136,0.1)' };
                      if (r.actorOnLeave) {
                        if (r.currentSubstitute) return { text: '请假中（有替补）', color: '#e67e22', bg: 'rgba(230,126,34,0.1)' };
                        return { text: '请假中（无替补）', color: '#e74c3c', bg: 'rgba(231,76,60,0.1)' };
                      }
                      return { text: '正常', color: '#2ecc71', bg: 'rgba(46,204,113,0.1)' };
                    })();
                    return (
                      <div key={r.id} style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <strong style={{ color: '#e0e0e0' }}>{r.characterName}</strong>
                          <span style={{
                            padding: '2px 8px',
                            background: statusInfo.bg,
                            border: `1px solid ${statusInfo.color}`,
                            color: statusInfo.color,
                            borderRadius: 10,
                            fontSize: 11,
                          }}>
                            {statusInfo.text}
                          </span>
                        </div>
                        {r.characterDescription && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{r.characterDescription}</div>}
                        {r.actorName && (
                          <div style={{ fontSize: 13, color: '#aaa', marginTop: 6 }}>
                            扮演者: <strong style={{ color: '#e0e0e0' }}>{r.actorName}</strong>
                          </div>
                        )}
                        {r.substituteActors && r.substituteActors.length > 0 && (
                          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                            替补: {r.substituteActors.map((s: any) => (
                              <span key={s.id} style={{
                                padding: '2px 6px',
                                background: s.isOnLeave ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
                                border: `1px solid ${s.isOnLeave ? '#e74c3c' : '#2ecc71'}`,
                                color: s.isOnLeave ? '#e74c3c' : '#2ecc71',
                                borderRadius: 8,
                                fontSize: 11,
                                marginRight: 4,
                              }}>
                                {s.displayName || s.username}{s.isOnLeave ? '(请假)' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.activeLeave && (
                          <div style={{
                            marginTop: 8,
                            padding: '6px 10px',
                            background: 'rgba(230,126,34,0.08)',
                            border: '1px solid rgba(230,126,34,0.3)',
                            borderRadius: 6,
                            fontSize: 12,
                            color: '#e67e22',
                          }}>
                            请假中 · {r.activeLeave.type === 'sick' ? '病假' : r.activeLeave.type === 'personal' ? '事假' : '其他'}
                            {r.activeLeave.reason && ` · ${r.activeLeave.reason}`}
                            {r.currentSubstitute && ` → 替补: ${r.currentSubstitute.displayName || r.currentSubstitute.username}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {results.annotations.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <h3 style={{ color: '#2ecc71', fontSize: 15, marginBottom: 12 }}>📝 批注 ({results.annotations.length})</h3>
                  {results.annotations.map((a: any) => (
                    <div
                      key={a.id}
                      style={{
                        ...cardStyle,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid #333',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#2ecc71';
                        (e.currentTarget as HTMLDivElement).style.background = '#1e2a1e';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
                        (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a';
                      }}
                      onClick={() => {
                        const params: Record<string, string> = { annotationId: String(a.id) };
                        if (a.sceneNumber) params.scene = String(a.sceneNumber);
                        if (query) params.q = query;
                        navigate({ pathname: '/annotations', search: new URLSearchParams(params).toString() });
                      }}
                      title="点击跳转到批注页面查看详情"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontStyle: 'italic', color: '#e0e0e0', fontSize: 14 }}>
                            {highlightSearchResult(a.scriptContent, a.highlights, 'scriptContent')}
                          </div>
                          {a.note && (
                            <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
                              → {highlightSearchResult(a.note, a.highlights, 'note')}
                            </div>
                          )}
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {a.tag && (
                              <span
                                style={{
                                  background: '#333',
                                  color: '#aaa',
                                  padding: '2px 6px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  display: 'inline-block',
                                }}
                              >
                                🏷️ {a.tag}
                              </span>
                            )}
                            {a.sceneNumber && (
                              <span
                                style={{
                                  background: 'rgba(52,152,219,0.15)',
                                  color: '#3498db',
                                  padding: '2px 6px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  display: 'inline-block',
                                  border: '1px solid rgba(52,152,219,0.3)',
                                }}
                              >
                                🎬 第{a.sceneNumber}场
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const params: Record<string, string> = { annotationId: String(a.id) };
                            if (a.sceneNumber) params.scene = String(a.sceneNumber);
                            if (query) params.q = query;
                            navigate({ pathname: '/annotations', search: new URLSearchParams(params).toString() });
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(46,204,113,0.1)',
                            border: '1px solid #2ecc71',
                            borderRadius: 4,
                            color: '#2ecc71',
                            fontSize: 11,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          跳转 →
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {results.materials.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <h3 style={{ color: '#3498db', fontSize: 15, marginBottom: 12 }}>📁 素材 ({results.materials.length})</h3>
                  {results.materials.map((m: any) => (
                    <div key={m.id} style={cardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#e0e0e0' }}>{m.originalName}</strong>
                        {m.referenceCount && m.referenceCount.total > 0 && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(243, 156, 18, 0.15)',
                            border: '1px solid #f39c12',
                            color: '#f39c12',
                            borderRadius: 10,
                            fontSize: 11,
                          }}>
                            🔗 {m.referenceCount.total} 次引用
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {m.category} · {(m.size / 1024).toFixed(1)} KB
                      </div>
                      {m.description && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{m.description}</div>}
                      {m.tags && m.tags.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {m.tags.map((t: string, i: number) => (
                            <span
                              key={i}
                              style={{
                                background: '#2a2a2a',
                                color: '#888',
                                padding: '2px 6px',
                                borderRadius: 6,
                                fontSize: 11,
                              }}
                            >
                              🏷️ {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.referenceCount && m.referenceCount.total > 0 && (
                        <div style={{ fontSize: 11, color: '#f39c12', marginTop: 6 }}>
                          📅 {m.referenceCount.rehearsals} 个排练 · 📝 {m.referenceCount.annotations} 个批注
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : (
            results.flatResults && results.flatResults.length > 0 ? (
              <div>
                {results.flatResults.map((item: any, index: number) => {
                  const moduleInfo = getModuleInfo(item.type);
                  const isAnnotation = item.type === 'annotation';
                  const handleJump = () => {
                    if (isAnnotation) {
                      const params: Record<string, string> = { annotationId: String(item.id) };
                      if (item.raw?.sceneNumber) params.scene = String(item.raw.sceneNumber);
                      if (query) params.q = query;
                      navigate({ pathname: '/annotations', search: new URLSearchParams(params).toString() });
                    }
                  };
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      style={{
                        ...cardStyle,
                        borderLeft: `4px solid ${moduleInfo?.color || '#666'}`,
                        cursor: isAnnotation ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                      onClick={isAnnotation ? handleJump : undefined}
                      onMouseEnter={isAnnotation ? (e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '#1e2a1e';
                      } : undefined}
                      onMouseLeave={isAnnotation ? (e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a';
                      } : undefined}
                      title={isAnnotation ? '点击跳转到批注页面查看详情' : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{moduleInfo?.icon || '📄'}</span>
                        <strong style={{ color: '#e0e0e0' }}>{item.title}</strong>
                        <span style={{
                          padding: '2px 8px',
                          background: moduleInfo?.color + '20',
                          border: `1px solid ${moduleInfo?.color}`,
                          color: moduleInfo?.color,
                          borderRadius: 10,
                          fontSize: 11,
                          marginLeft: 'auto',
                        }}>
                          {moduleInfo?.label || item.type}
                        </span>
                        {isAnnotation && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleJump(); }}
                            style={{
                              padding: '3px 10px',
                              background: 'rgba(46,204,113,0.1)',
                              border: '1px solid #2ecc71',
                              borderRadius: 4,
                              color: '#2ecc71',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            跳转 →
                          </button>
                        )}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                          {item.description && item.description.length > 150
                            ? item.description.substring(0, 150) + '...'
                            : item.description}
                        </div>
                      )}
                      {isAnnotation && item.raw?.sceneNumber && (
                        <div style={{ marginTop: 6 }}>
                          <span
                            style={{
                              background: 'rgba(52,152,219,0.15)',
                              color: '#3498db',
                              padding: '2px 6px',
                              borderRadius: 8,
                              fontSize: 11,
                              display: 'inline-block',
                              border: '1px solid rgba(52,152,219,0.3)',
                            }}
                          >
                            🎬 第{item.raw.sceneNumber}场
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: '#666' }}>
                        <span>📅 {formatDate(item.date)}</span>
                        {item.tags && item.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {item.tags.map((t: string, i: number) => (
                              <span
                                key={i}
                                style={{
                                  background: '#2a2a2a',
                                  color: '#888',
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                }}
                              >
                                🏷️ {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null
          )}

          {results.total === 0 && (
            <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>未找到相关结果</div>
          )}
        </div>
      )}
    </div>
  );
}

const filterLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#aaa',
  marginBottom: 8,
  fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#2a2a2a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
};

const dateInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  background: '#2a2a2a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 13,
  outline: 'none',
};

const moduleTagStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'all 0.2s',
};

const tagStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid',
  borderRadius: 12,
  fontSize: 12,
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'all 0.2s',
};

const viewModeBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  border: '1px solid',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  color: '#aaa',
  transition: 'all 0.2s',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  color: '#fff',
  transition: 'all 0.2s',
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 12,
  marginBottom: 8,
};
