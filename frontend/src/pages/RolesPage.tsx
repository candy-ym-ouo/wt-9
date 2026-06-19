import React, { useState, useEffect } from 'react';
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
}

export default function RolesPage() {
  const [roles, setRoles] = useState<CastRole[]>([]);
  const [users, setUsers] = useState<any[]>([]);
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
  const { isDirector, isAdmin } = useAuth();
  const canEdit = isDirector || isAdmin;

  const load = async () => {
    const [rolesData, usersData] = await Promise.all([api.roles.list(), api.users.list()]);
    setRoles(rolesData);
    setUsers(usersData);
  };

  useEffect(() => { load(); }, []);

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
        {roles.map((r, index) => {
          const status = statusLabel(r);
          const availableActors = getAvailableActorsForSubstitute(r);
          const isDragging = draggedId === r.id;
          const isDragOver = dragOverId === r.id;
          return (
            <div
              key={r.id}
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
      {roles.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无角色</div>}
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
