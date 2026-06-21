import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { colors, spacing, fontSize, radius } from '../styles/theme';

interface TagInfo {
  name: string;
  color: string | null;
}

interface SystemTagInfo {
  id: number;
  name: string;
  color: string;
}

interface Annotation {
  id: number;
  scriptContent: string;
  note: string;
  startOffset: number | null;
  endOffset: number | null;
  tag: string;
  tagColor: string;
  sceneNumber: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  materialIds?: number[];
  highlights?: { field: string; start: number; end: number }[];
  systemTags?: SystemTagInfo[];
}

interface SceneGroup {
  sceneNumber: number | null;
  sceneLabel: string;
  count: number;
  annotations: Annotation[];
}

interface GroupedResult {
  groups: SceneGroup[];
  totalCount: number;
  sceneCount: number;
}

interface MaterialLite {
  id: number;
  originalName: string;
  category?: string;
  categories?: string[];
}

interface AnnotationVersion {
  id: number;
  annotationId: number;
  scriptContent: string;
  note: string;
  startOffset: number | null;
  endOffset: number | null;
  tag: string;
  tagColor: string;
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

const DEFAULT_TAG_COLORS = [
  '#3498db', '#e74c3c', '#e67e22', '#2ecc71', '#9b59b6',
  '#f1c40f', '#1abc9c', '#e91e63', '#00bcd4', '#ff5722',
  '#8bc34a', '#607d8b',
];

const PRESET_TAGS: TagInfo[] = [
  { name: '舞台指示', color: '#3498db' },
  { name: '情感', color: '#e74c3c' },
  { name: '节奏', color: '#e67e22' },
  { name: '走位', color: '#2ecc71' },
  { name: '道具', color: '#9b59b6' },
  { name: '灯光', color: '#f1c40f' },
];

const FILTER_STATE_KEY = 'annotations_filter_state';

interface FilterState {
  searchQuery: string;
  selectedTags: string[];
  activeScene: number | null | '__all__';
  viewMode: 'grouped' | 'list';
}

function loadFilterState(): FilterState | null {
  try {
    const raw = localStorage.getItem(FILTER_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveFilterState(state: FilterState) {
  try {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export default function AnnotationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { user, isDirector } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'director';
  const canEdit = isAdmin || isDirector || true;

  const saved = useMemo(() => loadFilterState(), []);

  const [groupedData, setGroupedData] = useState<GroupedResult | null>(null);
  const [materials, setMaterials] = useState<MaterialLite[]>([]);
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [systemTags, setSystemTags] = useState<SystemTagInfo[]>([]);
  const [selectedSystemTagIds, setSelectedSystemTagIds] = useState<number[]>(
    searchParams.get('tagIds') ? searchParams.get('tagIds')!.split(',').map(Number).filter(Boolean) : []
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || saved?.searchQuery || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags') ? searchParams.get('tags')!.split(',') : saved?.selectedTags || []
  );
  const [activeScene, setActiveScene] = useState<number | null | '__all__'>(
    searchParams.get('scene')
      ? searchParams.get('scene') === 'all' ? '__all__' : Number(searchParams.get('scene'))
      : saved?.activeScene ?? '__all__'
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    scriptContent: '',
    note: '',
    tag: '',
    tagColor: '',
    sceneNumber: '',
    startOffset: '',
    endOffset: '',
    materialIds: [] as number[],
  });
  const [versions, setVersions] = useState<Record<number, AnnotationVersion[]>>({});
  const [showVersions, setShowVersions] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>(
    searchParams.get('viewMode') as 'grouped' | 'list' || saved?.viewMode || 'grouped'
  );
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<number | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  const annotationRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sceneRefs = useRef<Record<string, HTMLElement | null>>({});
  const colorInputRef = useRef<HTMLInputElement>(null);

  const canModify = (annotation: Annotation) => {
    if (isDirector) return true;
    return user?.id === annotation.createdBy;
  };

  const getTagColor = useCallback((tag: string, tagColor?: string | null): string => {
    if (tagColor) return tagColor;
    const preset = PRESET_TAGS.find((t) => t.name === tag);
    if (preset?.color) return preset.color;
    const fromAvailable = availableTags.find((t) => t.name === tag);
    if (fromAvailable?.color) return fromAvailable.color;
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return DEFAULT_TAG_COLORS[Math.abs(hash) % DEFAULT_TAG_COLORS.length];
  }, [availableTags]);

  const loadGrouped = async (query?: string) => {
    try {
      let data = await api.annotations.listGroupedByScene(query);

      if (selectedSystemTagIds.length > 0) {
        try {
          const filterResult = await api.tags.filterByTags(selectedSystemTagIds, 'annotation');
          const validIds = new Set(filterResult.targetIds);
          data = {
            ...data,
            groups: data.groups.map((g: any) => ({
              ...g,
              annotations: g.annotations.filter((a: any) => validIds.has(a.id)),
              count: g.annotations.filter((a: any) => validIds.has(a.id)).length,
            })).filter((g: any) => g.count > 0),
            totalCount: data.groups.reduce((sum: number, g: any) => sum + g.annotations.filter((a: any) => validIds.has(a.id)).length, 0),
            sceneCount: data.groups.filter((g: any) => g.annotations.filter((a: any) => validIds.has(a.id)).length > 0).length,
          };
        } catch {}
      }

      const allAnnotations = data.groups.flatMap((g: any) => g.annotations);
      const annotationsWithTags = await Promise.all(
        allAnnotations.map(async (a: any) => {
          try {
            const tags = await api.tags.getTagsForTarget('annotation', a.id);
            return { ...a, systemTags: tags };
          } catch {
            return a;
          }
        })
      );

      const annotationMap = new Map(annotationsWithTags.map((a: any) => [a.id, a]));
      data = {
        ...data,
        groups: data.groups.map((g: any) => ({
          ...g,
          annotations: g.annotations.map((a: any) => annotationMap.get(a.id) || a),
        })),
      };

      setGroupedData(data);
    } catch (e) {
      console.error('加载批注分组失败', e);
    }
  };

  const loadSystemTags = async () => {
    try {
      const data = await api.tags.list({ category: 'annotation' });
      setSystemTags(data);
    } catch {}
  };

  const loadMaterials = async () => {
    try {
      const data = await api.materials.list();
      setMaterials(data);
    } catch (e) {
      console.error('加载素材列表失败', e);
    }
  };

  const loadTags = async () => {
    try {
      const data = await api.annotations.getTags();
      setAvailableTags(data);
    } catch (e) {
      console.error('加载标签列表失败', e);
    }
  };

  useEffect(() => {
    loadGrouped();
    loadMaterials();
    loadTags();
    loadSystemTags();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadGrouped(searchQuery || undefined);
      syncUrlParams();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, selectedSystemTagIds]);

  useEffect(() => {
    saveFilterState({ searchQuery, selectedTags, activeScene, viewMode });
  }, [searchQuery, selectedTags, activeScene, viewMode]);

  const syncUrlParams = () => {
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }
    if (activeScene !== '__all__' && activeScene !== null) {
      params.set('scene', String(activeScene));
    } else {
      params.delete('scene');
    }
    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','));
    } else {
      params.delete('tags');
    }
    if (viewMode !== 'grouped') {
      params.set('viewMode', viewMode);
    } else {
      params.delete('viewMode');
    }
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    syncUrlParams();
  }, [selectedTags, activeScene, viewMode]);

  useEffect(() => {
    const sceneParam = searchParams.get('scene');
    const annotationIdParam = searchParams.get('annotationId');
    const qParam = searchParams.get('q');

    if (qParam && qParam !== searchQuery) {
      setSearchQuery(qParam);
    }

    if (sceneParam) {
      if (sceneParam === 'all') {
        setActiveScene('__all__');
      } else {
        const sceneNum = Number(sceneParam);
        if (sceneNum !== activeScene) {
          setActiveScene(sceneNum);
          setTimeout(() => scrollToScene(sceneParam), 200);
        }
      }
    }

    if (annotationIdParam) {
      const annId = Number(annotationIdParam);
      setHighlightedAnnotationId(annId);
      setTimeout(() => scrollToAnnotation(annId), 300);
      setTimeout(() => {
        setHighlightedAnnotationId(null);
        const params = new URLSearchParams(searchParams);
        params.delete('annotationId');
        setSearchParams(params, { replace: true });
      }, 3000);
    }
  }, [searchParams, groupedData]);

  const scrollToScene = (sceneKey: string) => {
    const el = sceneRefs.current[sceneKey];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToAnnotation = (annotationId: number) => {
    const el = annotationRefs.current[annotationId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const jumpToScene = (sceneNumber: number | null) => {
    const key = sceneNumber == null ? 'null' : String(sceneNumber);
    setActiveScene(sceneNumber ?? '__all__');
    const params: Record<string, string> = {};
    if (sceneNumber != null) params.scene = String(sceneNumber);
    if (searchQuery) params.q = searchQuery;
    setSearchParams(params);
    setTimeout(() => scrollToScene(key), 100);
  };

  const clearJumpParams = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('annotationId');
    setSearchParams(params, { replace: true });
  };

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
      tagColor: form.tag ? (form.tagColor || undefined) : undefined,
      sceneNumber: form.sceneNumber ? Number(form.sceneNumber) : undefined,
      startOffset: form.startOffset ? Number(form.startOffset) : undefined,
      endOffset: form.endOffset ? Number(form.endOffset) : undefined,
      materialIds: form.materialIds.length > 0 ? form.materialIds : undefined,
    });
    setForm({ scriptContent: '', note: '', tag: '', tagColor: '', sceneNumber: '', startOffset: '', endOffset: '', materialIds: [] });
    setCustomTagInput('');
    setShowForm(false);
    loadGrouped(searchQuery || undefined);
    loadTags();
  };

  const handleEdit = (annotation: Annotation) => {
    setEditingId(annotation.id);
    setForm({
      scriptContent: annotation.scriptContent,
      note: annotation.note || '',
      tag: annotation.tag || '',
      tagColor: annotation.tagColor || '',
      sceneNumber: annotation.sceneNumber?.toString() || '',
      startOffset: annotation.startOffset?.toString() || '',
      endOffset: annotation.endOffset?.toString() || '',
      materialIds: annotation.materialIds || [],
    });
    setCustomTagInput('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await api.annotations.update(editingId, {
        scriptContent: form.scriptContent,
        note: form.note || undefined,
        tag: form.tag || undefined,
        tagColor: form.tag ? (form.tagColor || undefined) : undefined,
        sceneNumber: form.sceneNumber ? Number(form.sceneNumber) : undefined,
        startOffset: form.startOffset ? Number(form.startOffset) : undefined,
        endOffset: form.endOffset ? Number(form.endOffset) : undefined,
        materialIds: form.materialIds,
      });
      setEditingId(null);
      setForm({ scriptContent: '', note: '', tag: '', tagColor: '', sceneNumber: '', startOffset: '', endOffset: '', materialIds: [] });
      setCustomTagInput('');
      loadGrouped(searchQuery || undefined);
      loadTags();
    } catch (err: any) {
      alert(err.message || '更新失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ scriptContent: '', note: '', tag: '', tagColor: '', sceneNumber: '', startOffset: '', endOffset: '', materialIds: [] });
    setCustomTagInput('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条批注吗？删除后可从版本历史中恢复。')) return;
    try {
      await api.annotations.remove(id);
      loadGrouped(searchQuery || undefined);
      loadTags();
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
      loadGrouped(searchQuery || undefined);
    } catch (err: any) {
      alert(err.message || '恢复失败');
    }
  };

  const toggleMaterial = (materialId: number) => {
    setForm((prev) => ({
      ...prev,
      materialIds: prev.materialIds.includes(materialId)
        ? prev.materialIds.filter((id) => id !== materialId)
        : [...prev.materialIds, materialId],
    }));
  };

  const selectPresetTag = (tagInfo: TagInfo) => {
    setForm((prev) => ({
      ...prev,
      tag: tagInfo.name,
      tagColor: tagInfo.color || prev.tagColor,
    }));
    setCustomTagInput('');
  };

  const handleCustomTagConfirm = () => {
    if (customTagInput.trim()) {
      const existing = availableTags.find((t) => t.name === customTagInput.trim());
      setForm((prev) => ({
        ...prev,
        tag: customTagInput.trim(),
        tagColor: existing?.color || prev.tagColor || DEFAULT_TAG_COLORS[availableTags.length % DEFAULT_TAG_COLORS.length],
      }));
    }
  };

  const toggleFilterTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const clearFilterTags = () => {
    setSelectedTags([]);
  };

  const goToSearchPage = () => {
    const params: Record<string, string> = { modules: 'annotations' };
    if (searchQuery) params.q = searchQuery;
    if (selectedTags.length > 0) params.tags = selectedTags.join(',');
    navigate({ pathname: '/search', search: new URLSearchParams(params).toString() });
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

  const renderTagSelector = () => {
    const allTagOptions = [...PRESET_TAGS];
    availableTags.forEach((t) => {
      if (!allTagOptions.find((p) => p.name === t.name)) {
        allTagOptions.push(t);
      }
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: '#888', fontSize: 13 }}>🏷️ 标签</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allTagOptions.map((tagInfo) => {
            const isSelected = form.tag === tagInfo.name;
            const color = tagInfo.color || getTagColor(tagInfo.name);
            return (
              <button
                key={tagInfo.name}
                type="button"
                onClick={() => selectPresetTag(tagInfo)}
                style={{
                  padding: '3px 10px',
                  background: isSelected ? color : `${color}20`,
                  border: `1px solid ${isSelected ? color : `${color}60`}`,
                  borderRadius: 12,
                  color: isSelected ? '#fff' : color,
                  cursor: 'pointer',
                  fontSize: 12,
                  transition: 'all 0.15s',
                }}
              >
                {tagInfo.name}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            placeholder="自定义标签..."
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomTagConfirm();
              }
            }}
            style={{ ...inputStyle, flex: 1, fontSize: 13 }}
          />
          <button
            type="button"
            onClick={handleCustomTagConfirm}
            disabled={!customTagInput.trim()}
            style={{
              padding: '6px 12px',
              background: customTagInput.trim() ? '#e74c3c' : '#333',
              border: 'none',
              borderRadius: 6,
              color: customTagInput.trim() ? '#fff' : '#666',
              cursor: customTagInput.trim() ? 'pointer' : 'default',
              fontSize: 12,
            }}
          >
            确定
          </button>
        </div>
        {form.tag && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>
              当前标签:
            </span>
            <span
              style={{
                background: form.tagColor || getTagColor(form.tag),
                color: '#fff',
                padding: '2px 10px',
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              {form.tag}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#666' }}>颜色:</span>
              <div
                onClick={() => colorInputRef.current?.click()}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: form.tagColor || getTagColor(form.tag),
                  border: '2px solid #555',
                  cursor: 'pointer',
                }}
              />
              <input
                ref={colorInputRef}
                type="color"
                value={form.tagColor || getTagColor(form.tag)}
                onChange={(e) => setForm((prev) => ({ ...prev, tagColor: e.target.value }))}
                style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
              />
            </div>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, tag: '', tagColor: '' }))}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAnnotationCard = (a: Annotation) => {
    const isHighlighted = highlightedAnnotationId === a.id;
    const displayColor = getTagColor(a.tag, a.tagColor);
    return (
      <div
        key={a.id}
        ref={(el) => { annotationRefs.current[a.id] = el; }}
        style={{
          ...cardStyle,
          ...(a.tag ? { borderLeft: `3px solid ${displayColor}` } : {}),
          ...(isHighlighted ? { borderColor: '#f39c12', boxShadow: '0 0 12px rgba(243,156,18,0.4)' } : {}),
          transition: 'all 0.3s ease',
        }}
      >
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
            {renderTagSelector()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
            <div>
              <div style={{ color: '#888', fontSize: 13, marginBottom: 6 }}>📁 关联素材（可选）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {materials.length === 0 && <span style={{ color: '#555', fontSize: 12 }}>暂无素材</span>}
                {materials.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      background: form.materialIds.includes(m.id) ? 'rgba(52, 152, 219, 0.2)' : '#222',
                      border: `1px solid ${form.materialIds.includes(m.id) ? '#3498db' : '#444'}`,
                      borderRadius: 16,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#e0e0e0',
                      maxWidth: 240,
                    }}
                    title={m.originalName}
                  >
                    <input
                      type="checkbox"
                      checked={form.materialIds.includes(m.id)}
                      onChange={() => toggleMaterial(m.id)}
                      style={{ accentColor: '#3498db' }}
                    />
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200,
                    }}>
                      {m.originalName}
                    </span>
                  </label>
                ))}
              </div>
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
                        background: displayColor,
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    >
                      {a.tag}
                    </span>
                  )}
                  {a.systemTags && a.systemTags.length > 0 && a.systemTags.map((tag) => (
                    <span
                      key={tag.id}
                      style={{
                        background: `${tag.color}20`,
                        border: `1px solid ${tag.color}40`,
                        color: tag.color,
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {a.sceneNumber && (
                    <span
                      onClick={() => jumpToScene(a.sceneNumber)}
                      style={{
                        background: activeScene === a.sceneNumber ? 'rgba(52,152,219,0.25)' : '#2a2a2a',
                        color: activeScene === a.sceneNumber ? '#3498db' : '#888',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        cursor: 'pointer',
                        border: activeScene === a.sceneNumber ? '1px solid #3498db' : '1px solid transparent',
                      }}
                      title="点击跳转到该场次"
                    >
                      🎬 第{a.sceneNumber}场
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
                  {a.materialIds && a.materialIds.length > 0 && (
                    <span
                      style={{
                        background: 'rgba(52, 152, 219, 0.1)',
                        color: '#3498db',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        border: '1px solid rgba(52, 152, 219, 0.3)',
                      }}
                      title={a.materialIds.map((mid) => {
                        const m = materials.find((x) => x.id === mid);
                        return m ? m.originalName : `素材#${mid}`;
                      }).join('、')}
                    >
                      📁 {a.materialIds.length} 个素材
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
                          {v.tag && (
                            <span
                              style={{
                                background: getTagColor(v.tag, v.tagColor),
                                color: '#fff',
                                padding: '1px 6px',
                                borderRadius: 8,
                                fontSize: 10,
                              }}
                            >
                              {v.tag}
                            </span>
                          )}
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
    );
  };

  const visibleGroups = groupedData
    ? activeScene === '__all__'
      ? groupedData.groups
      : groupedData.groups.filter((g) => g.sceneNumber === activeScene)
    : [];

  const allAnnotationsFlat = useMemo(() => {
    if (!groupedData) return [];
    const all = groupedData.groups.flatMap((g) => g.annotations);
    if (selectedTags.length === 0) return all;
    return all.filter((a) => a.tag && selectedTags.includes(a.tag));
  }, [groupedData, selectedTags]);

  const filteredVisibleGroups = useMemo(() => {
    if (selectedTags.length === 0) return visibleGroups;
    return visibleGroups.map((g) => ({
      ...g,
      annotations: g.annotations.filter((a) => a.tag && selectedTags.includes(a.tag)),
      count: g.annotations.filter((a) => a.tag && selectedTags.includes(a.tag)).length,
    })).filter((g) => g.count > 0);
  }, [visibleGroups, selectedTags]);

  const tagsInUse = useMemo(() => {
    if (!groupedData) return [] as TagInfo[];
    const tagSet = new Map<string, string | null>();
    groupedData.groups.flatMap((g) => g.annotations).forEach((a) => {
      if (a.tag && !tagSet.has(a.tag)) {
        tagSet.set(a.tag, a.tagColor || null);
      }
    });
    return Array.from(tagSet.entries()).map(([name, color]) => ({
      name,
      color: color || getTagColor(name),
    }));
  }, [groupedData, getTagColor]);

  return (
    <div>
      <PageHeader
        title="文本批注"
        subtitle={groupedData
          ? `共 ${groupedData.totalCount} 条批注 · ${groupedData.sceneCount} 个场次${
              selectedTags.length > 0 ? ` · 筛选 ${allAnnotationsFlat.length} 条` : ''
            }`
          : undefined
        }
        rightAction={
          canEdit ? (
            <button
              onClick={() => (isMobile ? setShowForm(true) : setShowForm(!showForm))}
              style={{
                padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '10px 20px',
                background: colors.primary,
                border: 'none',
                borderRadius: radius.md,
                color: colors.textInverse,
                cursor: 'pointer',
                fontSize: isMobile ? fontSize.sm : 14,
                fontWeight: 600,
                minHeight: isMobile ? 40 : 0,
                minWidth: isMobile ? 40 : 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
              }}
              title={showForm ? '取消' : '新建批注'}
            >
              {showForm ? (isMobile ? '✕' : '取消') : isMobile ? '➕' : '+ 新批注'}
            </button>
          ) : null
        }
        sticky
      />

      {!isMobile && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, color: colors.text }}>文本批注</h2>
            {groupedData && (
              <span style={{ fontSize: 12, color: colors.textMuted }}>
                共 {groupedData.totalCount} 条批注 · {groupedData.sceneCount} 个场次
                {selectedTags.length > 0 && ` · 筛选 ${allAnnotationsFlat.length} 条`}
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? spacing.md : 8,
        marginBottom: isMobile ? spacing.lg : spacing.md,
      }}>
        <div style={{
          display: 'flex',
          flex: isMobile ? 1 : undefined,
          gap: spacing.sm,
          alignItems: 'center',
        }}>
          <div style={{
            display: 'flex',
            gap: 4,
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: 2,
          }}>
            <button
              onClick={() => setViewMode('grouped')}
              style={{
                ...toggleBtnStyle,
                minHeight: isMobile ? 36 : 0,
                padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : toggleBtnStyle.padding,
                fontSize: isMobile ? fontSize.sm : toggleBtnStyle.fontSize,
                background: viewMode === 'grouped' ? colors.primary : 'transparent',
                color: viewMode === 'grouped' ? colors.textInverse : colors.textMuted,
                borderRadius: isMobile ? radius.sm : toggleBtnStyle.borderRadius,
              }}
            >
              {isMobile ? '🎬' : '🎬 场次视图'}
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                ...toggleBtnStyle,
                minHeight: isMobile ? 36 : 0,
                padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : toggleBtnStyle.padding,
                fontSize: isMobile ? fontSize.sm : toggleBtnStyle.fontSize,
                background: viewMode === 'list' ? colors.primary : 'transparent',
                color: viewMode === 'list' ? colors.textInverse : colors.textMuted,
                borderRadius: isMobile ? radius.sm : toggleBtnStyle.borderRadius,
              }}
            >
              {isMobile ? '📋' : '📋 列表视图'}
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: spacing.sm,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <input
            placeholder="搜索批注内容..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              clearJumpParams();
            }}
            style={{
              ...inputStyle,
              width: isMobile ? '100%' : 200,
              minHeight: isMobile ? 40 : 0,
              padding: isMobile ? `${spacing.md}px ${spacing.md}px` : inputStyle.padding,
              fontSize: isMobile ? fontSize.md : inputStyle.fontSize,
              borderRadius: radius.md,
              flex: isMobile ? 1 : undefined,
            }}
          />
          <button
            onClick={() => (isMobile ? setShowFilterPanel(true) : setShowFilterPanel(!showFilterPanel))}
            style={{
              ...secondaryBtnStyle,
              ...(showFilterPanel ? {
                background: colors.primary,
                borderColor: colors.primary,
                color: colors.textInverse,
              } : {}),
              minHeight: isMobile ? 40 : 0,
              padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : secondaryBtnStyle.padding,
              fontSize: isMobile ? fontSize.sm : secondaryBtnStyle.fontSize,
              borderRadius: radius.md,
              position: 'relative',
            }}
          >
            {isMobile ? '🏷️' : '🏷️ 标签'}
            {selectedTags.length > 0 && (
              <span style={{
                position: 'absolute',
                top: isMobile ? 2 : -6,
                right: isMobile ? 2 : -6,
                background: colors.warning || colors.primary,
                color: colors.textInverse,
                fontSize: isMobile ? 9 : 10,
                padding: isMobile ? '0 4px' : '1px 5px',
                borderRadius: 8,
                minWidth: isMobile ? 14 : 16,
                height: isMobile ? 14 : undefined,
                textAlign: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}>
                {selectedTags.length}
              </span>
            )}
          </button>
          <button
            onClick={goToSearchPage}
            style={{
              ...secondaryBtnStyle,
              minHeight: isMobile ? 40 : 0,
              padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : secondaryBtnStyle.padding,
              fontSize: isMobile ? fontSize.sm : secondaryBtnStyle.fontSize,
              borderRadius: radius.md,
            }}
            title="高级搜索"
          >
            {isMobile ? '🔍' : '🔍 高级'}
          </button>
        </div>
      </div>

      {showFilterPanel && !isMobile && tagsInUse.length > 0 && (
        <div style={{
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>按标签筛选</span>
            {selectedTags.length > 0 && (
              <button
                onClick={clearFilterTags}
                style={{
                  background: 'none',
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.sm,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '2px 10px',
                }}
              >
                清除筛选
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            {tagsInUse.map((tagInfo) => {
              const isActive = selectedTags.includes(tagInfo.name);
              const color = tagInfo.color || getTagColor(tagInfo.name);
              return (
                <button
                  key={tagInfo.name}
                  onClick={() => toggleFilterTag(tagInfo.name)}
                  style={{
                    padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '4px 12px',
                    background: isActive ? color : `${color}20`,
                    border: `1px solid ${isActive ? color : `${color}50`}`,
                    borderRadius: 14,
                    color: isActive ? colors.textInverse : color,
                    cursor: 'pointer',
                    fontSize: isMobile ? fontSize.sm : 12,
                    minHeight: isMobile ? 32 : 0,
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  {tagInfo.name}
                  {isActive && ' ✕'}
                </button>
              );
            })}
          </div>

          {systemTags.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                🏷️ 统一标签 {selectedSystemTagIds.length > 0 && <span style={{ color: colors.info }}>(已选 {selectedSystemTagIds.length} 个)</span>}
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
                        padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '4px 12px',
                        borderRadius: 14,
                        border: `1px solid ${selected ? tag.color : colors.border}`,
                        background: selected ? `${tag.color}20` : 'transparent',
                        color: selected ? tag.color : colors.textSecondary,
                        fontSize: isMobile ? fontSize.sm : 12,
                        cursor: 'pointer',
                        minHeight: isMobile ? 32 : 0,
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
                      padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '4px 10px',
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      background: 'transparent',
                      color: colors.textMuted,
                      fontSize: isMobile ? fontSize.sm : 12,
                      cursor: 'pointer',
                      minHeight: isMobile ? 32 : 0,
                    }}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <BottomSheet
          isOpen={showFilterPanel && tagsInUse.length > 0}
          onClose={() => setShowFilterPanel(false)}
          title="标签筛选"
          rightAction={
            <button
              onClick={clearFilterTags}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: fontSize.sm,
                padding: spacing.xs,
              }}
            >
              清除
            </button>
          }
        >
          <div style={{ padding: `0 ${spacing.md}px ${spacing.xl}px`, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div>
              <span style={{ fontSize: fontSize.md, color: colors.textSecondary, fontWeight: 500 }}>自定义标签</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                {tagsInUse.map((tagInfo) => {
                  const isActive = selectedTags.includes(tagInfo.name);
                  const color = tagInfo.color || getTagColor(tagInfo.name);
                  return (
                    <button
                      key={tagInfo.name}
                      onClick={() => toggleFilterTag(tagInfo.name)}
                      style={{
                        padding: `${spacing.sm}px ${spacing.md}px`,
                        background: isActive ? color : `${color}20`,
                        border: `1px solid ${isActive ? color : `${color}50`}`,
                        borderRadius: 14,
                        color: isActive ? colors.textInverse : color,
                        cursor: 'pointer',
                        fontSize: fontSize.sm,
                        minHeight: 36,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      {tagInfo.name}
                      {isActive && ' ✕'}
                    </button>
                  );
                })}
              </div>
            </div>

            {systemTags.length > 0 && (
              <div>
                <span style={{ fontSize: fontSize.md, color: colors.textSecondary, fontWeight: 500 }}>
                  🏷️ 统一标签 {selectedSystemTagIds.length > 0 && <span style={{ color: colors.info }}>(已选 {selectedSystemTagIds.length})</span>}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
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
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: 14,
                          border: `1px solid ${selected ? tag.color : colors.border}`,
                          background: selected ? `${tag.color}20` : 'transparent',
                          color: selected ? tag.color : colors.textSecondary,
                          fontSize: fontSize.sm,
                          cursor: 'pointer',
                          minHeight: 36,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color }} />
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
                        padding: `${spacing.sm}px ${spacing.md}px`,
                        borderRadius: 14,
                        border: `1px solid ${colors.border}`,
                        background: 'transparent',
                        color: colors.textMuted,
                        fontSize: fontSize.sm,
                        cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowFilterPanel(false)}
              style={{
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
              完成筛选
            </button>
          </div>
        </BottomSheet>
      )}

      {showForm && !isMobile && (
        <form onSubmit={handleCreate} style={{
          ...formStyle,
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: colors.textSecondary }}>新建批注</h4>
          <textarea
            placeholder="剧本原文"
            value={form.scriptContent}
            onChange={(e) => setForm({ ...form, scriptContent: e.target.value })}
            required
            style={{
              ...inputStyle,
              minHeight: 80,
              padding: spacing.md,
              fontSize: fontSize.md,
              borderRadius: radius.md,
            }}
          />
          <textarea
            placeholder="批注笔记"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            style={{
              ...inputStyle,
              minHeight: 60,
              padding: spacing.md,
              fontSize: fontSize.md,
              borderRadius: radius.md,
            }}
          />
          {renderTagSelector()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              placeholder="场次"
              type="number"
              value={form.sceneNumber}
              onChange={(e) => setForm({ ...form, sceneNumber: e.target.value })}
              style={{
                ...inputStyle,
                minHeight: 44,
                padding: spacing.md,
                fontSize: fontSize.md,
                borderRadius: radius.md,
              }}
            />
            <input
              placeholder="起始偏移"
              type="number"
              value={form.startOffset}
              onChange={(e) => setForm({ ...form, startOffset: e.target.value })}
              style={{
                ...inputStyle,
                minHeight: 44,
                padding: spacing.md,
                fontSize: fontSize.md,
                borderRadius: radius.md,
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              placeholder="结束偏移"
              type="number"
              value={form.endOffset}
              onChange={(e) => setForm({ ...form, endOffset: e.target.value })}
              style={{
                ...inputStyle,
                minHeight: 44,
                padding: spacing.md,
                fontSize: fontSize.md,
                borderRadius: radius.md,
              }}
            />
            <div />
          </div>
          <div>
            <div style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>📁 关联素材（可选）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {materials.length === 0 && <span style={{ color: colors.textDim, fontSize: 12 }}>暂无素材</span>}
              {materials.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    background: form.materialIds.includes(m.id) ? `${colors.info}20` : colors.bgTertiary,
                    border: `1px solid ${form.materialIds.includes(m.id) ? colors.info : colors.border}`,
                    borderRadius: 16,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: colors.text,
                    minHeight: 36,
                    maxWidth: 240,
                  }}
                  title={m.originalName}
                >
                  <input
                    type="checkbox"
                    checked={form.materialIds.includes(m.id)}
                    onChange={() => toggleMaterial(m.id)}
                    style={{ accentColor: colors.info }}
                  />
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 200,
                  }}>
                    {m.originalName}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button
              type="submit"
              style={{
                ...primaryBtnStyle,
                minHeight: 44,
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
              }}
            >
              创建
            </button>
          </div>
        </form>
      )}

      {isMobile && (
        <BottomSheet
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          title={editingId ? '编辑批注' : '新建批注'}
          rightAction={
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: fontSize.lg,
                padding: spacing.xs,
              }}
            >
              ✕
            </button>
          }
        >
          <form onSubmit={handleCreate} style={{
            padding: `0 ${spacing.md}px ${spacing.xl}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.lg,
          }}>
            <div>
              <label style={{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: spacing.sm, display: 'block' }}>
                剧本原文 *
              </label>
              <textarea
                placeholder="输入剧本原文内容..."
                value={form.scriptContent}
                onChange={(e) => setForm({ ...form, scriptContent: e.target.value })}
                required
                style={{
                  ...inputStyle,
                  width: '100%',
                  minHeight: 120,
                  padding: `${spacing.md}px ${spacing.md}px`,
                  fontSize: fontSize.md,
                  borderRadius: radius.md,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: spacing.sm, display: 'block' }}>
                批注笔记
              </label>
              <textarea
                placeholder="添加批注笔记..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                style={{
                  ...inputStyle,
                  width: '100%',
                  minHeight: 80,
                  padding: `${spacing.md}px ${spacing.md}px`,
                  fontSize: fontSize.md,
                  borderRadius: radius.md,
                }}
              />
            </div>
            <div>{renderTagSelector()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
              <div>
                <label style={{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: spacing.sm, display: 'block' }}>场次</label>
                <input
                  placeholder="场次号"
                  type="number"
                  value={form.sceneNumber}
                  onChange={(e) => setForm({ ...form, sceneNumber: e.target.value })}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    minHeight: 48,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                    borderRadius: radius.md,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: spacing.sm, display: 'block' }}>起始偏移</label>
                <input
                  placeholder="可选"
                  type="number"
                  value={form.startOffset}
                  onChange={(e) => setForm({ ...form, startOffset: e.target.value })}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    minHeight: 48,
                    padding: `${spacing.md}px ${spacing.md}px`,
                    fontSize: fontSize.md,
                    borderRadius: radius.md,
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: spacing.sm, display: 'block' }}>结束偏移</label>
              <input
                placeholder="可选"
                type="number"
                value={form.endOffset}
                onChange={(e) => setForm({ ...form, endOffset: e.target.value })}
                style={{
                  ...inputStyle,
                  width: '100%',
                  minHeight: 48,
                  padding: `${spacing.md}px ${spacing.md}px`,
                  fontSize: fontSize.md,
                  borderRadius: radius.md,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: spacing.sm, display: 'block' }}>📁 关联素材（可选）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                {materials.length === 0 && (
                  <span style={{ color: colors.textDim, fontSize: fontSize.sm }}>暂无素材</span>
                )}
                {materials.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      background: form.materialIds.includes(m.id) ? `${colors.info}20` : colors.bgTertiary,
                      border: `1px solid ${form.materialIds.includes(m.id) ? colors.info : colors.border}`,
                      borderRadius: 16,
                      cursor: 'pointer',
                      fontSize: fontSize.sm,
                      color: colors.text,
                      minHeight: 40,
                      maxWidth: '100%',
                    }}
                    title={m.originalName}
                  >
                    <input
                      type="checkbox"
                      checked={form.materialIds.includes(m.id)}
                      onChange={() => toggleMaterial(m.id)}
                      style={{ accentColor: colors.info }}
                    />
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200,
                    }}>
                      {m.originalName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: spacing.md }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  background: colors.bgTertiary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                  fontWeight: 500,
                }}
              >
                取消
              </button>
              <button
                type="submit"
                style={{
                  flex: 1.5,
                  minHeight: 48,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  background: colors.primary,
                  border: 'none',
                  borderRadius: radius.md,
                  color: colors.textInverse,
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                  fontWeight: 600,
                }}
              >
                {editingId ? '保存修改' : '创建批注'}
              </button>
            </div>
          </form>
        </BottomSheet>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {viewMode === 'grouped' && groupedData && groupedData.groups.length > 0 && (
          <div
            style={{
              width: 200,
              flexShrink: 0,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 12,
              position: 'sticky',
              top: 16,
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontWeight: 600, color: '#ccc', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📂 场次导航</span>
              <button
                onClick={() => {
                  setActiveScene('__all__');
                  const params = new URLSearchParams(searchParams);
                  params.delete('scene');
                  params.delete('annotationId');
                  setSearchParams(params, { replace: true });
                }}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  background: activeScene === '__all__' ? '#e74c3c' : '#2a2a2a',
                  border: 'none',
                  borderRadius: 4,
                  color: activeScene === '__all__' ? '#fff' : '#888',
                  cursor: 'pointer',
                }}
              >
                全部
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupedData.groups.map((g) => {
                const key = g.sceneNumber == null ? 'null' : String(g.sceneNumber);
                const isActive = activeScene === g.sceneNumber;
                return (
                  <button
                    key={key}
                    ref={(el) => { sceneRefs.current[key] = el; }}
                    onClick={() => jumpToScene(g.sceneNumber)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: isActive ? 'rgba(231,76,60,0.15)' : 'transparent',
                      border: `1px solid ${isActive ? '#e74c3c' : 'transparent'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: isActive ? '#e74c3c' : '#aaa',
                      fontSize: 13,
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontWeight: isActive ? 600 : 400 }}>
                      {g.sceneNumber == null ? '📄 未指定' : `🎬 第${g.sceneNumber}场`}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        background: isActive ? '#e74c3c' : '#333',
                        color: '#fff',
                        padding: '1px 7px',
                        borderRadius: 10,
                      }}
                    >
                      {g.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {!groupedData ? (
            <div style={{
              textAlign: 'center',
              color: colors.textDim,
              padding: isMobile ? `${spacing.xl}px ${spacing.md}px` : 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.md,
            }}>
              <span className="animate-pulse" style={{ fontSize: 32 }}>⏳</span>
              <span style={{ fontSize: isMobile ? fontSize.md : 16 }}>加载中...</span>
            </div>
          ) : viewMode === 'grouped' ? (
            filteredVisibleGroups.length === 0 ? (
              <div style={{ marginTop: isMobile ? spacing.xl : 0 }}>
                <EmptyState
                  icon={searchQuery || selectedTags.length > 0 ? '🔍' : '📝'}
                  title={searchQuery || selectedTags.length > 0 ? '未找到匹配的批注' : '暂无批注'}
                  description={searchQuery || selectedTags.length > 0 ? '尝试调整搜索关键词或筛选条件' : canEdit ? '点击右上角按钮创建第一个批注' : '等待管理员创建批注内容'}
                  primaryAction={
                    canEdit
                      ? {
                          label: searchQuery || selectedTags.length > 0 ? '清除筛选' : '创建批注',
                          onClick: searchQuery || selectedTags.length > 0
                            ? () => {
                                setSearchQuery('');
                                clearFilterTags();
                              }
                            : () => setShowForm(true),
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              filteredVisibleGroups.map((g) => {
                const key = g.sceneNumber == null ? 'null' : String(g.sceneNumber);
                return (
                  <div
                    key={key}
                    ref={(el) => { sceneRefs.current[key] = el; }}
                    style={{ marginBottom: 24, scrollMarginTop: 80 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 12,
                        padding: '8px 12px',
                        background: 'linear-gradient(90deg, rgba(231,76,60,0.15) 0%, transparent 100%)',
                        borderLeft: '3px solid #e74c3c',
                        borderRadius: '0 6px 6px 0',
                      }}
                    >
                      <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>
                        {g.sceneNumber == null ? '📄 未指定场次' : `🎬 第${g.sceneNumber}场`}
                      </h3>
                      <span
                        style={{
                          fontSize: 12,
                          background: '#2a2a2a',
                          color: '#888',
                          padding: '2px 10px',
                          borderRadius: 10,
                        }}
                      >
                        {g.count} 条批注
                      </span>
                      {activeScene !== '__all__' && (
                        <button
                          onClick={() => {
                            setActiveScene('__all__');
                            const params = new URLSearchParams(searchParams);
                            params.delete('scene');
                            params.delete('annotationId');
                            setSearchParams(params, { replace: true });
                          }}
                          style={{
                            marginLeft: 'auto',
                            fontSize: 11,
                            padding: '3px 10px',
                            background: 'none',
                            border: '1px solid #555',
                            borderRadius: 4,
                            color: '#888',
                            cursor: 'pointer',
                          }}
                        >
                          显示全部场次
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {g.annotations.map(renderAnnotationCard)}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? spacing.md : 12 }}>
              {allAnnotationsFlat.length === 0 ? (
                <div style={{ marginTop: isMobile ? spacing.xl : 0 }}>
                  <EmptyState
                    icon={searchQuery || selectedTags.length > 0 ? '🔍' : '📝'}
                    title={searchQuery || selectedTags.length > 0 ? '未找到匹配的批注' : '暂无批注'}
                    description={searchQuery || selectedTags.length > 0 ? '尝试调整搜索关键词或筛选条件' : canEdit ? '点击右上角按钮创建第一个批注' : '等待管理员创建批注内容'}
                    primaryAction={
                      canEdit
                        ? {
                            label: searchQuery || selectedTags.length > 0 ? '清除筛选' : '创建批注',
                            onClick: searchQuery || selectedTags.length > 0
                              ? () => {
                                  setSearchQuery('');
                                  clearFilterTags();
                                }
                              : () => setShowForm(true),
                          }
                        : undefined
                    }
                  />
                </div>
              ) : (
                allAnnotationsFlat.map(renderAnnotationCard)
              )}
            </div>
          )}
        </div>
      </div>
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

const toggleBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  transition: 'all 0.2s',
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
