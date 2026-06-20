import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface CastRole {
  id: number;
  characterName: string;
  characterDescription: string;
  actorId: number | null;
  actorName?: string;
  actorOnLeave?: boolean;
  activeLeave?: any;
  substituteActorIds?: number[];
  substituteActors?: Array<{
    id: number;
    username: string;
    displayName?: string;
    isOnLeave: boolean;
  }>;
  availableSubstituteCount?: number;
  currentSubstitute?: any;
  sceneNumbers: number[];
  priority: number;
  tags?: any[];
}

interface TagInfo {
  id: number;
  name: string;
  color: string;
}

export default function RolesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [highlightedRoleId, setHighlightedRoleId] = useState<number | null>(null);

  const [roles, setRoles] = useState<CastRole[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    searchParams.get('tagIds') ? searchParams.get('tagIds')!.split(',').map(Number).filter(Boolean) : []
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    characterName: '',
    characterDescription: '',
    actorId: 0,
    priority: 0,
  });
  const [sortMode, setSortMode] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);
  const [roleRehearsals, setRoleRehearsals] = useState<Record<number, any[]>>({});
  const [loadingRehearsals, setLoadingRehearsals] = useState<Record<number, boolean>>({});
  const { isDirector, isAdmin } = useAuth();
  const canEdit = isDirector || isAdmin;

  const loadTags = async () => {
    try {
      const data = await api.tags.list({ category: 'role' });
      setAvailableTags(data);
    } catch {}
  };

  const loadRolesWithTags = async (roleList: CastRole[]) => {
    const rolesWithTags = await Promise.all(
      roleList.map(async (role) => {
        try {
          const tags = await api.tags.getTagsForTarget('role', role.id);
          return { ...role, tags };
        } catch {
          return role;
        }
      })
    );
    return rolesWithTags;
  };

  const load = async () => {
    const [rolesData, usersData] = await Promise.all([api.roles.list(), api.users.list()]);
    let filteredRoles = rolesData;

    if (selectedTagIds.length > 0) {
      try {
        const filterResult = await api.tags.filterByTags(selectedTagIds, 'role');
        const validIds = new Set(filterResult.targetIds);
        filteredRoles = rolesData.filter((r: any) => validIds.has(r.id));
      } catch {}
    }

    const rolesWithTags = await loadRolesWithTags(filteredRoles);
    setRoles(rolesWithTags);
    setUsers(usersData);
  };

  useEffect(() => { loadTags(); }, []);
  useEffect(() => { load(); }, [selectedTagIds]);

  const filteredRoles = useMemo(() => {
    if (!keyword.trim()) return roles;
    const kw = keyword.toLowerCase();
    return roles.filter((r) =>
      r.characterName.toLowerCase().includes(kw) ||
      (r.characterDescription && r.characterDescription.toLowerCase().includes(kw)) ||
      (r.actorName && r.actorName.toLowerCase().includes(kw)) ||
      (r.substituteActors && r.substituteActors.some((s) =>
        (s.displayName || s.username || '').toLowerCase().includes(kw)
      ))
    );
  }, [roles, keyword]);

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    const params = new URLSearchParams(searchParams);
    if (value.trim()) {
      params.set('q', value.trim());
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    const roleIdParam = searchParams.get('roleId');
    if (roleIdParam && roles.length > 0) {
      const id = Number(roleIdParam);
      const exists = roles.some((r) => r.id === id);
      if (exists) {
        setHighlightedRoleId(id);
        setTimeout(() => {
          const el = roleRefs.current[id];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        setTimeout(() => setHighlightedRoleId(null), 3000);
        const params = new URLSearchParams(searchParams);
        params.delete('roleId');
        setSearchParams(params, { replace: true });
      }
    }
  }, [searchParams, roles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.roles.create({
      ...form,
      actorId: form.actorId || null,
      sceneNumbers: [],
    });
    setForm({ characterName: '', characterDescription: '', actorId: 0, priority: 0 });
    setShowForm(false);
    load();
  };

  const handleAssign = async (roleId: number, actorId: number) => {
    await api.roles.update(roleId, { actorId: actorId || null });
    load();
  };

  const handleAddSubstitute = async (roleId: number, actorId: number) => {
    if (!actorId) return;
    await api.roles.addSubstitute(roleId, actorId);
    load();
  };

  const handleRemoveSubstitute = async (roleId: number, actorId: number) => {
    if (!confirm('确定要移除此替补演员吗？')) return;
    await api.roles.removeSubstitute(roleId, actorId);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个角色吗？')) return;
    await api.roles.remove(id);
    load();
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    setDraggedId(null);

    if (!draggedId || draggedId === targetId) return;

    const newRoles = [...roles];
    const draggedIndex = newRoles.findIndex((r) => r.id === draggedId);
    const targetIndex = newRoles.findIndex((r) => r.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = newRoles.splice(draggedIndex, 1);
    newRoles.splice(targetIndex, 0, draggedItem);

    const updatedRoles = newRoles.map((r, index) => ({ ...r, priority: index }));
    setRoles(updatedRoles);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleSaveSort = async () => {
    const updates = roles.map((r, index) => ({ id: r.id, priority: index }));
    try {
      const result = await api.roles.updatePriorities(updates);
      setRoles(result);
      setSortMode(false);
    } catch (err: any) {
      alert('保存排序失败: ' + err.message);
    }
  };

  const handleCancelSort = () => {
    load();
    setSortMode(false);
  };

  const toggleRehearsalsExpand = async (roleId: number) => {
    if (expandedRoleId === roleId) {
      setExpandedRoleId(null);
    } else {
      setExpandedRoleId(roleId);
      if (!roleRehearsals[roleId]) {
        setLoadingRehearsals((prev) => ({ ...prev, [roleId]: true }));
        try {
          const data = await api.roles.getRehearsals(roleId);
          setRoleRehearsals((prev) => ({ ...prev, [roleId]: data }));
        } catch (e) {
          console.error('加载角色排练失败', e);
        } finally {
          setLoadingRehearsals((prev) => ({ ...prev, [roleId]: false }));
        }
      }
    }
  };

  const getActorName = (actorId: number | null) => {
    if (!actorId) return '未分配';
    const u = users.find((u) => u.id === actorId);
    return u ? u.displayName || u.username : `#${actorId}`;
  };

  const getAvailableActorsForSubstitute = (role: CastRole) => {
    const existingIds = new Set<number>();
    if (role.actorId) existingIds.add(role.actorId);
    (role.substituteActors || []).forEach((s) => existingIds.add(s.id));
    return users.filter((u) => u.role === 'actor' && !existingIds.has(u.id));
  };

  const statusLabel = (role: CastRole) => {
    if (!role.actorId) {
      return { text: '未分配演员', color: '#888', bg: 'rgba(136, 136, 136, 0.1)' };
    }
    if (role.actorOnLeave) {
      if (role.currentSubstitute) {
        return { text: '请假中（有替补）', color: '#e67e22', bg: 'rgba(230, 126, 34, 0.1)' };
      }
      return { text: '请假中（无替补）', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)' };
    }
    return { text: '正常', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>角色分配</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && !sortMode && (
            <>
              <button onClick={() => setSortMode(true)} style={secondaryBtnStyle}>
                调整排序
              </button>
              <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
                {showForm ? '取消' : '+ 新角色'}
              </button>
            </>
          )}
          {sortMode && (
            <>
              <button onClick={handleCancelSort} style={secondaryBtnStyle}>
                取消
              </button>
              <button onClick={handleSaveSort} style={primaryBtnStyle}>
                保存排序
              </button>
            </>
          )}
        </div>
      </div>

      {!sortMode && (
        <div style={{
          background: '#1a1a1a',
          padding: 16,
          borderRadius: 8,
          border: '1px solid #333',
          marginBottom: 20,
        }}>
          <input
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="搜索角色名、演员、描述..."
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#e0e0e0',
              fontSize: 14,
              outline: 'none',
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          {availableTags.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                🏷️ 标签筛选 {selectedTagIds.length > 0 && <span style={{ color: '#3498db' }}>(已选 {selectedTagIds.length} 个)</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setSelectedTagIds((prev) =>
                          selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        );
                        const params = new URLSearchParams(searchParams);
                        const newIds = selected
                          ? selectedTagIds.filter((id) => id !== tag.id)
                          : [...selectedTagIds, tag.id];
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
                {selectedTagIds.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedTagIds([]);
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
                    清除筛选
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {sortMode && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 13,
          color: '#e74c3c',
        }}>
          💡 拖拽角色卡片调整优先级顺序，调整完成后点击"保存排序"
        </div>
      )}

      {showForm && canEdit && (
        <form onSubmit={handleCreate} style={formStyle}>
          <input placeholder="角色名" value={form.characterName} onChange={(e) => setForm({ ...form, characterName: e.target.value })} required style={inputStyle} />
          <textarea placeholder="角色描述" value={form.characterDescription} onChange={(e) => setForm({ ...form, characterDescription: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <select value={form.actorId} onChange={(e) => setForm({ ...form, actorId: Number(e.target.value) })} style={inputStyle}>
              <option value={0}>-- 分配演员 --</option>
              {users.filter((u) => u.role === 'actor').map((u) => (
                <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
              ))}
            </select>
            <input type="number" placeholder="优先级" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} style={inputStyle} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="submit" style={primaryBtnStyle}>创建</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {(sortMode ? roles : filteredRoles).map((r, index) => {
          const status = statusLabel(r);
          const availableActors = getAvailableActorsForSubstitute(r);
          const isDragging = draggedId === r.id;
          const isDragOver = dragOverId === r.id;
          const isHighlighted = highlightedRoleId === r.id;
          return (
            <div
              key={r.id}
              ref={(el) => { roleRefs.current[r.id] = el; }}
              draggable={sortMode}
              onDragStart={(e) => sortMode && handleDragStart(e, r.id)}
              onDragOver={(e) => sortMode && handleDragOver(e, r.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => sortMode && handleDrop(e, r.id)}
              onDragEnd={handleDragEnd}
              style={{
                ...cardStyle,
                opacity: isDragging ? 0.5 : 1,
                border: isDragOver ? '2px dashed #e74c3c' : cardStyle.border as string,
                cursor: sortMode ? 'move' : 'default',
                transform: isDragging ? 'rotate(2deg)' : 'none',
                transition: 'transform 0.2s, opacity 0.2s',
                ...(isHighlighted ? { borderColor: '#f39c12', boxShadow: '0 0 12px rgba(243,156,18,0.4)' } : {}),
                scrollMarginTop: 80,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sortMode && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      background: 'rgba(231, 76, 60, 0.2)',
                      color: '#e74c3c',
                      borderRadius: '50%',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {index + 1}
                    </span>
                  )}
                  <h3 style={{ margin: '0 0 8px', color: '#e74c3c', fontSize: 16 }}>{r.characterName}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  {sortMode && (
                    <span style={{
                    cursor: 'move',
                    color: '#888',
                    fontSize: 18,
                    lineHeight: 1,
                    padding: '2px 4px',
                    userSelect: 'none',
                  }}>
                    ⋮⋮
                  </span>
                  )}
                  {canEdit && !sortMode && (
                    <button onClick={() => handleDelete(r.id)} style={deleteBtnStyle}>删除</button>
                  )}
                </div>
              </div>
              {r.characterDescription && (
                <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>{r.characterDescription}</p>
              )}

              {r.tags && r.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                  {r.tags.map((tag: any) => (
                    <span key={tag.id} style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: `${tag.color}15`,
                      border: `1px solid ${tag.color}40`,
                      color: tag.color,
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: tag.color,
                      }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <span style={{
                  padding: '2px 8px',
                  background: status.bg,
                  border: `1px solid ${status.color}`,
                  color: status.color,
                  borderRadius: 10,
                  fontSize: 11,
                }}>
                  {status.text}
                </span>
              </div>

              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>
                扮演者: <strong style={{ color: '#e0e0e0' }}>{getActorName(r.actorId)}</strong>
              </div>

              {canEdit && (
                <select
                  value={r.actorId || 0}
                  onChange={(e) => handleAssign(r.id, Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={0}>-- 分配演员 --</option>
                  {users.filter((u) => u.role === 'actor').map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                  ))}
                </select>
              )}

              {(r.substituteActors && r.substituteActors.length > 0) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                    替补演员 ({r.availableSubstituteCount}人可用):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {r.substituteActors.map((s) => (
                      <span
                        key={s.id}
                        style={{
                          padding: '4px 10px',
                          background: s.isOnLeave ? 'rgba(231, 76, 60, 0.1)' : 'rgba(46, 204, 113, 0.1)',
                          border: `1px solid ${s.isOnLeave ? '#e74c3c' : '#2ecc71'}`,
                          color: s.isOnLeave ? '#e74c3c' : '#2ecc71',
                          borderRadius: 12,
                          fontSize: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {s.displayName || s.username}
                        {s.isOnLeave && ' (请假)'}
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSubstitute(r.id, s.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: 0,
                              marginLeft: 4,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {canEdit && availableActors.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <select
                    value={0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val) {
                        handleAddSubstitute(r.id, val);
                        e.target.value = '0';
                      }
                    }}
                    style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}
                  >
                    <option value={0}>+ 添加替补</option>
                    {availableActors.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                    ))}
                  </select>
                </div>
              )}

              {r.sceneNumbers && r.sceneNumbers.length > 0 && (
                <div style={{ fontSize: 12, color: '#555', marginTop: 12 }}>
                  场次: {r.sceneNumbers.join(', ')}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => toggleRehearsalsExpand(r.id)}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    background: 'rgba(52, 152, 219, 0.1)',
                    border: '1px solid rgba(52, 152, 219, 0.3)',
                    borderRadius: 6,
                    color: '#3498db',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {expandedRoleId === r.id ? '收起排练' : `查看参与排练 (${roleRehearsals[r.id]?.length || '?'})`}
                </button>
              </div>

              {expandedRoleId === r.id && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  background: 'rgba(52, 152, 219, 0.05)',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: 6,
                }}>
                  {loadingRehearsals[r.id] && (
                    <div style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: 8 }}>
                      加载中...
                    </div>
                  )}
                  {!loadingRehearsals[r.id] && roleRehearsals[r.id]?.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: 12, padding: 8 }}>
                      暂无参与的排练
                    </div>
                  )}
                  {!loadingRehearsals[r.id] && roleRehearsals[r.id]?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {roleRehearsals[r.id].slice(0, 5).map((rehearsal: any) => (
                        <div key={rehearsal.id} style={{
                          background: '#222',
                          padding: '8px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}>
                          <div style={{ color: '#e0e0e0', fontWeight: 500, marginBottom: 2 }}>
                            {rehearsal.title}
                            {rehearsal.isMainActor && (
                              <span style={{
                                marginLeft: 8,
                                padding: '1px 6px',
                                background: 'rgba(46, 204, 113, 0.2)',
                                border: '1px solid #2ecc71',
                                color: '#2ecc71',
                                borderRadius: 8,
                                fontSize: 10,
                              }}>
                                主演
                              </span>
                            )}
                            {rehearsal.isSubstitute && !rehearsal.isMainActor && (
                              <span style={{
                                marginLeft: 8,
                                padding: '1px 6px',
                                background: 'rgba(243, 156, 18, 0.2)',
                                border: '1px solid #f39c12',
                                color: '#f39c12',
                                borderRadius: 8,
                                fontSize: 10,
                              }}>
                                替补
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#888', fontSize: 11 }}>
                            {new Date(rehearsal.startTime).toLocaleString('zh-CN')}
                            {rehearsal.location && <span style={{ marginLeft: 8 }}>📍 {rehearsal.location}</span>}
                          </div>
                        </div>
                      ))}
                      {roleRehearsals[r.id].length > 5 && (
                        <div style={{ textAlign: 'center', color: '#666', fontSize: 11 }}>
                          还有 {roleRehearsals[r.id].length - 5} 个排练...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {r.activeLeave && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: 'rgba(230, 126, 34, 0.08)',
                  border: '1px solid rgba(230, 126, 34, 0.3)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#e67e22',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>请假信息</div>
                  <div>类型: {r.activeLeave.type === 'sick' ? '病假' : r.activeLeave.type === 'personal' ? '事假' : '其他'}</div>
                  <div>时间: {new Date(r.activeLeave.startDate).toLocaleDateString('zh-CN')} ~ {new Date(r.activeLeave.endDate).toLocaleDateString('zh-CN')}</div>
                  {r.activeLeave.reason && <div>原因: {r.activeLeave.reason}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(sortMode ? roles : filteredRoles).length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>
          {keyword && !sortMode ? '没有匹配的角色' : '暂无角色'}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
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
  fontSize: 14,
};

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #e74c3c',
  color: '#e74c3c',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
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
