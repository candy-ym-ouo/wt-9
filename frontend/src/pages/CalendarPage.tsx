import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { colors, spacing, fontSize, radius } from '../styles/theme';

interface Rehearsal {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  participantIds: number[];
  materialIds?: number[];
  hasConflict?: boolean;
  timeConflicts?: Rehearsal[];
  participantConflicts?: Array<{
    userId: number;
    userName?: string;
    conflictingRehearsals: Rehearsal[];
  }>;
  locationConflicts?: Rehearsal[];
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
    attendanceStatus?: 'present' | 'absent' | 'late' | null;
    absentReason?: string;
    checkInTime?: string;
  }>;
  onLeaveCount?: number;
  withSubstituteCount?: number;
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  pendingAttendanceCount?: number;
  effectiveParticipants?: number[];
  tags?: any[];
}

interface TagInfo {
  id: number;
  name: string;
  color: string;
}

interface MaterialLite {
  id: number;
  originalName: string;
  category?: string;
  categories?: string[];
  tags?: string[];
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
  locationConflicts: Rehearsal[];
}

const emptyForm = {
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  location: '',
  participantIds: [] as number[],
  materialIds: [] as number[],
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
  attendanceStatus: string;
}

const emptyFilters: Filters = {
  location: '',
  participantId: null,
  timeSlotStart: '',
  timeSlotEnd: '',
  attendanceStatus: '',
};

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rehearsalRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [highlightedRehearsalId, setHighlightedRehearsalId] = useState<number | null>(null);

  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [materials, setMaterials] = useState<MaterialLite[]>([]);
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    searchParams.get('tagIds') ? searchParams.get('tagIds')!.split(',').map(Number).filter(Boolean) : []
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [expandedRehearsalId, setExpandedRehearsalId] = useState<number | null>(null);
  const [expandedRolesId, setExpandedRolesId] = useState<number | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<number, any[]>>({});
  const [loadingRoles, setLoadingRoles] = useState<Record<number, boolean>>({});
  const [attendanceEdits, setAttendanceEdits] = useState<Record<number, { status: 'present' | 'absent' | 'late' | null; absentReason?: string }>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [lastWeekRehearsals, setLastWeekRehearsals] = useState<Rehearsal[]>([]);
  const [loadingLastWeek, setLoadingLastWeek] = useState(false);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [copyingAll, setCopyingAll] = useState(false);
  const { user, isDirector, isAdmin } = useAuth();
  const { isMobile, isTablet } = useResponsive();

  const load = async () => {
    const params: Parameters<typeof api.rehearsals.list>[0] = {};
    if (filters.location) params.location = filters.location;
    if (filters.participantId) params.participantId = filters.participantId;
    if (filters.timeSlotStart && filters.timeSlotEnd) {
      params.timeSlot = `${filters.timeSlotStart}-${filters.timeSlotEnd}`;
    }
    if (filters.attendanceStatus) {
      params.attendanceStatus = filters.attendanceStatus;
    }
    let data = await api.rehearsals.list(params);

    if (selectedTagIds.length > 0) {
      try {
        const filterResult = await api.tags.filterByTags(selectedTagIds, 'rehearsal');
        const validIds = new Set(filterResult.targetIds);
        data = data.filter((r: any) => validIds.has(r.id));
      } catch {}
    }

    const rehearsalsWithTags = await Promise.all(
      data.map(async (r: any) => {
        try {
          const tags = await api.tags.getTagsForTarget('rehearsal', r.id);
          return { ...r, tags };
        } catch {
          return r;
        }
      })
    );
    setRehearsals(rehearsalsWithTags);
  };

  const loadTags = async () => {
    try {
      const data = await api.tags.list({ category: 'rehearsal' });
      setAvailableTags(data);
    } catch {}
  };

  const loadLastWeekRehearsals = async () => {
    setLoadingLastWeek(true);
    try {
      const data = await api.rehearsals.getLastWeekSchedule();
      setLastWeekRehearsals(data);
    } catch (e) {
      console.error('加载上周排练失败', e);
    } finally {
      setLoadingLastWeek(false);
    }
  };

  const handleCopySingle = async (id: number) => {
    setCopyingId(id);
    try {
      await api.rehearsals.copyToNextWeek(id);
      await load();
    } catch (e: any) {
      alert('复制失败：' + (e.message || '未知错误'));
    } finally {
      setCopyingId(null);
    }
  };

  const handleCopyAll = async () => {
    if (!confirm('确定要复制上周所有排练到本周吗？')) return;
    setCopyingAll(true);
    try {
      const result = await api.rehearsals.copyLastWeekAll();
      await load();
      let msg = `成功复制 ${result.created.length} 个排练`;
      if (result.skipped && result.skipped.length > 0) {
        msg += `\n跳过 ${result.skipped.length} 个：\n` + result.skipped.map((s: any) => `• ${s.rehearsal.title}: ${s.reason}`).join('\n');
      }
      alert(msg);
      setShowCopyPanel(false);
    } catch (e: any) {
      alert('批量复制失败：' + (e.message || '未知错误'));
    } finally {
      setCopyingAll(false);
    }
  };

  const handleCopyToForm = (r: Rehearsal) => {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const newStart = new Date(new Date(r.startTime).getTime() + ONE_WEEK_MS);
    const newEnd = new Date(new Date(r.endTime).getTime() + ONE_WEEK_MS);
    setForm({
      title: r.title,
      description: r.description || '',
      startTime: formatLocalInput(newStart.toISOString()),
      endTime: formatLocalInput(newEnd.toISOString()),
      location: r.location || '',
      participantIds: r.participantIds || [],
      materialIds: r.materialIds || [],
    });
    setEditingId(null);
    setShowForm(true);
    setShowCopyPanel(false);
    setError(null);
    setConflictInfo(null);
  };

  const toggleCopyPanel = () => {
    if (!showCopyPanel) {
      loadLastWeekRehearsals();
    }
    setShowCopyPanel(!showCopyPanel);
  };

  const hasActiveFilters =
    filters.location || filters.participantId || (filters.timeSlotStart && filters.timeSlotEnd) || filters.attendanceStatus || keyword;

  const filteredRehearsals = useMemo(() => {
    if (!keyword.trim()) return rehearsals;
    const kw = keyword.toLowerCase();
    return rehearsals.filter((r) =>
      r.title.toLowerCase().includes(kw) ||
      (r.description && r.description.toLowerCase().includes(kw)) ||
      (r.location && r.location.toLowerCase().includes(kw)) ||
      (r.participants && r.participants.some((p: any) =>
        (p.userName || '').toLowerCase().includes(kw) ||
        (p.displayName || '').toLowerCase().includes(kw)
      ))
    );
  }, [rehearsals, keyword]);

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

  const resetFilters = () => {
    setFilters(emptyFilters);
    setKeyword('');
  };

  const toggleAttendanceExpand = (rehearsalId: number) => {
    if (expandedRehearsalId === rehearsalId) {
      setExpandedRehearsalId(null);
      setAttendanceEdits({});
    } else {
      setExpandedRehearsalId(rehearsalId);
      const rehearsal = rehearsals.find((r) => r.id === rehearsalId);
      if (rehearsal?.participants) {
        const edits: Record<number, { status: 'present' | 'absent' | 'late' | null; absentReason?: string }> = {};
        rehearsal.participants.forEach((p) => {
          edits[p.userId] = {
            status: p.attendanceStatus ?? null,
            absentReason: p.absentReason,
          };
        });
        setAttendanceEdits(edits);
      }
    }
  };

  const toggleRolesExpand = async (rehearsalId: number) => {
    if (expandedRolesId === rehearsalId) {
      setExpandedRolesId(null);
    } else {
      setExpandedRolesId(rehearsalId);
      if (!roleAssignments[rehearsalId]) {
        setLoadingRoles((prev) => ({ ...prev, [rehearsalId]: true }));
        try {
          const data = await api.rehearsals.getRoleAssignments(rehearsalId);
          setRoleAssignments((prev) => ({ ...prev, [rehearsalId]: data }));
        } catch (e) {
          console.error('加载角色分工失败', e);
        } finally {
          setLoadingRoles((prev) => ({ ...prev, [rehearsalId]: false }));
        }
      }
    }
  };

  const updateAttendanceEdit = (userId: number, field: string, value: any) => {
    setAttendanceEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const saveAttendance = async (rehearsalId: number) => {
    setSavingAttendance(true);
    try {
      const updates = Object.entries(attendanceEdits).map(([userId, edit]) => ({
        userId: Number(userId),
        status: edit.status,
        absentReason: edit.absentReason,
      }));
      const updated = await api.rehearsals.updateAttendance(rehearsalId, updates);
      setRehearsals((prev) =>
        prev.map((r) => (r.id === rehearsalId ? updated : r))
      );
      setExpandedRehearsalId(null);
      setAttendanceEdits({});
    } catch (e: any) {
      console.error('保存签到失败', e);
    } finally {
      setSavingAttendance(false);
    }
  };

  const getAttendanceStatusLabel = (status?: 'present' | 'absent' | 'late' | null) => {
    switch (status) {
      case 'present':
        return { text: '出勤', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.15)' };
      case 'absent':
        return { text: '缺席', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.15)' };
      case 'late':
        return { text: '迟到', color: '#f39c12', bg: 'rgba(243, 156, 18, 0.15)' };
      default:
        return { text: '未签到', color: '#888', bg: 'rgba(136, 136, 136, 0.15)' };
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (e) {
      console.error('加载用户列表失败', e);
    }
  };

  const loadMaterials = async () => {
    try {
      const data = await api.materials.list();
      setMaterials(data);
    } catch (e) {
      console.error('加载素材列表失败', e);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
    loadMaterials();
    loadTags();
  }, []);

  useEffect(() => {
    load();
  }, [filters, selectedTagIds]);

  useEffect(() => {
    const rehearsalIdParam = searchParams.get('rehearsalId');
    if (rehearsalIdParam && rehearsals.length > 0) {
      const id = Number(rehearsalIdParam);
      const exists = rehearsals.some((r) => r.id === id);
      if (exists) {
        setHighlightedRehearsalId(id);
        setTimeout(() => {
          const el = rehearsalRefs.current[id];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        setTimeout(() => setHighlightedRehearsalId(null), 3000);
        const params = new URLSearchParams(searchParams);
        params.delete('rehearsalId');
        setSearchParams(params, { replace: true });
      }
    }
  }, [searchParams, rehearsals]);

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
          location: form.location,
        });
        setConflictInfo(info);
      } catch (e) {
        setConflictInfo(null);
      } finally {
        setCheckingConflict(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.startTime, form.endTime, form.participantIds, form.location, showForm, editingId]);

  const startEdit = (r: Rehearsal) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      description: r.description || '',
      startTime: formatLocalInput(r.startTime),
      endTime: formatLocalInput(r.endTime),
      location: r.location || '',
      participantIds: r.participantIds || [],
      materialIds: r.materialIds || [],
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

  const toggleMaterial = (materialId: number) => {
    setForm((prev) => ({
      ...prev,
      materialIds: prev.materialIds.includes(materialId)
        ? prev.materialIds.filter((id) => id !== materialId)
        : [...prev.materialIds, materialId],
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

  const headerActions = (
    <div style={{ display: 'flex', gap: isMobile ? spacing.xs : spacing.sm }}>
      <button
        onClick={() => (isMobile ? setShowFilters(true) : setShowFilters(!showFilters))}
        style={{
          padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '8px 16px',
          background: showFilters ? `${colors.accent}20` : 'transparent',
          border: `1px solid ${colors.accent}`,
          borderRadius: radius.md,
          color: colors.accent,
          cursor: 'pointer',
          fontSize: isMobile ? fontSize.sm : 14,
          minHeight: isMobile ? 40 : 0,
          minWidth: isMobile ? 40 : 0,
          position: 'relative',
        }}
        title="筛选"
      >
        {isMobile ? '🔍' : `🔍 筛选`}
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
              background: colors.primary,
              display: isMobile ? 'inline-block' : 'inline',
              color: isMobile ? 'transparent' : colors.primary,
            }}
          >
            {!isMobile && '●'}
          </span>
        )}
      </button>
      {canEdit && (
        <button
          onClick={() => (isMobile ? setShowCopyPanel(true) : toggleCopyPanel())}
          style={{
            padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '8px 16px',
            background: showCopyPanel ? `${colors.secondary}20` : 'transparent',
            border: `1px solid ${colors.secondary}`,
            borderRadius: radius.md,
            color: colors.secondary,
            cursor: 'pointer',
            fontSize: isMobile ? fontSize.sm : 14,
            minHeight: isMobile ? 40 : 0,
            minWidth: isMobile ? 40 : 0,
          }}
          title="复制上周安排"
        >
          {isMobile ? '📋' : '📋 复制上周'}
        </button>
      )}
      {canEdit && (
        <button
          onClick={() =>
            isMobile
              ? setShowForm(true)
              : showForm
                ? resetForm()
                : setShowForm(true)
          }
          style={{
            padding: isMobile ? `${spacing.sm}px ${spacing.md}px` : '8px 16px',
            background: colors.primary,
            border: 'none',
            borderRadius: radius.md,
            color: colors.textInverse,
            cursor: 'pointer',
            fontSize: isMobile ? fontSize.sm : 14,
            fontWeight: 600,
            minHeight: isMobile ? 40 : 0,
            minWidth: isMobile ? 40 : 0,
          }}
          title={isMobile ? '新建排练' : showForm ? '取消' : '新建排练'}
        >
          {isMobile ? (showForm ? '✕' : '➕') : showForm ? '取消' : '+ 新排练'}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="排练日历"
        subtitle={
          !canEdit ? '🔒 仅导演和管理员可编辑' : undefined
        }
        rightAction={headerActions}
        sticky
      />

      {!isMobile && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xxl,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <h2 style={{ margin: 0, color: colors.text }}>排练日历</h2>
            {!canEdit && (
              <span
                style={{
                  padding: '4px 10px',
                  background: `${colors.secondary}20`,
                  border: `1px solid ${colors.secondary}`,
                  color: colors.secondary,
                  borderRadius: radius.full,
                  fontSize: fontSize.sm,
                }}
              >
                🔒 仅导演和管理员可编辑
              </span>
            )}
          </div>
          {headerActions}
        </div>
      )}

      <div style={{ marginBottom: isMobile ? spacing.lg : 20 }}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          placeholder="搜索排练标题、地点、参与人..."
          style={{
            width: '100%',
            padding: isMobile
              ? `${spacing.md + 2}px ${spacing.md + 2}px`
              : '10px 14px',
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            color: colors.text,
            fontSize: isMobile ? fontSize.lg : 14,
            outline: 'none',
            boxSizing: 'border-box',
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
      </div>

      {!isMobile && showCopyPanel && canEdit && (
        <div style={{
          background: colors.bgSecondary,
          padding: 20,
          borderRadius: radius.lg,
          border: `1px solid ${colors.secondary}`,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>
              📋 上周排练安排
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCopyAll}
                disabled={copyingAll || lastWeekRehearsals.length === 0}
                style={{
                  padding: '6px 14px',
                  background: '#9b59b6',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: copyingAll || lastWeekRehearsals.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  opacity: copyingAll || lastWeekRehearsals.length === 0 ? 0.6 : 1,
                }}
              >
                {copyingAll ? '复制中...' : '一键复制全部到本周'}
              </button>
              <button
                onClick={toggleCopyPanel}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid #555',
                  borderRadius: 6,
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                关闭
              </button>
            </div>
          </div>

          {loadingLastWeek && (
            <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
              ⏳ 加载上周排练中...
            </div>
          )}

          {!loadingLastWeek && lastWeekRehearsals.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#666' }}>
              上周没有排练安排
            </div>
          )}

          {!loadingLastWeek && lastWeekRehearsals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lastWeekRehearsals.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    background: '#222',
                    borderRadius: 6,
                    padding: 12,
                    borderLeft: `3px solid ${colorPool[idx % colorPool.length]}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e0e0e0', fontWeight: 500, marginBottom: 4 }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {formatDate(r.startTime)} → {formatDate(r.endTime)}
                      {r.location && <span style={{ marginLeft: 12 }}>📍 {r.location}</span>}
                    </div>
                    {r.participantIds && r.participantIds.length > 0 && (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                        👥 {r.participantIds.map((id) => getUserName(id)).join('、')}
                      </div>
                    )}
                    {r.tags && r.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {r.tags.map((tag: any) => (
                          <span
                            key={tag.id}
                            style={{
                              padding: '2px 8px',
                              background: `${tag.color}20`,
                              border: `1px solid ${tag.color}40`,
                              color: tag.color,
                              borderRadius: 10,
                              fontSize: 10,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                    <button
                      onClick={() => handleCopyToForm(r)}
                      style={{
                        padding: '4px 10px',
                        background: 'transparent',
                        border: '1px solid #3498db',
                        borderRadius: 4,
                        color: '#3498db',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      编辑后创建
                    </button>
                    <button
                      onClick={() => handleCopySingle(r.id)}
                      disabled={copyingId === r.id}
                      style={{
                        padding: '4px 10px',
                        background: '#2ecc71',
                        border: 'none',
                        borderRadius: 4,
                        color: '#fff',
                        cursor: copyingId === r.id ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        opacity: copyingId === r.id ? 0.6 : 1,
                      }}
                    >
                      {copyingId === r.id ? '复制中...' : '直接复制'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #333', fontSize: 12, color: '#666' }}>
            💡 提示：
            <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
              <li>「直接复制」会自动将时间加7天，立即创建新排练</li>
              <li>「编辑后创建」会填充到表单中，可修改后再提交</li>
              <li>复制时会自动检查地点冲突，冲突的排练会被跳过</li>
              <li>参与人、地点、素材都会自动带出</li>
            </ul>
          </div>
        </div>
      )}

      {!isMobile && showFilters && (
        <div style={{
          background: colors.bgSecondary,
          padding: 16,
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          marginBottom: 24,
        }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isTablet ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
              gap: 12,
              alignItems: 'end',
            }}
          >
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
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>✅ 签到状态</div>
              <select
                value={filters.attendanceStatus}
                onChange={(e) => setFilters({ ...filters, attendanceStatus: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">全部状态</option>
                <option value="present">出勤</option>
                <option value="absent">缺席</option>
                <option value="late">迟到</option>
                <option value="pending">未签到</option>
              </select>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>⏰ 时间段</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="time"
                  value={filters.timeSlotStart}
                  onChange={(e) => setFilters({ ...filters, timeSlotStart: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <span style={{ color: '#666' }}>-</span>
                <input
                  type="time"
                  value={filters.timeSlotEnd}
                  onChange={(e) => setFilters({ ...filters, timeSlotEnd: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
          </div>

          {availableTags.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #333' }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
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
                    清除
                  </button>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #333' }}>
            <div style={{ color: '#666', fontSize: 13 }}>
              当前筛选结果：<span style={{ color: '#3498db' }}>{filteredRehearsals.length}</span> 条排练
              {filters.attendanceStatus && !filters.participantId && (
                <span style={{ color: '#95a5a6', marginLeft: 8 }}>（全局搜索：含任意匹配的参与者）</span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid #666',
                  borderRadius: 6,
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                重置筛选
              </button>
            )}
          </div>
        </div>
      )}

      {!isMobile && showForm && canEdit && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: colors.bgSecondary,
            padding: 20,
            borderRadius: radius.lg,
            border: `1px solid ${colors.border}`,
            marginBottom: 24,
            display: 'grid',
            gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr',
            gap: 12,
          }}
        >
          <h3 style={{ gridColumn: '1 / -1', margin: '0 0 8px', color: '#e0e0e0', fontSize: 16 }}>
            {editingId ? '✏️ 编辑排练' : '➕ 创建新排练'}
          </h3>

          <input placeholder="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} />
          <input
            placeholder="地点"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            style={{
              ...inputStyle,
              borderColor: conflictInfo?.locationConflicts?.length ? '#e74c3c' : undefined,
              boxShadow: conflictInfo?.locationConflicts?.length ? '0 0 0 2px rgba(231, 76, 60, 0.2)' : undefined,
            }}
          />
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            required
            style={{
              ...inputStyle,
              borderColor: (conflictInfo?.locationConflicts?.length || conflictInfo?.timeConflicts?.length || conflictInfo?.participantConflicts?.length) ? '#e74c3c' : undefined,
              boxShadow: (conflictInfo?.locationConflicts?.length || conflictInfo?.timeConflicts?.length || conflictInfo?.participantConflicts?.length) ? '0 0 0 2px rgba(231, 76, 60, 0.2)' : undefined,
            }}
          />
          <input
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            required
            style={{
              ...inputStyle,
              borderColor: (conflictInfo?.locationConflicts?.length || conflictInfo?.timeConflicts?.length || conflictInfo?.participantConflicts?.length) ? '#e74c3c' : undefined,
              boxShadow: (conflictInfo?.locationConflicts?.length || conflictInfo?.timeConflicts?.length || conflictInfo?.participantConflicts?.length) ? '0 0 0 2px rgba(231, 76, 60, 0.2)' : undefined,
            }}
          />
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

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 6 }}>📁 关联素材（可选）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {materials.length === 0 && <span style={{ color: '#555', fontSize: 12 }}>暂无素材，请先到素材库上传</span>}
              {materials.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: form.materialIds.includes(m.id) ? 'rgba(52, 152, 219, 0.2)' : '#222',
                    border: `1px solid ${form.materialIds.includes(m.id) ? '#3498db' : '#444'}`,
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#e0e0e0',
                    maxWidth: 260,
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
                    maxWidth: 220,
                  }}>
                    {m.originalName}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {checkingConflict && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'rgba(52, 152, 219, 0.1)', border: '1px solid #3498db', borderRadius: 6, color: '#3498db', fontSize: 13 }}>
              ⏳ 正在检查时间、地点和参与人冲突...
            </div>
          )}

          {!checkingConflict && conflictInfo && conflictInfo.hasConflict && (
            <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: 6 }}>
              <div style={{ color: '#e74c3c', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>⚠️ 检测到冲突：</div>
              {conflictInfo.locationConflicts && conflictInfo.locationConflicts.length > 0 && (
                <div style={{ color: '#e0e0e0', fontSize: 13, marginBottom: 6 }}>
                  📍 地点占用（{conflictInfo.locationConflicts.length}个）：
                  {conflictInfo.locationConflicts.map((r) => `「${r.title}」(${formatDate(r.startTime)})`).join('、')}
                </div>
              )}
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
              <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>提示：地点冲突将阻止提交，其他冲突仅为提醒。</div>
            </div>
          )}

          {!checkingConflict && conflictInfo && !conflictInfo.hasConflict && form.startTime && form.endTime && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', borderRadius: 6, color: '#2ecc71', fontSize: 13 }}>
              ✅ 无时间冲突，参与人都空闲{form.location && '，地点可用'}
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? spacing.md : 12,
        }}
      >
        {filteredRehearsals.map((r, idx) => {
          const isHighlighted = highlightedRehearsalId === r.id;
          return (
            <div
              key={r.id}
              ref={(el) => {
                rehearsalRefs.current[r.id] = el;
              }}
              style={{
                background: colors.bgSecondary,
                borderRadius: isMobile ? radius.lg : 8,
                border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${colorPool[idx % colorPool.length]}`,
                padding: isMobile ? spacing.md : 16,
                ...(isHighlighted
                  ? { borderColor: colors.warning, boxShadow: `0 0 12px ${colors.warning}40` }
                  : {}),
                transition: 'all 0.3s ease',
                scrollMarginTop: isMobile ? 120 : 80,
              }}
            >
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'flex-start',
                gap: isMobile ? spacing.sm : 0,
              }}
            >
              <div style={{ flex: 1, width: isMobile ? '100%' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, color: colors.text, fontSize: isMobile ? fontSize.md : 16 }}>{r.title}</h3>
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

                {r.participants && r.participants.length > 0 && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'rgba(52, 152, 219, 0.06)',
                    border: '1px solid rgba(52, 152, 219, 0.2)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ color: '#3498db', fontWeight: 600 }}>
                        签到: 出勤{r.presentCount || 0} | 缺席{r.absentCount || 0} | 迟到{r.lateCount || 0} | 未签{r.pendingAttendanceCount || 0}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => toggleRolesExpand(r.id)}
                          style={{
                            padding: '2px 8px',
                            background: 'transparent',
                            border: '1px solid #9b59b6',
                            borderRadius: 4,
                            color: '#9b59b6',
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          {expandedRolesId === r.id ? '收起角色' : '角色分工'}
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => toggleAttendanceExpand(r.id)}
                            style={{
                              padding: '2px 8px',
                              background: 'transparent',
                              border: '1px solid #3498db',
                              borderRadius: 4,
                              color: '#3498db',
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                          >
                            {expandedRehearsalId === r.id ? '收起签到' : '管理签到'}
                          </button>
                        )}
                      </div>
                    </div>

                    {expandedRehearsalId === r.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(52, 152, 219, 0.2)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {r.participants.map((p) => (
                            <div key={p.userId} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '6px 8px',
                              background: '#222',
                              borderRadius: 4,
                            }}>
                              <div style={{ flex: 1, color: '#e0e0e0' }}>
                                {p.displayName || p.userName}
                                <span style={{ color: '#666', marginLeft: 6, fontSize: 11 }}>
                                  ({p.roleName || '演员'})
                                </span>
                                {p.isOnLeave && (
                                  <span style={{
                                    marginLeft: 8,
                                    padding: '1px 6px',
                                    background: 'rgba(230, 126, 34, 0.2)',
                                    border: '1px solid #e67e22',
                                    borderRadius: 8,
                                    color: '#e67e22',
                                    fontSize: 10,
                                  }}>
                                    请假中
                                  </span>
                                )}
                              </div>
                              <select
                                value={attendanceEdits[p.userId]?.status ?? ''}
                                onChange={(e) => updateAttendanceEdit(p.userId, 'status', e.target.value || null)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#1a1a1a',
                                  border: '1px solid #444',
                                  borderRadius: 4,
                                  color: '#e0e0e0',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="">未签到</option>
                                <option value="present">出勤</option>
                                <option value="late">迟到</option>
                                <option value="absent">缺席</option>
                              </select>
                              {attendanceEdits[p.userId]?.status === 'absent' && (
                                <input
                                  placeholder="缺席原因"
                                  value={attendanceEdits[p.userId]?.absentReason || ''}
                                  onChange={(e) => updateAttendanceEdit(p.userId, 'absentReason', e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 8px',
                                    background: '#1a1a1a',
                                    border: '1px solid #444',
                                    borderRadius: 4,
                                    color: '#e0e0e0',
                                    fontSize: 12,
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                          <button
                            onClick={() => toggleAttendanceExpand(r.id)}
                            style={{
                              padding: '6px 14px',
                              background: 'transparent',
                              border: '1px solid #555',
                              borderRadius: 4,
                              color: '#aaa',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            取消
                          </button>
                          <button
                            onClick={() => saveAttendance(r.id)}
                            disabled={savingAttendance}
                            style={{
                              padding: '6px 14px',
                              background: '#2ecc71',
                              border: 'none',
                              borderRadius: 4,
                              color: '#fff',
                              cursor: savingAttendance ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              opacity: savingAttendance ? 0.6 : 1,
                            }}
                          >
                            {savingAttendance ? '保存中...' : '保存签到'}
                          </button>
                        </div>
                      </div>
                    )}

                    {expandedRolesId === r.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(155, 89, 182, 0.2)' }}>
                        {loadingRoles[r.id] && (
                          <div style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: 8 }}>
                            加载中...
                          </div>
                        )}
                        {!loadingRoles[r.id] && roleAssignments[r.id]?.length === 0 && (
                          <div style={{ textAlign: 'center', color: '#666', fontSize: 12, padding: 8 }}>
                            暂无角色分工
                          </div>
                        )}
                        {!loadingRoles[r.id] && roleAssignments[r.id]?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {roleAssignments[r.id].map((role: any) => (
                              <div key={role.roleId} style={{
                                background: '#222',
                                padding: '8px 10px',
                                borderRadius: 4,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <span style={{
                                    color: '#e74c3c',
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}>
                                    {role.characterName}
                                  </span>
                                  {role.characterDescription && (
                                    <span style={{ color: '#666', fontSize: 11 }}>
                                      {role.characterDescription}
                                    </span>
                                  )}
                                </div>
                                {role.mainActor && (
                                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                                    <span style={{ color: '#888' }}>主演: </span>
                                    <span style={{
                                      color: role.mainActor.isParticipating ? '#e0e0e0' : '#666',
                                      textDecoration: role.mainActor.isParticipating ? 'none' : 'line-through',
                                    }}>
                                      {role.mainActor.displayName || role.mainActor.username}
                                      {!role.mainActor.isParticipating && ' (未参加)'}
                                    </span>
                                    {role.mainActor.attendanceStatus && (
                                      <span style={{
                                        marginLeft: 6,
                                        padding: '1px 6px',
                                        background: role.mainActor.attendanceStatus === 'present'
                                          ? 'rgba(46, 204, 113, 0.2)'
                                          : role.mainActor.attendanceStatus === 'absent'
                                          ? 'rgba(231, 76, 60, 0.2)'
                                          : 'rgba(243, 156, 18, 0.2)',
                                        border: `1px solid ${role.mainActor.attendanceStatus === 'present'
                                          ? '#2ecc71'
                                          : role.mainActor.attendanceStatus === 'absent'
                                          ? '#e74c3c'
                                          : '#f39c12'}`,
                                        color: role.mainActor.attendanceStatus === 'present'
                                          ? '#2ecc71'
                                          : role.mainActor.attendanceStatus === 'absent'
                                          ? '#e74c3c'
                                          : '#f39c12',
                                        borderRadius: 8,
                                        fontSize: 10,
                                      }}>
                                        {role.mainActor.attendanceStatus === 'present' ? '出勤' :
                                         role.mainActor.attendanceStatus === 'absent' ? '缺席' : '迟到'}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {role.substitutes && role.substitutes.length > 0 && (
                                  <div style={{ fontSize: 12 }}>
                                    <span style={{ color: '#888' }}>替补: </span>
                                    {role.substitutes.map((sub: any, idx: number) => (
                                      <span key={sub.id}>
                                        {idx > 0 && '、'}
                                        <span style={{
                                          color: sub.isParticipating ? '#f39c12' : '#666',
                                          textDecoration: sub.isParticipating ? 'none' : 'line-through',
                                        }}>
                                          {sub.displayName || sub.username}
                                          {!sub.isParticipating && ' (未参加)'}
                                        </span>
                                        {sub.attendanceStatus && (
                                          <span style={{
                                            marginLeft: 4,
                                            padding: '1px 4px',
                                            background: sub.attendanceStatus === 'present'
                                              ? 'rgba(46, 204, 113, 0.2)'
                                              : sub.attendanceStatus === 'absent'
                                              ? 'rgba(231, 76, 60, 0.2)'
                                              : 'rgba(243, 156, 18, 0.2)',
                                            border: `1px solid ${sub.attendanceStatus === 'present'
                                              ? '#2ecc71'
                                              : sub.attendanceStatus === 'absent'
                                              ? '#e74c3c'
                                              : '#f39c12'}`,
                                            color: sub.attendanceStatus === 'present'
                                              ? '#2ecc71'
                                              : sub.attendanceStatus === 'absent'
                                              ? '#e74c3c'
                                              : '#f39c12',
                                            borderRadius: 6,
                                            fontSize: 10,
                                          }}>
                                            {sub.attendanceStatus === 'present' ? '出' :
                                             sub.attendanceStatus === 'absent' ? '缺' : '迟'}
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {expandedRehearsalId !== r.id && r.participants.filter((p) => p.attendanceStatus === 'absent').length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {r.participants.filter((p) => p.attendanceStatus === 'absent').map((p) => (
                          <div key={p.userId} style={{ color: '#e74c3c', marginTop: 2, fontSize: 11 }}>
                            • {p.displayName || p.userName} 缺席
                            {p.absentReason && `：${p.absentReason}`}
                          </div>
                        ))}
                      </div>
                    )}
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

                {r.materialIds && r.materialIds.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <div style={{ color: '#888', marginBottom: 4 }}>
                      📁 关联素材 ({r.materialIds.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.materialIds.map((mid) => {
                        const m = materials.find((x) => x.id === mid);
                        return (
                          <span
                            key={mid}
                            style={{
                              padding: '2px 8px',
                              background: 'rgba(52, 152, 219, 0.1)',
                              border: '1px solid rgba(52, 152, 219, 0.3)',
                              color: '#3498db',
                              borderRadius: 10,
                              fontSize: 11,
                            }}
                            title={m?.originalName}
                          >
                            {m ? m.originalName.slice(0, 20) + (m.originalName.length > 20 ? '...' : '') : `素材#${mid}`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {r.hasConflict && r.locationConflicts && r.locationConflicts.length > 0 && (
                  <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8, padding: '6px 10px', background: 'rgba(231, 76, 60, 0.08)', borderRadius: 4 }}>
                    📍 地点占用冲突：与 {r.locationConflicts.map((x) => `「${x.title}」(${formatDate(x.startTime)})`).join('、')} 冲突
                  </div>
                )}
                {r.hasConflict && r.participantConflicts && r.participantConflicts.length > 0 && (
                  <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8, padding: '6px 10px', background: 'rgba(231, 76, 60, 0.08)', borderRadius: 4 }}>
                    冲突详情：{r.participantConflicts.map((p) => `${p.userName || '用户#' + p.userId}在${p.conflictingRehearsals.map((x) => x.title).join('、')}有安排`).join('；')}
                  </div>
                )}
                {r.hasConflict && r.timeConflicts && r.timeConflicts.length > 0 && (!r.participantConflicts || r.participantConflicts.length === 0) && (!r.locationConflicts || r.locationConflicts.length === 0) && (
                  <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8, padding: '6px 10px', background: 'rgba(231, 76, 60, 0.08)', borderRadius: 4 }}>
                    时间与其他排练冲突：{r.timeConflicts.map((x) => x.title).join('、')}
                  </div>
                )}
              </div>
              {canEdit && (
                <div
                  style={{
                    display: 'flex',
                    gap: isMobile ? spacing.sm : 6,
                    marginLeft: isMobile ? 0 : 12,
                    alignSelf: isMobile ? 'flex-end' : 'flex-start',
                    width: isMobile ? '100%' : undefined,
                    justifyContent: isMobile ? 'flex-end' : undefined,
                  }}
                >
                  <button
                    onClick={() => (isMobile ? setShowForm(true) : null, startEdit(r))}
                    style={{
                      ...editBtnStyle,
                      padding: isMobile ? `${spacing.sm + 2}px ${spacing.md}px` : editBtnStyle.padding,
                      fontSize: isMobile ? fontSize.sm : editBtnStyle.fontSize as number,
                      minHeight: isMobile ? 40 : 0,
                    }}
                  >
                    {isMobile ? '✏️ 编辑' : '编辑'}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{
                      ...deleteBtnStyle,
                      padding: isMobile ? `${spacing.sm + 2}px ${spacing.md}px` : deleteBtnStyle.padding,
                      fontSize: isMobile ? fontSize.sm : deleteBtnStyle.fontSize as number,
                      minHeight: isMobile ? 40 : 0,
                    }}
                  >
                    {isMobile ? '🗑️ 删除' : '删除'}
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })}
        {filteredRehearsals.length === 0 && (
          <EmptyState
            icon="📅"
            title={
              hasActiveFilters
                ? '没有符合筛选条件的排练'
                : '暂无排练安排'
            }
            description={
              hasActiveFilters
                ? '请尝试调整筛选条件'
                : canEdit
                  ? '点击右上角按钮创建第一个排练'
                  : '暂无排练数据，请等待导演安排'
            }
            action={
              canEdit && !hasActiveFilters
                ? {
                    label: '➕ 创建排练',
                    onClick: () => setShowForm(true),
                    variant: 'primary' as const,
                  }
                : undefined
            }
          />
        )}
      </div>

      {isMobile && (
        <BottomSheet
          isOpen={showForm && canEdit}
          onClose={resetForm}
          title={editingId ? '✏️ 编辑排练' : '➕ 创建新排练'}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.md,
            }}
          >
            <input
              placeholder="标题"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              style={{ ...inputStyle, fontSize: fontSize.lg, padding: `${spacing.md}px ${spacing.md}px` }}
            />
            <input
              placeholder="地点"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              style={{
                ...inputStyle,
                fontSize: fontSize.lg,
                padding: `${spacing.md}px ${spacing.md}px`,
                borderColor: conflictInfo?.locationConflicts?.length
                  ? colors.danger
                  : undefined,
                boxShadow: conflictInfo?.locationConflicts?.length
                  ? `0 0 0 2px ${colors.danger}20`
                  : undefined,
              }}
            />
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
              style={{
                ...inputStyle,
                fontSize: fontSize.lg,
                padding: `${spacing.md}px ${spacing.md}px`,
              }}
            />
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
              style={{
                ...inputStyle,
                fontSize: fontSize.lg,
                padding: `${spacing.md}px ${spacing.md}px`,
              }}
            />
            <textarea
              placeholder="描述"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{
                ...inputStyle,
                minHeight: 80,
                fontSize: fontSize.lg,
                padding: `${spacing.md}px ${spacing.md}px`,
              }}
            />

            <div>
              <div style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm }}>
                👥 参与人（可选）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                {users.map((u) => (
                  <label
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      background: form.participantIds.includes(u.id)
                        ? `${colors.primary}20`
                        : colors.bgTertiary,
                      border: `1px solid ${
                        form.participantIds.includes(u.id) ? colors.primary : colors.borderLight
                      }`,
                      borderRadius: radius.full,
                      cursor: 'pointer',
                      fontSize: fontSize.sm,
                      color: colors.text,
                      minHeight: 40,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.participantIds.includes(u.id)}
                      onChange={() => toggleParticipant(u.id)}
                      style={{ accentColor: colors.primary }}
                    />
                    {u.displayName || u.username}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm }}>
                📁 关联素材（可选）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                {materials.length === 0 && (
                  <span style={{ color: colors.textFaint, fontSize: fontSize.sm }}>
                    暂无素材
                  </span>
                )}
                {materials.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      background: form.materialIds.includes(m.id)
                        ? `${colors.accent}20`
                        : colors.bgTertiary,
                      border: `1px solid ${
                        form.materialIds.includes(m.id) ? colors.accent : colors.borderLight
                      }`,
                      borderRadius: radius.full,
                      cursor: 'pointer',
                      fontSize: fontSize.sm,
                      color: colors.text,
                      maxWidth: '100%',
                      minHeight: 40,
                    }}
                    title={m.originalName}
                  >
                    <input
                      type="checkbox"
                      checked={form.materialIds.includes(m.id)}
                      onChange={() => toggleMaterial(m.id)}
                      style={{ accentColor: colors.accent }}
                    />
                    <span className="ellipsis" style={{ maxWidth: 200 }}>
                      {m.originalName}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {checkingConflict && (
              <div
                style={{
                  padding: spacing.md,
                  background: `${colors.info}10`,
                  border: `1px solid ${colors.info}`,
                  borderRadius: radius.md,
                  color: colors.info,
                  fontSize: fontSize.sm,
                }}
              >
                ⏳ 正在检查时间、地点和参与人冲突...
              </div>
            )}

            {!checkingConflict && conflictInfo && conflictInfo.hasConflict && (
              <div
                style={{
                  padding: spacing.md,
                  background: `${colors.danger}10`,
                  border: `1px solid ${colors.danger}`,
                  borderRadius: radius.md,
                  fontSize: fontSize.sm,
                }}
              >
                <div style={{ color: colors.danger, fontWeight: 600, marginBottom: 6 }}>
                  ⚠️ 检测到冲突
                </div>
                {conflictInfo.locationConflicts?.length ? (
                  <div style={{ color: colors.text, marginTop: 4 }}>
                    📍 地点冲突：{conflictInfo.locationConflicts.map((r) => r.title).join('、')}
                  </div>
                ) : null}
                {conflictInfo.timeConflicts?.length ? (
                  <div style={{ color: colors.text, marginTop: 4 }}>
                    📅 时间冲突：{conflictInfo.timeConflicts.map((r) => r.title).join('、')}
                  </div>
                ) : null}
                {conflictInfo.participantConflicts?.length ? (
                  <div style={{ color: colors.text, marginTop: 4 }}>
                    👥 参与人冲突：{conflictInfo.participantConflicts.map((p) => p.userName || '用户').join('、')}
                  </div>
                ) : null}
              </div>
            )}

            {!checkingConflict &&
              conflictInfo &&
              !conflictInfo.hasConflict &&
              form.startTime &&
              form.endTime && (
                <div
                  style={{
                    padding: spacing.md,
                    background: `${colors.success}10`,
                    border: `1px solid ${colors.success}`,
                    borderRadius: radius.md,
                    color: colors.success,
                    fontSize: fontSize.sm,
                  }}
                >
                  ✅ 无时间冲突，参与人都空闲
                </div>
              )}

            {error && (
              <div
                style={{
                  padding: spacing.md,
                  background: `${colors.danger}20`,
                  border: `1px solid ${colors.danger}`,
                  borderRadius: radius.md,
                  color: colors.danger,
                  fontSize: fontSize.sm,
                }}
              >
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.sm }}>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  flex: 1,
                  padding: `${spacing.md}px`,
                  background: 'transparent',
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: radius.md,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                  minHeight: 48,
                }}
              >
                取消
              </button>
              <button
                type="submit"
                style={{
                  flex: 2,
                  padding: `${spacing.md}px`,
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
                {editingId ? '保存修改' : '创建排练'}
              </button>
            </div>
          </form>
        </BottomSheet>
      )}

      {isMobile && (
        <BottomSheet
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          title="🔍 筛选排练"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div>
              <label style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, display: 'block' }}>
                📍 地点
              </label>
              <input
                placeholder="输入地点关键词"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                style={{ ...inputStyle, fontSize: fontSize.lg, padding: `${spacing.md}px ${spacing.md}px` }}
              />
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, display: 'block' }}>
                👤 演员
              </label>
              <select
                value={filters.participantId ?? ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    participantId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                style={{ ...inputStyle, fontSize: fontSize.lg, padding: `${spacing.md}px ${spacing.md}px` }}
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
              <label style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, display: 'block' }}>
                ✅ 签到状态
              </label>
              <select
                value={filters.attendanceStatus}
                onChange={(e) => setFilters({ ...filters, attendanceStatus: e.target.value })}
                style={{ ...inputStyle, fontSize: fontSize.lg, padding: `${spacing.md}px ${spacing.md}px` }}
              >
                <option value="">全部状态</option>
                <option value="present">出勤</option>
                <option value="absent">缺席</option>
                <option value="late">迟到</option>
                <option value="pending">未签到</option>
              </select>
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, display: 'block' }}>
                ⏰ 时间段
              </label>
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                <input
                  type="time"
                  value={filters.timeSlotStart}
                  onChange={(e) => setFilters({ ...filters, timeSlotStart: e.target.value })}
                  style={{ ...inputStyle, flex: 1, fontSize: fontSize.lg, padding: `${spacing.md}px ${spacing.md}px` }}
                />
                <span style={{ color: colors.textMuted }}>-</span>
                <input
                  type="time"
                  value={filters.timeSlotEnd}
                  onChange={(e) => setFilters({ ...filters, timeSlotEnd: e.target.value })}
                  style={{ ...inputStyle, flex: 1, fontSize: fontSize.lg, padding: `${spacing.md}px ${spacing.md}px` }}
                />
              </div>
            </div>

            {availableTags.length > 0 && (
              <div>
                <div style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm }}>
                  🏷️ 标签筛选 {selectedTagIds.length > 0 && `(${selectedTagIds.length})`}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                  {availableTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          setSelectedTagIds((prev) =>
                            selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: radius.full,
                          border: `1px solid ${selected ? tag.color : colors.borderLight}`,
                          background: selected ? `${tag.color}20` : 'transparent',
                          color: selected ? tag.color : colors.textSecondary,
                          fontSize: fontSize.sm,
                          cursor: 'pointer',
                          minHeight: 40,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: tag.color,
                            display: 'inline-block',
                            marginRight: 6,
                          }}
                        />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ color: colors.textFaint, fontSize: fontSize.sm }}>
              当前筛选结果：<span style={{ color: colors.info }}>{filteredRehearsals.length}</span> 条排练
            </div>

            <div style={{ display: 'flex', gap: spacing.md }}>
              <button
                onClick={() => {
                  resetFilters();
                  setShowFilters(false);
                }}
                style={{
                  flex: 1,
                  padding: `${spacing.md}px`,
                  background: 'transparent',
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: radius.md,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                  minHeight: 48,
                }}
              >
                重置
              </button>
              <button
                onClick={() => {
                  load();
                  setShowFilters(false);
                }}
                style={{
                  flex: 2,
                  padding: `${spacing.md}px`,
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

      {isMobile && (
        <BottomSheet
          isOpen={showCopyPanel && canEdit}
          onClose={() => setShowCopyPanel(false)}
          title="📋 复制上周安排"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <div
              style={{
                display: 'flex',
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <button
                onClick={handleCopyAll}
                disabled={copyingAll || lastWeekRehearsals.length === 0}
                style={{
                  flex: 1,
                  padding: `${spacing.md}px`,
                  background: colors.secondary,
                  border: 'none',
                  borderRadius: radius.md,
                  color: colors.textInverse,
                  cursor:
                    copyingAll || lastWeekRehearsals.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: fontSize.md,
                  minHeight: 48,
                  opacity: copyingAll || lastWeekRehearsals.length === 0 ? 0.6 : 1,
                }}
              >
                {copyingAll ? '复制中...' : '一键复制全部'}
              </button>
            </div>

            {loadingLastWeek && (
              <div style={{ textAlign: 'center', padding: spacing.xxxl, color: colors.textMuted }}>
                ⏳ 加载上周排练中...
              </div>
            )}

            {!loadingLastWeek && lastWeekRehearsals.length === 0 && (
              <EmptyState
                icon="📭"
                title="上周没有排练安排"
                description="没有可以复制的内容"
              />
            )}

            {!loadingLastWeek && lastWeekRehearsals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                {lastWeekRehearsals.map((r, idx) => (
                  <div
                    key={r.id}
                    style={{
                      background: colors.bgTertiary,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      borderLeft: `3px solid ${colorPool[idx % colorPool.length]}`,
                    }}
                  >
                    <div style={{ color: colors.text, fontWeight: 500, marginBottom: 4 }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                      {formatDate(r.startTime).slice(5)} → {formatDate(r.endTime).slice(10)}
                      {r.location && <span style={{ marginLeft: 8 }}>📍 {r.location}</span>}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: spacing.sm,
                        marginTop: spacing.md,
                      }}
                    >
                      <button
                        onClick={() => handleCopyToForm(r)}
                        style={{
                          flex: 1,
                          padding: `${spacing.sm}px`,
                          background: 'transparent',
                          border: `1px solid ${colors.info}`,
                          borderRadius: radius.md,
                          color: colors.info,
                          cursor: 'pointer',
                          fontSize: fontSize.sm,
                          minHeight: 40,
                        }}
                      >
                        编辑后创建
                      </button>
                      <button
                        onClick={() => handleCopySingle(r.id)}
                        disabled={copyingId === r.id}
                        style={{
                          flex: 1,
                          padding: `${spacing.sm}px`,
                          background: colors.success,
                          border: 'none',
                          borderRadius: radius.md,
                          color: colors.textInverse,
                          cursor: copyingId === r.id ? 'not-allowed' : 'pointer',
                          fontSize: fontSize.sm,
                          minHeight: 40,
                          opacity: copyingId === r.id ? 0.6 : 1,
                        }}
                      >
                        {copyingId === r.id ? '复制中...' : '直接复制'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BottomSheet>
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
