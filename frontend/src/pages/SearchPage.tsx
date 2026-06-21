import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useResponsive } from '../hooks/useResponsive';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { colors, spacing, fontSize, radius } from '../styles/theme';

interface TagInfo {
  name: string;
  color: string | null;
}

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
  const { isMobile, isTablet } = useResponsive();
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [allTags, setAllTags] = useState<TagInfo[]>([]);

  const SEARCH_FILTER_KEY = 'search_filter_state';

  const getTagColor = (tagName: string): string => {
    const found = allTags.find((t) => t.name === tagName);
    if (found?.color) return found.color;
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#3498db', '#e74c3c', '#e67e22', '#2ecc71', '#9b59b6', '#f1c40f', '#1abc9c', '#e91e63'];
    return colors[Math.abs(hash) % colors.length];
  };

  const urlModules = searchParams.get('modules');
  const urlQ = searchParams.get('q') || '';
  const urlDateFrom = searchParams.get('dateFrom') || '';
  const urlDateTo = searchParams.get('dateTo') || '';
  const urlDateField = searchParams.get('dateField') || 'createdAt';
  const urlTags = searchParams.get('tags');
  const urlSortBy = searchParams.get('sortBy') || 'relevance';
  const urlSortOrder = searchParams.get('sortOrder') || 'desc';
  const urlGroupBy = searchParams.get('groupBy');
  const urlViewMode = searchParams.get('viewMode') || 'grouped';

  const [query, setQuery] = useState(urlQ);
  const [selectedModules, setSelectedModules] = useState<string[]>(
    urlModules ? urlModules.split(',') : ['rehearsals', 'roles', 'annotations', 'materials']
  );
  const [dateFrom, setDateFrom] = useState(urlDateFrom);
  const [dateTo, setDateTo] = useState(urlDateTo);
  const [dateField, setDateField] = useState(urlDateField);
  const [selectedTags, setSelectedTags] = useState<string[]>(urlTags ? urlTags.split(',') : []);
  const [sortBy, setSortBy] = useState(urlSortBy);
  const [sortOrder, setSortOrder] = useState(urlSortOrder);
  const [groupByModule, setGroupByModule] = useState(urlGroupBy !== 'false');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>(urlViewMode as 'grouped' | 'list');

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

  const syncUrlParams = () => {
    const params: Record<string, string> = {};
    if (query.trim()) params.q = query.trim();
    if (selectedModules.length < 4) params.modules = selectedModules.join(',');
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (dateField !== 'createdAt') params.dateField = dateField;
    if (selectedTags.length > 0) params.tags = selectedTags.join(',');
    if (sortBy !== 'relevance') params.sortBy = sortBy;
    if (sortOrder !== 'desc') params.sortOrder = sortOrder;
    if (!groupByModule) params.groupBy = 'false';
    if (viewMode !== 'grouped') params.viewMode = viewMode;
    setSearchParams(params, { replace: false });
    try {
      localStorage.setItem(SEARCH_FILTER_KEY, JSON.stringify({
        selectedModules: selectedModules.length < 4 ? selectedModules : null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        dateField: dateField !== 'createdAt' ? dateField : null,
        selectedTags: selectedTags.length > 0 ? selectedTags : null,
        sortBy: sortBy !== 'relevance' ? sortBy : null,
        sortOrder: sortOrder !== 'desc' ? sortOrder : null,
        groupByModule: !groupByModule ? false : null,
        viewMode: viewMode !== 'grouped' ? viewMode : null,
      }));
    } catch {}
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    doSearch();
  };

  const doSearch = async () => {
    if (!query.trim() && !hasActiveFilters) {
      setResults(null);
      return;
    }
    syncUrlParams();
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
  }, [sortBy, sortOrder, groupByModule, viewMode]);

  useEffect(() => {
    if ((urlQ || urlModules || urlDateFrom || urlDateTo || urlTags) && !results && !loading) {
      doSearch();
    }
  }, []);

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
    setQuery('');
    try { localStorage.removeItem(SEARCH_FILTER_KEY); } catch {}
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleString('zh-CN');

  const getModuleInfo = (type: string) => {
    return MODULE_OPTIONS.find((m) => m.key === type + 's') || MODULE_OPTIONS.find((m) => m.key === type);
  };

  const navigateToModule = (module: string, id: number, extra?: Record<string, string>) => {
    const params: Record<string, string> = { ...extra };
    if (query) params.q = query;
    const search = new URLSearchParams(params).toString();
    navigate({ pathname: `/${module}`, search });
  };

  const jumpBtnStyle = (color: string): React.CSSProperties => ({
    padding: '4px 10px',
    background: `${color}15`,
    border: `1px solid ${color}`,
    borderRadius: 4,
    color,
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  const cardInteractiveStyle = (color: string): React.CSSProperties => ({
    ...cardStyle,
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid #333',
  });

  const onCardEnter = (e: React.MouseEvent<HTMLDivElement>, color: string) => {
    (e.currentTarget as HTMLDivElement).style.borderColor = color;
    (e.currentTarget as HTMLDivElement).style.background = '#1e2a1e';
  };

  const onCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
    (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a';
  };

  const searchHeaderActions = (
    <button
      type="button"
      onClick={() => (isMobile ? setShowFilters(true) : setShowFilters(!showFilters))}
      style={{
        padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '12px 16px',
        background: showFilters ? colors.primary : colors.bgTertiary,
        border: `1px solid ${showFilters ? colors.primary : colors.border}`,
        borderRadius: radius.md,
        color: colors.textInverse,
        cursor: 'pointer',
        fontSize: isMobile ? fontSize.sm : 15,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: isMobile ? 40 : 0,
        minWidth: isMobile ? 40 : 0,
        position: 'relative',
      }}
      title="高级筛选"
    >
      {isMobile ? '⚙️' : '⚙️ 筛选'}
      {hasActiveFilters && (
        <span
          style={{
            position: isMobile ? 'absolute' : 'relative',
            top: isMobile ? 4 : 'auto',
            right: isMobile ? 4 : 'auto',
            marginLeft: isMobile ? 0 : 6,
            width: isMobile ? 8 : undefined,
            height: isMobile ? 8 : undefined,
            borderRadius: '50%',
            background: colors.warning,
            display: isMobile ? 'inline-block' : 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isMobile ? 'transparent' : colors.textInverse,
            fontSize: isMobile ? 0 : 11,
            minWidth: isMobile ? 0 : 18,
            padding: isMobile ? 0 : '2px 6px',
          }}
        >
          {!isMobile && '!'}
        </span>
      )}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="全站检索"
        subtitle={results ? `共找到 ${results.total} 条结果` : undefined}
        rightAction={searchHeaderActions}
        sticky
      />

      {!isMobile && (
        <h2 style={{ margin: '0 0 24px', color: colors.text }}>
          全站检索
        </h2>
      )}

      <form
        onSubmit={handleSearch}
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? spacing.md : 8,
          marginBottom: isMobile ? spacing.lg : 16,
        }}
      >
        <div style={{ display: 'flex', flex: 1, gap: spacing.sm }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索排练、角色、批注、素材..."
            style={{
              flex: 1,
              padding: isMobile
                ? `${spacing.md + 2}px ${spacing.md + 2}px`
                : '12px 16px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              color: colors.text,
              fontSize: isMobile ? fontSize.lg : 16,
              outline: 'none',
              transition: 'all 0.15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.primary;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {!isMobile && searchHeaderActions}
        </div>
        {isMobile && searchHeaderActions}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: isMobile
              ? `${spacing.md + 2}px ${spacing.lg}px`
              : '12px 24px',
            background: colors.primary,
            border: 'none',
            borderRadius: radius.md,
            color: colors.textInverse,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: isMobile ? fontSize.md : 15,
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
            minHeight: isMobile ? 50 : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
              <span className="animate-pulse">⏳</span>
              搜索中
            </span>
          ) : isMobile ? (
            '🔍'
          ) : (
            '🔍 搜索'
          )}
        </button>
      </form>

      {showFilters && !isMobile && (
        <div style={{
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: isMobile ? spacing.lg : 20,
          marginBottom: isMobile ? spacing.lg : 24,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <h3 style={{ margin: 0, color: colors.text, fontSize: isMobile ? fontSize.md : 15 }}>高级筛选</h3>
            <button
              onClick={clearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: isMobile ? fontSize.sm : 13,
              }}
            >
              重置筛选
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            <div>
              <label style={filterLabelStyle}>模块类型</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                {MODULE_OPTIONS.map((mod) => (
                  <label
                    key={mod.key}
                    style={{
                      ...moduleTagStyle,
                      padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : moduleTagStyle.padding,
                      fontSize: isMobile ? fontSize.sm : moduleTagStyle.fontSize,
                      background: selectedModules.includes(mod.key)
                        ? mod.color + '20'
                        : colors.bgTertiary,
                      borderColor: selectedModules.includes(mod.key)
                        ? mod.color
                        : colors.border,
                      color: selectedModules.includes(mod.key)
                        ? mod.color
                        : colors.textMuted,
                      minHeight: isMobile ? 40 : 0,
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
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: spacing.sm, alignItems: isMobile ? 'stretch' : 'center' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    ...selectStyle,
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={{
                    ...selectStyle,
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                  }}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>时间范围</label>
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm }}>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                  style={{
                    ...selectStyle,
                    flex: 1,
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                  }}
                >
                  {DATE_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: spacing.sm, alignItems: isMobile ? 'stretch' : 'center' }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    ...dateInputStyle,
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                  }}
                />
                <span style={{ color: colors.textDim, textAlign: 'center' }}>至</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    ...dateInputStyle,
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>结果展示方式</label>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                  onClick={() => {
                    setGroupByModule(true);
                    setViewMode('grouped');
                  }}
                  style={{
                    ...viewModeBtnStyle,
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                    background: viewMode === 'grouped' ? colors.primary : colors.bgTertiary,
                    borderColor: viewMode === 'grouped' ? colors.primary : colors.border,
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
                    minHeight: isMobile ? 44 : undefined,
                    padding: isMobile ? `${spacing.md}px ${spacing.md}px` : undefined,
                    fontSize: isMobile ? fontSize.md : undefined,
                    background: viewMode === 'list' ? colors.primary : colors.bgTertiary,
                    borderColor: viewMode === 'list' ? colors.primary : colors.border,
                  }}
                >
                  列表视图
                </button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={filterLabelStyle}>标签筛选</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                  {allTags.map((tagInfo) => {
                    const tagColor = tagInfo.color || getTagColor(tagInfo.name);
                    const isSelected = selectedTags.includes(tagInfo.name);
                    return (
                      <label
                        key={tagInfo.name}
                        style={{
                          ...tagStyle,
                          minHeight: isMobile ? 36 : 0,
                          padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : tagStyle.padding,
                          fontSize: isMobile ? fontSize.sm : tagStyle.fontSize,
                          background: isSelected ? `${tagColor}30` : colors.bgTertiary,
                          borderColor: isSelected ? tagColor : colors.border,
                          color: isSelected ? tagColor : colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTag(tagInfo.name)}
                          style={{ display: 'none' }}
                        />
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: tagColor,
                          flexShrink: 0,
                        }} />
                        {tagInfo.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: spacing.sm,
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${colors.border}`,
          }}>
            <button
              onClick={() => setShowFilters(false)}
              style={{
                padding: isMobile ? `${spacing.md}px ${spacing.lg}px` : '8px 20px',
                background: colors.bgTertiary,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.textSecondary,
                cursor: 'pointer',
                fontSize: isMobile ? fontSize.md : 14,
                minHeight: isMobile ? 44 : 0,
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
                padding: isMobile ? `${spacing.md}px ${spacing.lg}px` : '8px 20px',
                background: colors.primary,
                border: 'none',
                borderRadius: radius.md,
                color: colors.textInverse,
                cursor: 'pointer',
                fontSize: isMobile ? fontSize.md : 14,
                fontWeight: 600,
                minHeight: isMobile ? 44 : 0,
              }}
            >
              应用筛选
            </button>
          </div>
        </div>
      )}

      {isMobile && (
        <BottomSheet
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          title="高级筛选"
          rightAction={
            <button
              onClick={clearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: fontSize.sm,
                padding: spacing.xs,
              }}
            >
              重置
            </button>
          }
        >
          <div style={{ padding: `0 ${spacing.md}px ${spacing.xl}px`, display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            <div>
              <label style={filterLabelStyle}>模块类型</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                {MODULE_OPTIONS.map((mod) => (
                  <label
                    key={mod.key}
                    style={{
                      ...moduleTagStyle,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      fontSize: fontSize.sm,
                      minHeight: 40,
                      background: selectedModules.includes(mod.key)
                        ? mod.color + '20'
                        : colors.bgTertiary,
                      borderColor: selectedModules.includes(mod.key)
                        ? mod.color
                        : colors.border,
                      color: selectedModules.includes(mod.key)
                        ? mod.color
                        : colors.textMuted,
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginTop: spacing.sm }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    ...selectStyle,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={{
                    ...selectStyle,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                  }}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>时间范围</label>
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm }}>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                  style={{
                    ...selectStyle,
                    flex: 1,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                  }}
                >
                  {DATE_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    ...dateInputStyle,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                  }}
                />
                <span style={{ color: colors.textDim, textAlign: 'center' }}>至</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    ...dateInputStyle,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={filterLabelStyle}>结果展示方式</label>
              <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                <button
                  onClick={() => {
                    setGroupByModule(true);
                    setViewMode('grouped');
                  }}
                  style={{
                    ...viewModeBtnStyle,
                    flex: 1,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                    background: viewMode === 'grouped' ? colors.primary : colors.bgTertiary,
                    borderColor: viewMode === 'grouped' ? colors.primary : colors.border,
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
                    flex: 1,
                    minHeight: 44,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                    background: viewMode === 'list' ? colors.primary : colors.bgTertiary,
                    borderColor: viewMode === 'list' ? colors.primary : colors.border,
                  }}
                >
                  列表视图
                </button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div>
                <label style={filterLabelStyle}>标签筛选</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
                  {allTags.map((tagInfo) => {
                    const tagColor = tagInfo.color || getTagColor(tagInfo.name);
                    const isSelected = selectedTags.includes(tagInfo.name);
                    return (
                      <label
                        key={tagInfo.name}
                        style={{
                          ...tagStyle,
                          minHeight: 36,
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          fontSize: fontSize.sm,
                          background: isSelected ? `${tagColor}30` : colors.bgTertiary,
                          borderColor: isSelected ? tagColor : colors.border,
                          color: isSelected ? tagColor : colors.textSecondary,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTag(tagInfo.name)}
                          style={{ display: 'none' }}
                        />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tagColor }} />
                        {tagInfo.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: spacing.sm, paddingTop: spacing.md, borderTop: `1px solid ${colors.border}` }}>
              <button
                onClick={() => setShowFilters(false)}
                style={{
                  flex: 1,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  background: colors.bgTertiary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                  minHeight: 48,
                  fontWeight: 500,
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
                  flex: 1.5,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  background: colors.primary,
                  border: 'none',
                  borderRadius: radius.md,
                  color: colors.textInverse,
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                  fontWeight: 600,
                  minHeight: 48,
                }}
              >
                应用筛选
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {results && (
        <div>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? spacing.md : undefined,
            marginBottom: isMobile ? spacing.lg : 20,
          }}>
            <div style={{
              fontSize: isMobile ? fontSize.md : 14,
              color: colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}>
              共找到{' '}
              <strong style={{
                color: colors.primary,
                fontSize: isMobile ? fontSize.lg : undefined,
                fontWeight: 700,
              }}>
                {results.total}
              </strong>{' '}
              条结果
            </div>
            <div style={{
              display: 'flex',
              gap: spacing.sm,
              alignSelf: isMobile ? 'flex-end' : undefined,
            }}>
              <button
                onClick={() => {
                  setGroupByModule(true);
                  setViewMode('grouped');
                }}
                style={{
                  ...smallBtnStyle,
                  minHeight: isMobile ? 36 : 0,
                  padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : undefined,
                  fontSize: isMobile ? fontSize.sm : undefined,
                  background: viewMode === 'grouped' ? colors.primary : colors.bgTertiary,
                  borderRadius: radius.md,
                }}
              >
                📂 分组
              </button>
              <button
                onClick={() => {
                  setGroupByModule(false);
                  setViewMode('list');
                }}
                style={{
                  ...smallBtnStyle,
                  minHeight: isMobile ? 36 : 0,
                  padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : undefined,
                  fontSize: isMobile ? fontSize.sm : undefined,
                  background: viewMode === 'list' ? colors.primary : colors.bgTertiary,
                  borderRadius: radius.md,
                }}
              >
                📋 列表
              </button>
            </div>
          </div>

          {viewMode === 'grouped' ? (
            <>
              {results.rehearsals.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <h3 style={{ color: '#e67e22', fontSize: 15, marginBottom: 12 }}>📅 排练 ({results.rehearsals.length})</h3>
                  {results.rehearsals.map((r: any) => (
                    <div
                      key={r.id}
                      style={cardInteractiveStyle('#e67e22')}
                      onMouseEnter={(e) => onCardEnter(e, '#e67e22')}
                      onMouseLeave={(e) => onCardLeave(e)}
                      onClick={() => navigateToModule('calendar', r.id, { rehearsalId: String(r.id) })}
                      title="点击跳转到排练页面查看详情"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToModule('calendar', r.id, { rehearsalId: String(r.id) });
                          }}
                          style={jumpBtnStyle('#e67e22')}
                        >
                          跳转 →
                        </button>
                      </div>
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
                      <div
                        key={r.id}
                        style={cardInteractiveStyle('#9b59b6')}
                        onMouseEnter={(e) => onCardEnter(e, '#9b59b6')}
                        onMouseLeave={(e) => onCardLeave(e)}
                        onClick={() => navigateToModule('roles', r.id, { roleId: String(r.id) })}
                        title="点击跳转到角色页面查看详情"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToModule('roles', r.id, { roleId: String(r.id) });
                            }}
                            style={jumpBtnStyle('#9b59b6')}
                          >
                            跳转 →
                          </button>
                        </div>
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
                      style={cardInteractiveStyle('#2ecc71')}
                      onMouseEnter={(e) => onCardEnter(e, '#2ecc71')}
                      onMouseLeave={(e) => onCardLeave(e)}
                      onClick={() => {
                        const params: Record<string, string> = { annotationId: String(a.id) };
                        if (a.sceneNumber) params.scene = String(a.sceneNumber);
                        navigateToModule('annotations', a.id, params);
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
                                  background: a.tagColor || getTagColor(a.tag),
                                  color: '#fff',
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {a.tag}
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
                            navigateToModule('annotations', a.id, params);
                          }}
                          style={jumpBtnStyle('#2ecc71')}
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
                    <div
                      key={m.id}
                      style={cardInteractiveStyle('#3498db')}
                      onMouseEnter={(e) => onCardEnter(e, '#3498db')}
                      onMouseLeave={(e) => onCardLeave(e)}
                      onClick={() => navigateToModule('materials', m.id, { materialId: String(m.id) })}
                      title="点击跳转到素材页面查看详情"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToModule('materials', m.id, { materialId: String(m.id) });
                          }}
                          style={jumpBtnStyle('#3498db')}
                        >
                          跳转 →
                        </button>
                      </div>
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
                  const moduleColor = moduleInfo?.color || '#666';
                  const handleJump = () => {
                    if (item.type === 'rehearsal') {
                      navigateToModule('calendar', item.id, { rehearsalId: String(item.id) });
                    } else if (item.type === 'role') {
                      navigateToModule('roles', item.id, { roleId: String(item.id) });
                    } else if (item.type === 'annotation') {
                      const params: Record<string, string> = { annotationId: String(item.id) };
                      if (item.raw?.sceneNumber) params.scene = String(item.raw.sceneNumber);
                      navigateToModule('annotations', item.id, params);
                    } else if (item.type === 'material') {
                      navigateToModule('materials', item.id, { materialId: String(item.id) });
                    }
                  };
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      style={{
                        ...cardStyle,
                        borderLeft: `4px solid ${moduleColor}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={handleJump}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = moduleColor;
                        (e.currentTarget as HTMLDivElement).style.background = '#1e2a1e';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
                        (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a';
                      }}
                      title={`点击跳转到${moduleInfo?.label || item.type}页面查看详情`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{moduleInfo?.icon || '📄'}</span>
                        <strong style={{ color: '#e0e0e0' }}>{item.title}</strong>
                        <span style={{
                          padding: '2px 8px',
                          background: moduleColor + '20',
                          border: `1px solid ${moduleColor}`,
                          color: moduleColor,
                          borderRadius: 10,
                          fontSize: 11,
                          marginLeft: 'auto',
                        }}>
                          {moduleInfo?.label || item.type}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleJump(); }}
                          style={jumpBtnStyle(moduleColor)}
                        >
                          跳转 →
                        </button>
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                          {item.description && item.description.length > 150
                            ? item.description.substring(0, 150) + '...'
                            : item.description}
                        </div>
                      )}
                      {item.type === 'annotation' && item.raw?.sceneNumber && (
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
                            {item.tags.map((t: string, i: number) => {
                              const tColor = (item.type === 'annotation' && item.raw?.tagColor) ? item.raw.tagColor : getTagColor(t);
                              return (
                                <span
                                  key={i}
                                  style={{
                                    background: item.type === 'annotation' ? tColor : '#2a2a2a',
                                    color: item.type === 'annotation' ? '#fff' : '#888',
                                    padding: '1px 6px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                  }}
                                >
                                  {t}
                                </span>
                              );
                            })}
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
            <div style={{ marginTop: isMobile ? spacing.xl : 32 }}>
              <EmptyState
                icon="🔍"
                title="未找到相关结果"
                description={query ? `没有匹配"${query}"的内容` : '请输入关键词搜索'}
                primaryAction={{
                  label: '清空搜索词',
                  onClick: () => {
                    setQuery('');
                    clearFilters();
                  },
                }}
                secondaryAction={{
                  label: '返回首页',
                  onClick: () => navigate('/'),
                }}
              />
            </div>
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
