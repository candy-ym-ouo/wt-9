import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Tag {
  id: number;
  name: string;
  color: string;
  categories: string[];
  dramaId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

interface TagStatistics {
  totalTags: number;
  totalRelations: number;
  byCategory: Record<string, number>;
  byTargetType: Record<string, number>;
  topTags: Tag[];
}

const CATEGORY_LABELS: Record<string, string> = {
  role: '角色',
  material: '素材',
  annotation: '批注',
  rehearsal: '排练',
  general: '通用',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  role: '角色',
  material: '素材',
  annotation: '批注',
  rehearsal: '排练',
};

const PRESET_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff9800', '#795548',
];

export default function TagsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDirector, isAdmin } = useAuth();
  const canEdit = isDirector || isAdmin;

  const [tags, setTags] = useState<Tag[]>([]);
  const [statistics, setStatistics] = useState<TagStatistics | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(searchParams.get('category') || 'all');
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [form, setForm] = useState({
    name: '',
    color: PRESET_COLORS[0],
    categories: ['general'] as string[],
  });
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [tagTargets, setTagTargets] = useState<Record<string, any[]>>({});
  const [loadingTargets, setLoadingTargets] = useState(false);

  const loadTags = async () => {
    try {
      const data = await api.tags.list();
      setTags(data);
    } catch (e) {
      console.error('加载标签失败', e);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await api.tags.getStatistics();
      setStatistics(data);
    } catch (e) {
      console.error('加载统计失败', e);
    }
  };

  useEffect(() => {
    loadTags();
    loadStatistics();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeCategory !== 'all') {
      params.set('category', activeCategory);
    } else {
      params.delete('category');
    }
    if (keyword.trim()) {
      params.set('q', keyword.trim());
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  }, [activeCategory, keyword]);

  const filteredTags = useMemo(() => {
    let result = tags;
    if (activeCategory !== 'all') {
      result = result.filter((t) => (t.categories || []).includes(activeCategory));
    }
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(kw));
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tags, activeCategory, keyword]);

  const handleTagClick = async (tag: Tag) => {
    if (selectedTagId === tag.id) {
      setSelectedTagId(null);
      return;
    }
    setSelectedTagId(tag.id);
    setLoadingTargets(true);
    try {
      const [roles, materials, annotations, rehearsals] = await Promise.all([
        api.tags.getTargetsForTag(tag.id, 'role').catch(() => []),
        api.tags.getTargetsForTag(tag.id, 'material').catch(() => []),
        api.tags.getTargetsForTag(tag.id, 'annotation').catch(() => []),
        api.tags.getTargetsForTag(tag.id, 'rehearsal').catch(() => []),
      ]);
      setTagTargets({ role: roles, material: materials, annotation: annotations, rehearsal: rehearsals });
    } catch (e) {
      console.error('加载标签目标失败', e);
    } finally {
      setLoadingTargets(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.tags.create({
        name: form.name.trim(),
        color: form.color,
        categories: form.categories,
      });
      setForm({ name: '', color: PRESET_COLORS[0], categories: ['general'] });
      setShowForm(false);
      loadTags();
      loadStatistics();
    } catch (err: any) {
      alert('创建标签失败: ' + err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag || !form.name.trim()) return;
    try {
      await api.tags.update(editingTag.id, {
        name: form.name.trim(),
        color: form.color,
        categories: form.categories,
      });
      setEditingTag(null);
      loadTags();
      loadStatistics();
    } catch (err: any) {
      alert('更新标签失败: ' + err.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除标签「${name}」吗？删除后所有关联也将解除。`)) return;
    try {
      await api.tags.remove(id);
      if (selectedTagId === id) setSelectedTagId(null);
      loadTags();
      loadStatistics();
    } catch (err: any) {
      alert('删除标签失败: ' + err.message);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setForm({
      name: tag.name,
      color: tag.color || PRESET_COLORS[0],
      categories: tag.categories?.length > 0 ? [...tag.categories] : ['general'],
    });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setForm({ name: '', color: PRESET_COLORS[0], categories: ['general'] });
  };

  const toggleCategory = (cat: string) => {
    setForm((prev) => {
      const cats = prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: cats.length > 0 ? cats : ['general'] };
    });
  };

  const navigateToModule = (targetType: string, targetId: number) => {
    switch (targetType) {
      case 'role':
        navigate(`/roles?roleId=${targetId}`);
        break;
      case 'material':
        navigate(`/materials?materialId=${targetId}`);
        break;
      case 'annotation':
        navigate(`/annotations`);
        break;
      case 'rehearsal':
        navigate(`/calendar`);
        break;
    }
  };

  const StatCard = ({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) => (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: 8,
      padding: 16,
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>🏷️ 标签中心</h2>
        {canEdit && !editingTag && (
          <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
            {showForm ? '取消' : '+ 新建标签'}
          </button>
        )}
        {editingTag && (
          <button onClick={cancelEdit} style={secondaryBtnStyle}>
            取消编辑
          </button>
        )}
      </div>

      {statistics && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <StatCard label="标签总数" value={statistics.totalTags} icon="🏷️" color="#e74c3c" />
          <StatCard label="总关联数" value={statistics.totalRelations} icon="🔗" color="#3498db" />
          <StatCard
            label="角色标签"
            value={statistics.byCategory.role || 0}
            icon="🎭"
            color="#9b59b6"
          />
          <StatCard
            label="素材标签"
            value={statistics.byCategory.material || 0}
            icon="📁"
            color="#2ecc71"
          />
          <StatCard
            label="批注标签"
            value={statistics.byCategory.annotation || 0}
            icon="📝"
            color="#e67e22"
          />
          <StatCard
            label="排练标签"
            value={statistics.byCategory.rehearsal || 0}
            icon="📅"
            color="#1abc9c"
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div>
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>分类筛选</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['all', 'role', 'material', 'annotation', 'rehearsal', 'general'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: activeCategory === cat ? 'rgba(231, 76, 60, 0.15)' : 'transparent',
                    color: activeCategory === cat ? '#e74c3c' : '#aaa',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {cat === 'all' ? '📋 全部标签' : `${CATEGORY_LABELS[cat] || cat} 标签`}
                  <span style={{ float: 'right', opacity: 0.7 }}>
                    {cat === 'all' ? tags.length : (statistics?.byCategory?.[cat] || 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            padding: 16,
          }}>
            <input
              placeholder="搜索标签..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
            />
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {filteredTags.length === 0 && (
                <div style={{ textAlign: 'center', color: '#555', padding: '20px 0', fontSize: 13 }}>
                  暂无标签
                </div>
              )}
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => handleTagClick(tag)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedTagId === tag.id ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
                    border: selectedTagId === tag.id ? '1px solid rgba(52, 152, 219, 0.3)' : '1px solid transparent',
                    marginBottom: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: tag.color || '#888',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tag.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#666' }}>
                    {(statistics?.topTags?.find((t) => t.id === tag.id)?.usageCount) || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {(showForm || editingTag) && canEdit && (
            <form onSubmit={editingTag ? handleUpdate : handleCreate} style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 20,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 600, marginBottom: 14 }}>
                {editingTag ? '编辑标签' : '新建标签'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>标签名称</label>
                  <input
                    placeholder="输入标签名"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>标签颜色</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm({ ...form, color })}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: color,
                          border: form.color === color ? '2px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>适用分类（可多选）</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          border: `1px solid ${form.categories.includes(cat) ? '#e74c3c' : '#444'}`,
                          background: form.categories.includes(cat) ? 'rgba(231, 76, 60, 0.15)' : '#222',
                          color: form.categories.includes(cat) ? '#e74c3c' : '#aaa',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                  <button type="submit" style={primaryBtnStyle}>
                    {editingTag ? '保存修改' : '创建标签'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {selectedTagId ? (
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 20,
            }}>
              {loadingTargets ? (
                <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>加载中...</div>
              ) : (
                <>
                  {(() => {
                    const tag = tags.find((t) => t.id === selectedTagId);
                    if (!tag) return null;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: tag.color || '#888',
                            }} />
                            <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 18 }}>{tag.name}</h3>
                          </div>
                          {canEdit && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => startEdit(tag)} style={secondaryBtnStyle}>
                                编辑
                              </button>
                              <button onClick={() => handleDelete(tag.id, tag.name)} style={{
                                ...secondaryBtnStyle,
                                borderColor: '#e74c3c',
                                color: '#e74c3c',
                              }}>
                                删除
                              </button>
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>分类</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(tag.categories || []).map((cat) => (
                              <span key={cat} style={{
                                padding: '3px 10px',
                                borderRadius: 10,
                                background: 'rgba(231, 76, 60, 0.1)',
                                border: '1px solid rgba(231, 76, 60, 0.3)',
                                color: '#e74c3c',
                                fontSize: 11,
                              }}>
                                {CATEGORY_LABELS[cat] || cat}
                              </span>
                            ))}
                          </div>
                        </div>

                        {Object.entries(tagTargets).map(([targetType, targets]) => (
                          <div key={targetType} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                              {TARGET_TYPE_LABELS[targetType] || targetType} ({targets.length})
                            </div>
                            {targets.length === 0 ? (
                              <div style={{ fontSize: 12, color: '#555', paddingLeft: 8 }}>暂无关联</div>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {targets.slice(0, 20).map((t: any) => (
                                  <button
                                    key={t.id || t.targetId}
                                    onClick={() => navigateToModule(targetType, t.targetId || t.id)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 12,
                                      background: '#222',
                                      border: '1px solid #444',
                                      color: '#aaa',
                                      fontSize: 12,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    #{t.targetId || t.id}
                                  </button>
                                ))}
                                {targets.length > 20 && (
                                  <span style={{
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    color: '#666',
                                  }}>
                                    +{targets.length - 20} 更多
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          ) : (
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 48,
              textAlign: 'center',
              color: '#555',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
              <div style={{ fontSize: 14 }}>选择左侧标签查看详情</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                标签可用于角色、素材、批注、排练的分类与筛选
              </div>
            </div>
          )}

          {statistics?.topTags && statistics.topTags.length > 0 && (
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 20,
              marginTop: 16,
            }}>
              <div style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 600, marginBottom: 12 }}>
                🔥 高频标签 Top 20
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {statistics.topTags.map((tag) => (
                  <span
                    key={tag.id}
                    onClick={() => {
                      setSelectedTagId(tag.id);
                      handleTagClick(tag);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 14,
                      background: 'rgba(52, 152, 219, 0.08)',
                      border: '1px solid rgba(52, 152, 219, 0.3)',
                      color: '#3498db',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: tag.color || '#3498db',
                    }} />
                    {tag.name}
                    <span style={{ fontSize: 11, opacity: 0.7 }}>({tag.usageCount || 0})</span>
                  </span>
                ))}
              </div>
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
  background: 'transparent',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 13,
};
