import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Rehearsal {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  participantIds: number[];
  hasConflict?: boolean;
  timeConflicts?: Rehearsal[];
  participantConflicts?: Array<{
    userId: number;
    userName?: string;
    conflictingRehearsals: Rehearsal[];
  }>;
  participants?: Array<{
    userId: number;
    userName?: string;
    displayName?: string;
    isOnLeave: boolean;
    leaveReason?: string;
    substituteId?: number;
    substituteName?: string;
    roleId?: number;
    roleName?: string;
  }>;
  onLeaveCount?: number;
  withSubstituteCount?: number;
  effectiveParticipants?: number[];
}

interface User {
  id: number;
  username: string;
  role: string;
  displayName?: string;
}

interface ConflictInfo {
  hasConflict: boolean;
  timeConflicts: Rehearsal[];
  participantConflicts: Array<{
    userId: number;
    userName?: string;
    conflictingRehearsals: Rehearsal[];
  }>;
}

const emptyForm = {
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  location: '',
  participantIds: [] as number[],
};

function formatLocalInput(d: string | Date): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface Filters {
  location: string;
  participantId: number | null;
  timeSlotStart: string;
  timeSlotEnd: string;
}

const emptyFilters: Filters = {
  location: '',
  participantId: null,
  timeSlotStart: '',
  timeSlotEnd: '',
};

