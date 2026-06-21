import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const DRAMA_ROLES: { value: string; label: string; desc: string }[] = [
  { value: 'owner', label: '所有者', desc: '完全控制，可管理所有权限' },
  { value: 'director', label: '导演', desc: '可管理成员、角色、排练' },
  { value: 'assistant_director', label: '副导演', desc: '协助管理角色、排练安排' },
  { value: 'actor', label: '演员', desc: '查看并参与自己的角色' },
  { value: 'crew', label: '剧务', desc: '管理素材、设备' },
  { value: 'viewer', label: '观察者', desc: '只读查看信息' },
];

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'planning', label: '筹备中', color: '#f39c12' },
  { value: 'active', label: '排演中', color: '#27ae60' },
  { value: 'archived', label: '已归档', color: '#7f8c8d' },
];

export default function DramasPage() {
  const [dramas, setDramas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrama, setSelectedDrama] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [applying, setApplying] = useState(false);
  const loadDramas = async () => {
    try {
      setLoading(true);
      setError(null);
      let result;
      if (searchQuery.trim()) {
        result = await api.dramas.search(searchQuery.trim());
      } else {
        result = await api.dramas.list(statusFilter || undefined);
      }
      setDramas(result);
    } catch (e: any) {
      setError(e.message || '加载剧目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const list = await api.users.list();
      setUsers(list);
    } catch {}
  };

  useEffect(() => {
    loadDramas();
    loadUsers();
  }, [statusFilter, searchQuery]);

  const handleSelectDrama = async (drama: any) => {
    setSelectedDrama(drama);
    try {
      const [perms, statsData] = await Promise.all([
        api.dramas.getPermissions(drama.id),
        api.dramas.getStats(drama.id),
      ]);
      setPermissions(perms);
      setStats(statsData);
    } catch {}
  };

  const canManage = (drama: any) => {
    const role = drama?.userRole;
    return role === 'owner' || role === 'director';
  };

  const canEdit = (drama: any) => {
    const role = drama?.userRole;
    return role === 'owner' || role === 'director' || role === 'assistant_director';
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: opt?.color + '22',
          color: opt?.color || '#888',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {opt?.label || status}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const opt = DRAMA_ROLES.find((r) => r.value === role);
    const colors: Record<string, string> = {
      owner: '#e74c3c',
      director: '#9b59b6',
      assistant_director: '#3498db',
      actor: '#1abc9c',
      crew: '#f39c12',
      viewer: '#95a5a6',
    };
    const color = colors[role] || '#888';
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: color + '22',
          color,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {opt?.label || role}
      </span>
    );
  };

  const handleCreateDrama = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value || undefined,
      synopsis: (form.elements.namedItem('synopsis') as HTMLTextAreaElement).value || undefined,
      venue: (form.elements.namedItem('venue') as HTMLInputElement).value || undefined,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value || 'planning',
      tags: (form.elements.namedItem('tags') as HTMLInputElement).value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      genres: (form.elements.namedItem('genres') as HTMLInputElement).value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      await api.dramas.create(data);
      setShowCreateModal(false);
      loadDramas();
    } catch (e: any) {
      alert(e.message || '创建失败');
    }
  };

  const handleUpdateStatus = async (dramaId: number, status: string) => {
    try {
      await api.dramas.update(dramaId, { status });
      loadDramas();
      if (selectedDrama?.id === dramaId) {
        setSelectedDrama({ ...selectedDrama, status });
      }
    } catch (e: any) {
      alert(e.message || '更新失败');
    }
  };

  const handleDeleteDrama = async (drama: any) => {
    if (!confirm(`确定要删除剧目「${drama.title}」吗？此操作不可撤销。`)) return;
    try {
      await api.dramas.remove(drama.id);
      setSelectedDrama(null);
      loadDramas();
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const handleGrantPermission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const userId = Number((form.elements.namedItem('userId') as HTMLSelectElement).value);
    const role = (form.elements.namedItem('role') as HTMLSelectElement).value;
    if (!userId || !role || !selectedDrama) return;
    try {
      await api.dramas.grantPermission(selectedDrama.id, userId, role);
      const perms = await api.dramas.getPermissions(selectedDrama.id);
      setPermissions(perms);
      form.reset();
    } catch (e: any) {
      alert(e.message || '添加成员失败');
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await api.dramas.updatePermission(selectedDrama.id, userId, role);
      const perms = await api.dramas.getPermissions(selectedDrama.id);
      setPermissions(perms);
    } catch (e: any) {
      alert(e.message || '更新权限失败');
    }
  };

  const handleRevokePermission = async (userId: number, username: string) => {
    if (!confirm(`确定要撤销「${username}」的剧目权限吗？`)) return;
    try {
      await api.dramas.revokePermission(selectedDrama.id, userId);
      const perms = await api.dramas.getPermissions(selectedDrama.id);
      setPermissions(perms);
    } catch (e: any) {
      alert(e.message || '撤销权限失败');
    }
  };

  const handleOpenTemplateModal = async () => {
    try {
      const list = await api.permissionTemplates.list({ targetScope: 'drama' });
      setTemplates(list);
      setSelectedTemplateId(null);
      setSelectedUserIds(permissions.filter((p) => p.role !== 'owner').map((p) => p.userId));
      setShowTemplateModal(true);
    } catch (e: any) {
      alert(e.message || '加载权限模板失败');
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId || !selectedDrama || selectedUserIds.length === 0) return;
    setApplying(true);
    try {
      await api.permissionTemplates.applyToDrama(selectedTemplateId, selectedDrama.id, selectedUserIds);
      const perms = await api.dramas.getPermissions(selectedDrama.id);
      setPermissions(perms);
      setShowTemplateModal(false);
    } catch (e: any) {
      alert(e.message || '套用权限模板失败');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#e74c3c' }}>🎬 剧目管理</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: '#e74c3c',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + 新建剧目
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="搜索剧目名称、描述..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: '#1a1a1a',
            border: '1px solid #333',
            padding: '8px 12px',
            borderRadius: 4,
            color: '#e0e0e0',
            fontSize: 13,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            padding: '8px 12px',
            borderRadius: 4,
            color: '#e0e0e0',
            fontSize: 13,
          }}
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>加载中...</div>}
      {error && <div style={{ color: '#e74c3c', padding: 12, background: '#2a1515', borderRadius: 4 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: selectedDrama ? '320px 1fr' : '1fr', gap: 20 }}>
        <div>
          {dramas.length === 0 && !loading ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#888',
                background: '#1a1a1a',
                borderRadius: 8,
                border: '1px dashed #333',
              }}
            >
              {searchQuery || statusFilter ? '没有匹配的剧目' : '暂无剧目，点击「新建剧目」开始创建'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dramas.map((drama) => (
                <div
                  key={drama.id}
                  onClick={() => handleSelectDrama(drama)}
                  style={{
                    padding: 16,
                    background: selectedDrama?.id === drama.id ? '#2a1515' : '#1a1a1a',
                    border: selectedDrama?.id === drama.id ? '1px solid #e74c3c' : '1px solid #2a2a2a',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: '#e0e0e0', flex: 1 }}>{drama.title}</h3>
                    {getStatusBadge(drama.status)}
                  </div>
                  {drama.description && (
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                      {drama.description.length > 60 ? drama.description.slice(0, 60) + '...' : drama.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <span style={{ color: '#666' }}>
                      {new Date(drama.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                    {getRoleBadge(drama.userRole)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedDrama && (
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: 20,
              alignSelf: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 8px', color: '#e0e0e0' }}>{selectedDrama.title}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {getStatusBadge(selectedDrama.status)}
                  {getRoleBadge(selectedDrama.userRole)}
                </div>
              </div>
              {canEdit(selectedDrama) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedDrama.status}
                    onChange={(e) => handleUpdateStatus(selectedDrama.id, e.target.value)}
                    style={{
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      padding: '4px 8px',
                      borderRadius: 4,
                      color: '#e0e0e0',
                      fontSize: 12,
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  {canManage(selectedDrama) && (
                    <button
                      onClick={() => handleDeleteDrama(selectedDrama)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #e74c3c55',
                        color: '#e74c3c',
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      删除
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedDrama.synopsis && (
              <div style={{ marginBottom: 16, padding: 12, background: '#0d0d0d', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>剧情简介</div>
                <div style={{ fontSize: 13, color: '#bbb', lineHeight: 1.6 }}>{selectedDrama.synopsis}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: '角色', value: stats.roles || 0, icon: '🎭' },
                { label: '排练', value: stats.rehearsals || 0, icon: '📅' },
                { label: '素材', value: stats.materials || 0, icon: '📁' },
                { label: '批注', value: stats.annotations || 0, icon: '📝' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: 12,
                    background: '#0d0d0d',
                    borderRadius: 4,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#e74c3c' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#e0e0e0' }}>👥 成员与权限</h3>
                {canManage(selectedDrama) && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleOpenTemplateModal}
                      style={{
                        background: 'transparent',
                        border: '1px solid #3498db55',
                        color: '#3498db',
                        padding: '4px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      📋 套用模板
                    </button>
                    <button
                      onClick={() => setShowMemberModal(true)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #e74c3c55',
                        color: '#e74c3c',
                        padding: '4px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      + 添加成员
                    </button>
                  </div>
                )}
              </div>

              {permissions.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>暂无成员</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {permissions.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 10,
                        background: '#0d0d0d',
                        borderRadius: 4,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>
                          {p.user?.displayName || p.user?.username || `用户 #${p.userId}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#666' }}>@{p.user?.username}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {canManage(selectedDrama) ? (
                          <select
                            value={p.role}
                            onChange={(e) => handleUpdateRole(p.userId, e.target.value)}
                            style={{
                              background: '#2a2a2a',
                              border: '1px solid #444',
                              padding: '4px 8px',
                              borderRadius: 4,
                              color: '#e0e0e0',
                              fontSize: 11,
                            }}
                          >
                            {DRAMA_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          getRoleBadge(p.role)
                        )}
                        {canManage(selectedDrama) && p.role !== 'owner' && (
                          <button
                            onClick={() =>
                              handleRevokePermission(
                                p.userId,
                                p.user?.displayName || p.user?.username || `#${p.userId}`,
                              )
                            }
                            title="撤销权限"
                            style={{
                              background: 'transparent',
                              border: '1px solid #555',
                              color: '#888',
                              padding: '2px 6px',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, color: '#666' }}>
                {selectedDrama.venue && <span>📍 场地：{selectedDrama.venue}</span>}
                {selectedDrama.premiereDate && <span>🎪 首演：{new Date(selectedDrama.premiereDate).toLocaleDateString('zh-CN')}</span>}
                {selectedDrama.genres?.length > 0 && <span>🏷️ 类型：{selectedDrama.genres.join(' / ')}</span>}
                {selectedDrama.tags?.length > 0 && <span>🔖 标签：{selectedDrama.tags.join('、')}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 24,
              width: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#e74c3c' }}>🎬 新建剧目</h3>
            <form onSubmit={handleCreateDrama} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>剧目名称 *</label>
                <input
                  name="title"
                  required
                  placeholder="例如：雷雨、茶馆..."
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>状态</label>
                <select
                  name="status"
                  defaultValue="planning"
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>简介</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="一句话介绍剧目..."
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>剧情简介</label>
                <textarea
                  name="synopsis"
                  rows={3}
                  placeholder="详细剧情描述..."
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>演出场地</label>
                  <input
                    name="venue"
                    placeholder="例如：实验剧场"
                    style={{
                      width: '100%',
                      background: '#0d0d0d',
                      border: '1px solid #333',
                      padding: '8px 12px',
                      borderRadius: 4,
                      color: '#e0e0e0',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>类型（逗号分隔）</label>
                  <input
                    name="genres"
                    placeholder="悲剧, 现代, 现实主义"
                    style={{
                      width: '100%',
                      background: '#0d0d0d',
                      border: '1px solid #333',
                      padding: '8px 12px',
                      borderRadius: 4,
                      color: '#e0e0e0',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>标签（逗号分隔）</label>
                <input
                  name="tags"
                  placeholder="经典, 必看, 获奖"
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #444',
                    color: '#aaa',
                    padding: '8px 16px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#e74c3c',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMemberModal && selectedDrama && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 24,
              width: 440,
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#e74c3c' }}>👥 添加剧目成员</h3>
            <form onSubmit={handleGrantPermission} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>选择用户 *</label>
                <select
                  name="userId"
                  required
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">-- 请选择用户 --</option>
                  {users
                    .filter((u) => !permissions.some((p) => p.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.username} (@{u.username})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>剧目角色 *</label>
                <select
                  name="role"
                  defaultValue="viewer"
                  required
                  style={{
                    width: '100%',
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                >
                  {DRAMA_ROLES.map((r) => (
                    <option key={r.value} value={r.value} disabled={r.value === 'owner'}>
                      {r.label} - {r.desc}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #444',
                    color: '#aaa',
                    padding: '8px 16px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#e74c3c',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplateModal && selectedDrama && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 24,
              width: 560,
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#3498db' }}>📋 套用权限模板</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>
              为剧目「{selectedDrama.title}」的成员批量套用权限模板，仅更新菜单与操作权限，不会修改成员角色。
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>选择权限模板</label>
              {templates.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 12, background: '#0d0d0d', borderRadius: 4 }}>
                  暂无可用模板
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      style={{
                        padding: 12,
                        background: selectedTemplateId === t.id ? '#1a2a3a' : '#0d0d0d',
                        border: selectedTemplateId === t.id ? '1px solid #3498db' : '1px solid #2a2a2a',
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{t.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#333', color: '#aaa' }}>
                          {t.dramaRole === 'admin' ? '管理员' : t.dramaRole === 'director' ? '导演' : t.dramaRole === 'assistant_director' ? '副导演' : t.dramaRole === 'actor' ? '演员' : t.dramaRole === 'crew' ? '剧组' : '观众'}
                        </span>
                      </div>
                      {t.description && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t.description}</div>}
                      {selectedTemplateId === t.id && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {t.menus?.map((m: string) => (
                            <span key={m} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#2a1515', color: '#e74c3c', border: '1px solid #3a2020' }}>{m}</span>
                          ))}
                          {t.operations?.map((op: string) => (
                            <span key={op} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#1a2a3a', color: '#3498db', border: '1px solid #2a3a5a' }}>{op}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>
                套用至成员（已选 {selectedUserIds.length} 人）
              </label>
              {permissions.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 12, background: '#0d0d0d', borderRadius: 4 }}>
                  暂无成员可选
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {permissions.map((p) => (
                    <label
                      key={p.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: '#0d0d0d',
                        borderRadius: 4,
                        cursor: p.role === 'owner' ? 'not-allowed' : 'pointer',
                        opacity: p.role === 'owner' ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(p.userId)}
                        disabled={p.role === 'owner'}
                        onChange={(e) => {
                          if (p.role === 'owner') return;
                          setSelectedUserIds((prev) =>
                            e.target.checked ? [...prev, p.userId] : prev.filter((id) => id !== p.userId),
                          );
                        }}
                      />
                      <span style={{ fontSize: 12, color: '#e0e0e0' }}>
                        {p.user?.displayName || p.user?.username || `用户 #${p.userId}`}
                      </span>
                      <span style={{ fontSize: 10, color: '#666', marginLeft: 'auto' }}>
                        {DRAMA_ROLES.find((r) => r.value === p.role)?.label || p.role}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTemplateModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #444',
                  color: '#aaa',
                  padding: '8px 16px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                取消
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId || selectedUserIds.length === 0 || applying}
                style={{
                  background: selectedTemplateId && selectedUserIds.length > 0 && !applying ? '#3498db' : '#333',
                  border: 'none',
                  color: selectedTemplateId && selectedUserIds.length > 0 && !applying ? '#fff' : '#666',
                  padding: '8px 20px',
                  borderRadius: 4,
                  cursor: selectedTemplateId && selectedUserIds.length > 0 && !applying ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {applying ? '套用中...' : '确认套用'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
