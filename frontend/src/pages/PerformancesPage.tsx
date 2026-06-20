import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const STATUS_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: 'draft', label: '草稿', color: '#888' },
  { value: 'scheduled', label: '已排期', color: '#3498db' },
  { value: 'in_progress', label: '演出中', color: '#f39c12' },
  { value: 'completed', label: '已完成', color: '#2ecc71' },
  { value: 'cancelled', label: '已取消', color: '#e74c3c' },
];

const getStatusInfo = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

function toInputDateTime(date: Date | string) {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateRange(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) {
    return `${s.getFullYear()}/${pad(s.getMonth() + 1)}/${pad(s.getDate())} ${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
  }
  return `${s.getFullYear()}/${pad(s.getMonth() + 1)}/${pad(s.getDate())} ${pad(s.getHours())}:${pad(s.getMinutes())} ~ ${e.getFullYear()}/${pad(e.getMonth() + 1)}/${pad(e.getDate())} ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

interface PerformanceData {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  venue?: string;
  theater?: string;
  status: string;
  roleIds?: number[];
  materialIds?: number[];
  castAssignments?: Record<number, any>;
  notes?: string;
  expectedAudience?: number;
  tags?: string[];
  roles?: any[];
  materials?: any[];
  hasConflict?: boolean;
  timeConflicts?: any[];
  venueConflicts?: any[];
  theaterConflicts?: any[];
  roleCount?: number;
  materialCount?: number;
}

export default function PerformancesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDirector, isAdmin } = useAuth();
  const canEdit = isDirector || isAdmin;

  const [performances, setPerformances] = useState<PerformanceData[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterVenue, setFilterVenue] = useState(searchParams.get('venue') || '');
  const [filterTheater, setFilterTheater] = useState(searchParams.get('theater') || '');
  const [filterRoleId, setFilterRoleId] = useState(searchParams.get('roleId') || '');
  const [filterTags, setFilterTags] = useState<string[]>(
    searchParams.get('tags') ? searchParams.get('tags')!.split(',').filter(Boolean) : [],
  );
  const [dateStart, setDateStart] = useState(searchParams.get('start') || '');
  const [dateEnd, setDateEnd] = useState(searchParams.get('end') || '');

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableVenues, setAvailableVenues] = useState<string[]>([]);
  const [availableTheaters, setAvailableTheaters] = useState<string[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    venue: '',
    theater: '',
    status: 'draft' as string,
    notes: '',
    expectedAudience: '' as string | number,
    tags: '' as string,
    roleIds: [] as number[],
    materialIds: [] as number[],
  });
  const [conflictResult, setConflictResult] = useState<any>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<PerformanceData | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'roles' | 'materials'>('info');
  const [bindRoleId, setBindRoleId] = useState<number | ''>('');
  const [bindMaterialId, setBindMaterialId] = useState<number | ''>('');
  const [castEdit, setCastEdit] = useState<{
    performanceId: number;
    roleId: number;
    actorId: number | '';
    substituteActorIds: number[];
    notes: string;
  } | null>(null);

  const syncUrlParams = () => {
    const params = new URLSearchParams(searchParams);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    else params.delete('keyword');
    if (filterStatus) params.set('status', filterStatus);
    else params.delete('status');
    if (filterVenue.trim()) params.set('venue', filterVenue.trim());
    else params.delete('venue');
    if (filterTheater.trim()) params.set('theater', filterTheater.trim());
    else params.delete('theater');
    if (filterRoleId) params.set('roleId', filterRoleId);
    else params.delete('roleId');
    if (filterTags.length > 0) params.set('tags', filterTags.join(','));
    else params.delete('tags');
    if (dateStart) params.set('start', dateStart);
    else params.delete('start');
    if (dateEnd) params.set('end', dateEnd);
    else params.delete('end');
    setSearchParams(params, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    try {
      const [data, rolesData, materialsData, usersData, tagsData, venuesData, theatersData] =
        await Promise.all([
          api.performances.list({
            start: dateStart || undefined,
            end: dateEnd || undefined,
            venue: filterVenue.trim() || undefined,
            theater: filterTheater.trim() || undefined,
            status: filterStatus || undefined,
            roleId: filterRoleId || undefined,
            keyword: keyword.trim() || undefined,
            tags: filterTags.length > 0 ? filterTags.join(',') : undefined,
          }),
          api.roles.list().catch(() => []),
          api.materials.list().catch(() => []),
          api.users.list().catch(() => []),
          api.performances.getTags().catch(() => []),
          api.performances.getVenues().catch(() => []),
          api.performances.getTheaters().catch(() => []),
        ]);
      setPerformances(data as PerformanceData[]);
      setRoles(rolesData);
      setMaterials(materialsData);
      setUsers(usersData);
      setAvailableTags(tagsData);
      setAvailableVenues(venuesData);
      setAvailableTheaters(theatersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    syncUrlParams();
  }, [keyword, filterStatus, filterVenue, filterTheater, filterRoleId, filterTags, dateStart, dateEnd]);

  const openCreate = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setForm({
      title: '',
      description: '',
      startTime: toInputDateTime(tomorrow),
      endTime: toInputDateTime(new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000)),
      venue: '',
      theater: '',
      status: 'draft',
      notes: '',
      expectedAudience: '',
      tags: '',
      roleIds: [],
      materialIds: [],
    });
    setEditingId(null);
    setConflictResult(null);
    setShowForm(true);
  };

  const openEdit = (p: PerformanceData) => {
    setForm({
      title: p.title,
      description: p.description || '',
      startTime: toInputDateTime(p.startTime),
      endTime: toInputDateTime(p.endTime),
      venue: p.venue || '',
      theater: p.theater || '',
      status: p.status,
      notes: p.notes || '',
      expectedAudience: p.expectedAudience || '',
      tags: (p.tags || []).join(', '),
      roleIds: p.roleIds || [],
      materialIds: p.materialIds || [],
    });
    setEditingId(p.id);
    setConflictResult(null);
    setShowForm(true);
  };

  const checkFormConflict = async () => {
    if (!form.startTime || !form.endTime) {
      alert('请先填写开始和结束时间');
      return;
    }
    setCheckingConflict(true);
    try {
      const res = await api.performances.checkConflicts({
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        excludeId: editingId ?? undefined,
        venue: form.venue.trim() || undefined,
        theater: form.theater.trim() || undefined,
      });
      setConflictResult(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(form.startTime) >= new Date(form.endTime)) {
      alert('结束时间必须晚于开始时间');
      return;
    }
    try {
      const data: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        venue: form.venue.trim() || undefined,
        theater: form.theater.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        expectedAudience: form.expectedAudience ? Number(form.expectedAudience) : undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        roleIds: form.roleIds,
        materialIds: form.materialIds,
      };
      if (editingId) {
        await api.performances.update(editingId, data);
      } else {
        await api.performances.create(data);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.performances.updateStatus(id, status);
      load();
      if (selectedDetail?.id === id) {
        const updated = await api.performances.get(id);
        setSelectedDetail(updated);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定要删除演出场次「${title}」吗？`)) return;
    try {
      await api.performances.remove(id);
      if (selectedDetail?.id === id) setSelectedDetail(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBindRole = async (performanceId: number) => {
    if (!bindRoleId) return;
    try {
      const updated = await api.performances.bindRole(performanceId, Number(bindRoleId));
      setSelectedDetail(updated);
      setBindRoleId('');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUnbindRole = async (performanceId: number, roleId: number) => {
    if (!confirm('确定要解绑该角色吗？')) return;
    try {
      const updated = await api.performances.unbindRole(performanceId, roleId);
      setSelectedDetail(updated);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openCastEdit = (roleId: number, current?: any) => {
    if (!selectedDetail) return;
    setCastEdit({
      performanceId: selectedDetail.id,
      roleId,
      actorId: current?.assignedActor?.id ?? '',
      substituteActorIds: (current?.assignedSubstitutes || []).map((s: any) => s.id),
      notes: current?.notes || '',
    });
  };

  const saveCastEdit = async () => {
    if (!castEdit || !selectedDetail) return;
    try {
      const updated = await api.performances.updateRoleCast(castEdit.performanceId, castEdit.roleId, {
        actorId: castEdit.actorId === '' ? undefined : Number(castEdit.actorId),
        substituteActorIds: castEdit.substituteActorIds,
        notes: castEdit.notes || undefined,
      });
      setSelectedDetail(updated);
      setCastEdit(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBindMaterial = async (performanceId: number) => {
    if (!bindMaterialId) return;
    try {
      const updated = await api.performances.bindMaterial(performanceId, Number(bindMaterialId));
      setSelectedDetail(updated);
      setBindMaterialId('');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUnbindMaterial = async (performanceId: number, materialId: number) => {
    if (!confirm('确定要解除该素材关联吗？')) return;
    try {
      const updated = await api.performances.unbindMaterial(performanceId, materialId);
      setSelectedDetail(updated);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const resetFilters = () => {
    setKeyword('');
    setFilterStatus('');
    setFilterVenue('');
    setFilterTheater('');
    setFilterRoleId('');
    setFilterTags([]);
    setDateStart('');
    setDateEnd('');
  };

  const unboundRoles = (selectedDetail?.roleIds || []).length > 0
    ? roles.filter((r) => !(selectedDetail!.roleIds || []).includes(r.id))
    : roles;

  const unboundMaterials = (selectedDetail?.materialIds || []).length > 0
    ? materials.filter((m) => !(selectedDetail!.materialIds || []).includes(m.id))
    : materials;

  const totalCount = performances.length;
  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    performances.forEach((p) => {
      s[p.status] = (s[p.status] || 0) + 1;
    });
    return s;
  }, [performances]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', color: '#e0e0e0' }}>演出场次管理</h2>
          <div style={{ color: '#888', fontSize: 13 }}>
            共 {totalCount} 场
            {Object.keys(stats).length > 0 && (
              <span>
                {' '}·{' '}
                {Object.entries(stats).map(([k, v], i) => {
                  const info = getStatusInfo(k);
                  return (
                    <span key={k} style={{ color: info.color }}>
                      {info.label}:{v}
                      {i < Object.keys(stats).length - 1 ? ' | ' : ''}
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={primaryBtnStyle}>
            + 新建演出
          </button>
        )}
      </div>

      <div style={filterPanelStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="搜索标题、描述、备注..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={inputStyle}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="">-- 全部状态 --</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            type="text"
            list="venue-list"
            placeholder="搜索场馆..."
            value={filterVenue}
            onChange={(e) => setFilterVenue(e.target.value)}
            style={inputStyle}
          />
          <datalist id="venue-list">
            {availableVenues.map((v) => <option key={v} value={v} />)}
          </datalist>
          <input
            type="text"
            list="theater-list"
            placeholder="搜索剧场..."
            value={filterTheater}
            onChange={(e) => setFilterTheater(e.target.value)}
            style={inputStyle}
          />
          <datalist id="theater-list">
            {availableTheaters.map((t) => <option key={t} value={t} />)}
          </datalist>
          <select value={filterRoleId} onChange={(e) => setFilterRoleId(e.target.value)} style={inputStyle}>
            <option value="">-- 全部角色 --</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.characterName}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            placeholder="开始日期"
            style={inputStyle}
          />
          <input
            type="datetime-local"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            placeholder="结束日期"
            style={inputStyle}
          />
        </div>
        {availableTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#888', fontSize: 12 }}>标签：</span>
            {availableTags.map((tag) => {
              const active = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 12,
                    borderRadius: 12,
                    border: `1px solid ${active ? '#e74c3c' : '#444'}`,
                    background: active ? 'rgba(231, 76, 60, 0.15)' : 'transparent',
                    color: active ? '#e74c3c' : '#aaa',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <button onClick={resetFilters} style={secondaryBtnStyle}>
            重置筛选
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>加载中...</div>
          ) : performances.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: 60, background: '#1a1a1a', borderRadius: 8, border: '1px solid #333' }}>
              暂无演出场次
              {canEdit && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={openCreate} style={primaryBtnStyle}>+ 新建演出</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {performances.map((p) => {
                const status = getStatusInfo(p.status);
                const isActive = selectedDetail?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedDetail(p);
                      setDetailTab('info');
                    }}
                    style={{
                      ...cardStyle,
                      cursor: 'pointer',
                      borderColor: isActive ? '#e74c3c' : '#333',
                      boxShadow: isActive ? '0 0 0 1px #e74c3c' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, color: '#e74c3c', fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.title}
                        </h3>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${status.color}1a`,
                        color: status.color,
                        border: `1px solid ${status.color}33`,
                        whiteSpace: 'nowrap',
                      }}>
                        {status.label}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: '#aaa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>🕐</span>
                      <span>{formatDateRange(p.startTime, p.endTime)}</span>
                    </div>
                    {(p.venue || p.theater) && (
                      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>📍</span>
                        <span>
                          {[p.venue, p.theater].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                    {p.hasConflict && (
                      <div style={{
                        padding: '6px 10px',
                        background: 'rgba(231, 76, 60, 0.1)',
                        border: '1px solid rgba(231, 76, 60, 0.3)',
                        borderRadius: 6,
                        color: '#e74c3c',
                        fontSize: 12,
                        marginBottom: 8,
                      }}>
                        ⚠️ 时间/场地冲突
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={statChipStyle}>
                        🎭 {(p.roleCount || (p.roles?.length) || (p.roleIds?.length) || 0)}角色
                      </span>
                      <span style={statChipStyle}>
                        📁 {(p.materialCount || (p.materials?.length) || (p.materialIds?.length) || 0)}素材
                      </span>
                      {p.expectedAudience && (
                        <span style={statChipStyle}>
                          👥 {p.expectedAudience}观众
                        </span>
                      )}
                    </div>

                    {p.tags && p.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {p.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              padding: '2px 8px',
                              background: 'rgba(52, 152, 219, 0.1)',
                              border: '1px solid rgba(52, 152, 219, 0.3)',
                              color: '#3498db',
                              borderRadius: 10,
                              fontSize: 11,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {p.tags.length > 4 && (
                          <span style={{ fontSize: 11, color: '#666' }}>+{p.tags.length - 4}</span>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      {canEdit && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                            style={{ ...secondaryBtnStyle, padding: '5px 12px', fontSize: 12 }}
                          >
                            编辑
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(p.id, p.title);
                            }}
                            style={{ ...deleteBtnStyle, padding: '5px 12px', fontSize: 12 }}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedDetail && (
          <div style={detailPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#e74c3c', fontSize: 18 }}>
                {selectedDetail.title}
              </h3>
              <button
                onClick={() => setSelectedDetail(null)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['info', 'roles', 'materials'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: detailTab === tab ? '#2a1515' : 'transparent',
                    border: `1px solid ${detailTab === tab ? '#e74c3c' : '#333'}`,
                    borderRadius: 6,
                    color: detailTab === tab ? '#e74c3c' : '#aaa',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {tab === 'info' ? '基本信息' : tab === 'roles' ? `角色 (${(selectedDetail.roles || []).length})` : `素材 (${(selectedDetail.materials || []).length})`}
                </button>
              ))}
            </div>

            {detailTab === 'info' && (
              <div style={{ fontSize: 14, color: '#ccc', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow label="状态">
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    background: `${getStatusInfo(selectedDetail.status).color}1a`,
                    color: getStatusInfo(selectedDetail.status).color,
                  }}>
                    {getStatusInfo(selectedDetail.status).label}
                  </span>
                </InfoRow>
                {canEdit && (
                  <InfoRow label="更新状态">
                    <select
                      value={selectedDetail.status}
                      onChange={(e) => handleUpdateStatus(selectedDetail.id, e.target.value)}
                      style={inputStyle}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </InfoRow>
                )}
                <InfoRow label="时间排期">
                  {formatDateRange(selectedDetail.startTime, selectedDetail.endTime)}
                </InfoRow>
                <InfoRow label="场馆 / 剧场">
                  {[selectedDetail.venue, selectedDetail.theater].filter(Boolean).join(' · ') || '—'}
                </InfoRow>
                <InfoRow label="预计观众">
                  {selectedDetail.expectedAudience ? `${selectedDetail.expectedAudience} 人` : '—'}
                </InfoRow>
                {selectedDetail.description && (
                  <InfoRow label="描述" vertical>
                    <div style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 13 }}>
                      {selectedDetail.description}
                    </div>
                  </InfoRow>
                )}
                {selectedDetail.notes && (
                  <InfoRow label="备注" vertical>
                    <div style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 13 }}>
                      {selectedDetail.notes}
                    </div>
                  </InfoRow>
                )}
                {selectedDetail.tags && selectedDetail.tags.length > 0 && (
                  <InfoRow label="标签">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedDetail.tags.map((t) => (
                        <span key={t} style={{
                          padding: '3px 10px',
                          background: 'rgba(52, 152, 219, 0.1)',
                          border: '1px solid rgba(52, 152, 219, 0.3)',
                          color: '#3498db',
                          borderRadius: 10,
                          fontSize: 12,
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                )}
                {selectedDetail.hasConflict && (
                  <div style={{
                    padding: 12,
                    background: 'rgba(231, 76, 60, 0.08)',
                    border: '1px solid rgba(231, 76, 60, 0.3)',
                    borderRadius: 6,
                    fontSize: 13,
                  }}>
                    <div style={{ color: '#e74c3c', fontWeight: 600, marginBottom: 8 }}>⚠️ 冲突检测</div>
                    {selectedDetail.venueConflicts && selectedDetail.venueConflicts.length > 0 && (
                      <div style={{ color: '#aaa', marginBottom: 6 }}>
                        场馆冲突：{selectedDetail.venueConflicts.map((c: any) => c.title).join('、')}
                      </div>
                    )}
                    {selectedDetail.theaterConflicts && selectedDetail.theaterConflicts.length > 0 && (
                      <div style={{ color: '#aaa', marginBottom: 6 }}>
                        剧场冲突：{selectedDetail.theaterConflicts.map((c: any) => c.title).join('、')}
                      </div>
                    )}
                    {selectedDetail.timeConflicts && selectedDetail.timeConflicts.length > 0 && (
                      <div style={{ color: '#aaa' }}>
                        时间冲突：{selectedDetail.timeConflicts.map((c: any) => c.title).join('、')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'roles' && (
              <div>
                {canEdit && unboundRoles.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select
                      value={bindRoleId}
                      onChange={(e) => setBindRoleId(e.target.value ? Number(e.target.value) : '')}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="">-- 选择要绑定的角色 --</option>
                      {unboundRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.characterName}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleBindRole(selectedDetail.id)}
                      disabled={!bindRoleId}
                      style={{ ...primaryBtnStyle, opacity: bindRoleId ? 1 : 0.5 }}
                    >
                      绑定
                    </button>
                  </div>
                )}
                {!selectedDetail.roles || selectedDetail.roles.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
                    暂无绑定角色
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedDetail.roles.map((role: any) => (
                      <div key={role.roleId} style={subCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ color: '#e0e0e0', fontWeight: 600, marginBottom: 2 }}>
                              {role.characterName}
                              <span style={{ color: '#666', fontSize: 11, marginLeft: 8 }}>
                                P{role.priority}
                              </span>
                            </div>
                            {role.characterDescription && (
                              <div style={{ color: '#888', fontSize: 12 }}>
                                {role.characterDescription}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => openCastEdit(role.roleId, role)}
                                style={{ ...secondaryBtnStyle, padding: '3px 10px', fontSize: 11 }}
                              >
                                配置参演
                              </button>
                              <button
                                onClick={() => handleUnbindRole(selectedDetail.id, role.roleId)}
                                style={{ ...deleteBtnStyle, padding: '3px 10px', fontSize: 11 }}
                              >
                                解绑
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#aaa' }}>
                          <div>
                            🎬 演员：{role.assignedActor
                              ? <span style={{ color: '#2ecc71', fontWeight: 500 }}>
                                  {role.assignedActor.displayName || role.assignedActor.username}
                                </span>
                              : <span style={{ color: '#666' }}>未分配</span>
                            }
                          </div>
                          {role.assignedSubstitutes && role.assignedSubstitutes.length > 0 && (
                            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              <span style={{ color: '#888' }}>替补：</span>
                              {role.assignedSubstitutes.map((s: any) => (
                                <span
                                  key={s.id}
                                  style={{
                                    padding: '2px 8px',
                                    background: 'rgba(243, 156, 18, 0.1)',
                                    border: '1px solid rgba(243, 156, 18, 0.3)',
                                    color: '#f39c12',
                                    borderRadius: 10,
                                    fontSize: 11,
                                  }}
                                >
                                  {s.displayName || s.username}
                                </span>
                              ))}
                            </div>
                          )}
                          {role.notes && (
                            <div style={{ marginTop: 6, color: '#888', fontSize: 11, fontStyle: 'italic' }}>
                              备注：{role.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'materials' && (
              <div>
                {canEdit && unboundMaterials.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select
                      value={bindMaterialId}
                      onChange={(e) => setBindMaterialId(e.target.value ? Number(e.target.value) : '')}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="">-- 选择要关联的素材 --</option>
                      {unboundMaterials.map((m) => (
                        <option key={m.id} value={m.id}>{m.originalName} ({m.mimeType})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleBindMaterial(selectedDetail.id)}
                      disabled={!bindMaterialId}
                      style={{ ...primaryBtnStyle, opacity: bindMaterialId ? 1 : 0.5 }}
                    >
                      关联
                    </button>
                  </div>
                )}
                {!selectedDetail.materials || selectedDetail.materials.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
                    暂无关联素材
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedDetail.materials.map((mat: any) => (
                      <div key={mat.materialId} style={subCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#e0e0e0', fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📄 {mat.originalName}
                            </div>
                            <div style={{ color: '#888', fontSize: 12 }}>
                              {mat.mimeType} · {formatFileSize(mat.size)}
                            </div>
                            {mat.categories && mat.categories.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                {mat.categories.map((c: string) => (
                                  <span
                                    key={c}
                                    style={{
                                      padding: '2px 8px',
                                      background: 'rgba(46, 204, 113, 0.1)',
                                      border: '1px solid rgba(46, 204, 113, 0.3)',
                                      color: '#2ecc71',
                                      borderRadius: 10,
                                      fontSize: 11,
                                    }}
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                            {mat.description && (
                              <div style={{ color: '#888', fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                                {mat.description}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleUnbindMaterial(selectedDetail.id, mat.materialId)}
                              style={{ ...deleteBtnStyle, padding: '3px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                            >
                              解除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div style={modalOverlayStyle} onClick={() => setShowForm(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: 16, marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#e74c3c', fontSize: 18 }}>
                {editingId ? '编辑演出场次' : '新建演出场次'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                placeholder="演出标题 *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                style={inputStyle}
              />
              <textarea
                placeholder="演出描述"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 60 }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>开始时间 *</label>
                  <input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>结束时间 *</label>
                  <input
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input
                  list="form-venue-list"
                  placeholder="场馆（如：国家大剧院）"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  style={inputStyle}
                />
                <datalist id="form-venue-list">
                  {availableVenues.map((v) => <option key={v} value={v} />)}
                </datalist>
                <input
                  list="form-theater-list"
                  placeholder="剧场（如：戏剧场）"
                  value={form.theater}
                  onChange={(e) => setForm({ ...form, theater: e.target.value })}
                  style={inputStyle}
                />
                <datalist id="form-theater-list">
                  {availableTheaters.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>状态</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    style={inputStyle}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>预计观众数</label>
                  <input
                    type="number"
                    placeholder="如：500"
                    value={form.expectedAudience}
                    onChange={(e) => setForm({ ...form, expectedAudience: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>标签（逗号分隔）</label>
                <input
                  type="text"
                  placeholder="如：首演, 巡演, 开幕夜"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>关联角色</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 6 }}>
                  {form.roleIds.map((rid) => {
                    const role = roles.find((r) => r.id === rid);
                    return (
                      <span
                        key={rid}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(231, 76, 60, 0.1)',
                          border: '1px solid rgba(231, 76, 60, 0.3)',
                          color: '#e74c3c',
                          borderRadius: 12,
                          fontSize: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {role?.characterName || `#${rid}`}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, roleIds: form.roleIds.filter((x) => x !== rid) })}
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val && !form.roleIds.includes(val)) {
                      setForm({ ...form, roleIds: [...form.roleIds, val] });
                    }
                    e.target.value = '';
                  }}
                  style={inputStyle}
                >
                  <option value="">+ 添加角色...</option>
                  {roles.filter((r) => !form.roleIds.includes(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>{r.characterName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>关联素材</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 6 }}>
                  {form.materialIds.map((mid) => {
                    const mat = materials.find((m) => m.id === mid);
                    return (
                      <span
                        key={mid}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(46, 204, 113, 0.1)',
                          border: '1px solid rgba(46, 204, 113, 0.3)',
                          color: '#2ecc71',
                          borderRadius: 12,
                          fontSize: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {mat?.originalName || `#${mid}`}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, materialIds: form.materialIds.filter((x) => x !== mid) })}
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val && !form.materialIds.includes(val)) {
                      setForm({ ...form, materialIds: [...form.materialIds, val] });
                    }
                    e.target.value = '';
                  }}
                  style={inputStyle}
                >
                  <option value="">+ 添加素材...</option>
                  {materials.filter((m) => !form.materialIds.includes(m.id)).map((m) => (
                    <option key={m.id} value={m.id}>{m.originalName} ({m.mimeType})</option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="备注"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: 60 }}
              />

              <button
                type="button"
                onClick={checkFormConflict}
                disabled={checkingConflict}
                style={{ ...secondaryBtnStyle, color: checkingConflict ? '#666' : '#3498db', borderColor: checkingConflict ? '#444' : '#3498db' }}
              >
                {checkingConflict ? '检测中...' : '🔍 检测时间/场地冲突'}
              </button>
              {conflictResult && (
                <div style={{
                  padding: 12,
                  background: conflictResult.hasConflict
                    ? 'rgba(231, 76, 60, 0.08)'
                    : 'rgba(46, 204, 113, 0.08)',
                  border: `1px solid ${conflictResult.hasConflict ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)'}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: conflictResult.hasConflict ? '#e74c3c' : '#2ecc71',
                }}>
                  {conflictResult.hasConflict ? '⚠️ 检测到冲突：' : '✅ 无冲突'}
                  {conflictResult.hasConflict && (
                    <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                      {conflictResult.venueConflicts?.length > 0 && (
                        <li>场馆冲突：{conflictResult.venueConflicts.map((c: any) => c.title).join('、')}</li>
                      )}
                      {conflictResult.theaterConflicts?.length > 0 && (
                        <li>剧场冲突：{conflictResult.theaterConflicts.map((c: any) => c.title).join('、')}</li>
                      )}
                      {conflictResult.timeConflicts?.length > 0 && (
                        <li>时间重叠：{conflictResult.timeConflicts.map((c: any) => c.title).join('、')}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={secondaryBtnStyle}>
                  取消
                </button>
                <button type="submit" style={primaryBtnStyle}>
                  {editingId ? '保存修改' : '创建演出'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {castEdit && (
        <div style={modalOverlayStyle} onClick={() => setCastEdit(null)}>
          <div style={{ ...modalStyle, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: 16, marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#e74c3c', fontSize: 18 }}>
                配置参演信息
              </h3>
              <button onClick={() => setCastEdit(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>主要演员</label>
                <select
                  value={castEdit.actorId}
                  onChange={(e) => setCastEdit({ ...castEdit, actorId: e.target.value ? Number(e.target.value) : '' })}
                  style={inputStyle}
                >
                  <option value="">-- 不指定（使用默认） --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName || u.username} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>替补演员（可多选）</label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 10,
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: 6,
                    maxHeight: 150,
                    overflowY: 'auto',
                  }}
                >
                  {users.map((u) => {
                    const checked = castEdit.substituteActorIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          padding: '4px 0',
                          fontSize: 13,
                          color: '#ccc',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setCastEdit({
                                ...castEdit,
                                substituteActorIds: castEdit.substituteActorIds.filter((id) => id !== u.id),
                              });
                            } else {
                              setCastEdit({
                                ...castEdit,
                                substituteActorIds: [...castEdit.substituteActorIds, u.id],
                              });
                            }
                          }}
                          style={{ accentColor: '#e74c3c' }}
                        />
                        {u.displayName || u.username} <span style={{ color: '#666', fontSize: 11 }}>({u.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>备注</label>
                <textarea
                  placeholder="特殊安排、说明等"
                  value={castEdit.notes}
                  onChange={(e) => setCastEdit({ ...castEdit, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: 60 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setCastEdit(null)} style={secondaryBtnStyle}>取消</button>
                <button onClick={saveCastEdit} style={primaryBtnStyle}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children, vertical }: { label: string; children: React.ReactNode; vertical?: boolean }) {
  return (
    <div style={vertical ? { display: 'flex', flexDirection: 'column', gap: 6 } : { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ color: '#888', fontSize: 13, flexShrink: 0, minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#888',
  fontSize: 12,
  marginBottom: 4,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  background: '#e74c3c',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
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
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const filterPanelStyle: React.CSSProperties = {
  background: '#1a1a1a',
  padding: 16,
  borderRadius: 8,
  border: '1px solid #333',
  marginBottom: 20,
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 16,
  transition: 'all 0.2s',
};

const statChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid #444',
  borderRadius: 10,
  fontSize: 11,
  color: '#999',
};

const subCardStyle: React.CSSProperties = {
  background: '#222',
  padding: 12,
  borderRadius: 6,
  border: '1px solid #333',
};

const detailPanelStyle: React.CSSProperties = {
  width: 380,
  flexShrink: 0,
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 8,
  padding: 16,
  maxHeight: 'calc(100vh - 140px)',
  overflowY: 'auto',
  position: 'sticky',
  top: 24,
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 620,
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};