export default function CalendarPage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const { user, isDirector, isAdmin } = useAuth();

  const load = async () => {
    const params: Parameters<typeof api.rehearsals.list>[0] = {};
    if (filters.location) params.location = filters.location;
    if (filters.participantId) params.participantId = filters.participantId;
    if (filters.timeSlotStart && filters.timeSlotEnd) {
      params.timeSlot = `${filters.timeSlotStart}-${filters.timeSlotEnd}`;
    }
    const data = await api.rehearsals.list(params);
    setRehearsals(data);
  };

  const hasActiveFilters =
    filters.location || filters.participantId || (filters.timeSlotStart && filters.timeSlotEnd);

  const resetFilters = () => {
    setFilters(emptyFilters);
  };

  const loadUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (e) {
      console.error('加载用户列表失败', e);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
  }, []);

  useEffect(() => {
    load();
  }, [filters]);

  useEffect(() => {
    if (!showForm || !form.startTime || !form.endTime) {
      setConflictInfo(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setCheckingConflict(true);
        const info = await api.rehearsals.checkConflicts({
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
          participantIds: form.participantIds,
          excludeId: editingId ?? undefined,
        });
        setConflictInfo(info);
      } catch (e) {
        setConflictInfo(null);
      } finally {
        setCheckingConflict(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.startTime, form.endTime, form.participantIds, showForm, editingId]);

  const startEdit = (r: Rehearsal) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      description: r.description || '',
      startTime: formatLocalInput(r.startTime),
      endTime: formatLocalInput(r.endTime),
      location: r.location || '',
      participantIds: r.participantIds || [],
    });
    setShowForm(true);
    setError(null);
    setConflictInfo(null);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError(null);
    setConflictInfo(null);
  };

  const toggleParticipant = (userId: number) => {
    setForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(userId)
        ? prev.participantIds.filter((id) => id !== userId)
        : [...prev.participantIds, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      };
      if (editingId) {
        await api.rehearsals.update(editingId, payload);
      } else {
        await api.rehearsals.create(payload);
      }
      resetForm();
      load();
    } catch (e: any) {
      setError(e.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个排练吗？')) return;
    await api.rehearsals.remove(id);
    load();
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');

  const colorPool = ['#e74c3c', '#e67e22', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];

  const getUserName = (id: number) => {
    const u = users.find((x) => x.id === id);
    return u?.displayName || u?.username || `用户#${id}`;
  };

  const canEdit = isDirector || isAdmin;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, color: '#e0e0e0' }}>排练日历</h2>
          {!canEdit && (
            <span style={{
              padding: '4px 10px',
              background: 'rgba(155, 89, 182, 0.2)',
              border: '1px solid #9b59b6',
              color: '#9b59b6',
              borderRadius: 12,
              fontSize: 12,
            }}>
              🔒 仅导演和管理员可编辑
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 16px',
              background: showFilters ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
              border: '1px solid #3498db',
              borderRadius: 6,
              color: '#3498db',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            🔍 筛选 {hasActiveFilters && <span style={{ marginLeft: 6, color: '#e74c3c' }}>●</span>}
          </button>
          {canEdit && (
            <button
              onClick={() => showForm ? resetForm() : setShowForm(true)}
              style={{
                padding: '8px 16px',
                background: '#e74c3c',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {showForm ? '取消' : '+ 新排练'}
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div style={{
          background: '#1a1a1a',
          padding: 16,
          borderRadius: 8,
          border: '1px solid #333',
          marginBottom: 24,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>📍 地点</div>
              <input
                placeholder="输入地点关键词"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>👤 演员</div>
              <select
                value={filters.participantId ?? ''}
                onChange={(e) => setFilters({ ...filters, participantId: e.target.value ? Number(e.target.value) : null })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">全部演员</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>⏰ 时间段开始</div>
              <input
                type="time"
                value={filters.timeSlotStart}
                onChange={(e) => setFilters({ ...filters, timeSlotStart: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>⏰ 时间段结束</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="time"
                  value={filters.timeSlotEnd}
                  onChange={(e) => setFilters({ ...filters, timeSlotEnd: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid #666',
                      borderRadius: 6,
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    重置
                  </button>
                )}
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #333', color: '#666', fontSize: 13 }}>
              当前筛选结果：<span style={{ color: '#3498db' }}>{rehearsals.length}</span> 条排练
            </div>
          )}
        </div>
      )}

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} style={{
          background: '#1a1a1a',
          padding: 20,
          borderRadius: 8,
          border: '1px solid #333',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          <h3 style={{ gridColumn: '1 / -1', margin: '0 0 8px', color: '#e0e0e0', fontSize: 16 }}>
            {editingId ? '✏️ 编辑排练' : '➕ 创建新排练'}
          </h3>

          <input placeholder="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} />
          <input placeholder="地点" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={inputStyle} />
          <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required style={inputStyle} />
          <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required style={inputStyle} />
          <textarea placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1', minHeight: 60 }} />

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 6 }}>👥 参与人（可选）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {users.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: form.participantIds.includes(u.id) ? 'rgba(231, 76, 60, 0.2)' : '#222',
                    border: `1px solid ${form.participantIds.includes(u.id) ? '#e74c3c' : '#444'}`,
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#e0e0e0',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.participantIds.includes(u.id)}
                    onChange={() => toggleParticipant(u.id)}
                    style={{ accentColor: '#e74c3c' }}
                  />
                  {u.displayName || u.username}
                  <span style={{ color: '#666', fontSize: 11 }}>({u.role})</span>
                </label>
              ))}
            </div>
          </div>

          {checkingConflict && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'rgba(52, 152, 219, 0.1)', border: '1px solid #3498db', borderRadius: 6, color: '#3498db', fontSize: 13 }}>
              ⏳ 正在检查时间和参与人冲突...
            </div>
          )}

          {!checkingConflict && conflictInfo && conflictInfo.hasConflict && (
            <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: 6 }}>
              <div style={{ color: '#e74c3c', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>⚠️ 检测到冲突：</div>
              {conflictInfo.timeConflicts.length > 0 && (
                <div style={{ color: '#e0e0e0', fontSize: 13, marginBottom: 6 }}>
                  📅 时间冲突（{conflictInfo.timeConflicts.length}个）：
                  {conflictInfo.timeConflicts.map((r) => `「${r.title}」(${formatDate(r.startTime)})`).join('、')}
                </div>
              )}
              {conflictInfo.participantConflicts.length > 0 && (
                <div style={{ color: '#e0e0e0', fontSize: 13 }}>
                  👥 参与人占用：
                  {conflictInfo.participantConflicts.map((p) => (
                    <span key={p.userId} style={{ marginRight: 12 }}>
                      {p.userName || '用户#' + p.userId} 在 {p.conflictingRehearsals.map((r) => `「${r.title}」`).join('、')} 已安排
                    </span>
                  ))}
                </div>
              )}
              <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>提示：您仍可提交，但可能会造成日程冲突。</div>
            </div>
          )}

          {!checkingConflict && conflictInfo && !conflictInfo.hasConflict && form.startTime && form.endTime && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', borderRadius: 6, color: '#2ecc71', fontSize: 13 }}>
              ✅ 无时间冲突，参与人都空闲
            </div>
          )}

          {error && (
            <div style={{ gridColumn: '1 / -1', padding: '10px 12px', background: 'rgba(231, 76, 60, 0.2)', border: '1px solid #e74c3c', borderRadius: 6, color: '#e74c3c', fontSize: 13 }}>
              ❌ {error}
            </div>
          )}

          <div style={{ gridColumn: '1 / -1', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={resetForm}
              style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #555', borderRadius: 6, color: '#aaa', cursor: 'pointer' }}
            >
              取消
            </button>
            <button type="submit" style={{ padding: '8px 24px', background: '#e74c3c', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
              {editingId ? '保存修改' : '创建排练'}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rehearsals.map((r, idx) => (
          <div key={r.id} style={{
            background: '#1a1a1a',
            borderRadius: 8,
            border: '1px solid #333',
            borderLeft: `4px solid ${colorPool[idx % colorPool.length]}`,
            padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>{r.title}</h3>
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
                <div style={{ fontSize: 13, color: '#888' }}>
                  {formatDate(r.startTime)} → {formatDate(r.endTime)}
                  {r.location && <span style={{ marginLeft: 16 }}>📍 {r.location}</span>}
                </div>
                {r.participantIds && r.participantIds.length > 0 && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    👥 {r.participantIds.map((id) => getUserName(id)).join('、')}
                  </div>
                )}

                {r.participants && r.participants.length > 0 && r.onLeaveCount && r.onLeaveCount > 0 && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'rgba(230, 126, 34, 0.08)',
                    border: '1px solid rgba(230, 126, 34, 0.3)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}>
                    <div style={{ color: '#e67e22', fontWeight: 600, marginBottom: 6 }}>
                      请假: {r.onLeaveCount}人 | 替补: {r.withSubstituteCount}人
                    </div>
                    {r.participants.filter((p) => p.isOnLeave).map((p) => (
                      <div key={p.userId} style={{ color: '#aaa', marginTop: 2 }}>
                        • {p.displayName || p.userName} ({p.roleName || '演员'})
                        {p.substituteName ? ` → 替补: ${p.substituteName}` : ' (无替补)'}
                      </div>
                    ))}
                  </div>
                )}
                {r.description && <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0' }}>{r.description}</p>}
                {r.hasConflict && r.participantConflicts && r.participantConflicts.length > 0 && (
                  <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8, padding: '6px 10px', background: 'rgba(231, 76, 60, 0.08)', borderRadius: 4 }}>
                    冲突详情：{r.participantConflicts.map((p) => `${p.userName || '用户#' + p.userId}在${p.conflictingRehearsals.map((x) => x.title).join('、')}有安排`).join('；')}
                  </div>
                )}
                {r.hasConflict && r.timeConflicts && r.timeConflicts.length > 0 && (!r.participantConflicts || r.participantConflicts.length === 0) && (
                  <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8, padding: '6px 10px', background: 'rgba(231, 76, 60, 0.08)', borderRadius: 4 }}>
                    时间与其他排练冲突：{r.timeConflicts.map((x) => x.title).join('、')}
                  </div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                  <button onClick={() => startEdit(r)} style={editBtnStyle}>编辑</button>
                  <button onClick={() => handleDelete(r.id)} style={deleteBtnStyle}>删除</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {rehearsals.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>
            {hasActiveFilters ? '没有符合筛选条件的排练' : '暂无排练安排'}
          </div>
        )}
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

const editBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #3498db',
  color: '#3498db',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};
