import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface LeaveRequest {
  id: number;
  actorId: number;
  actorName?: string;
  type: string;
  reason?: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  roleId?: number;
  substituteActorId?: number;
  substituteActorName?: string;
  rejectionReason?: string;
  reviewedBy?: number;
  reviewerName?: string;
  reviewedAt?: string;
  createdBy?: number;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

const LEAVE_TYPES = [
  { value: 'sick', label: '病假' },
  { value: 'personal', label: '事假' },
  { value: 'other', label: '其他' },
];

const STATUS_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: '待审批', color: '#f39c12', bg: 'rgba(243, 156, 18, 0.1)' },
  approved: { text: '已批准', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' },
  rejected: { text: '已拒绝', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)' },
};

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [statistics, setStatistics] = useState<any>(null);
  const [form, setForm] = useState({
    type: 'other' as string,
    reason: '',
    startDate: '',
    endDate: '',
    roleId: 0,
    substituteActorId: 0,
  });
  const { user, isDirector, isAdmin } = useAuth();
  const canReview = isDirector || isAdmin;

  const load = async () => {
    const params: any = {};
    if (filter !== 'all') {
      params.status = filter;
    }

    const [leavesData, statsData] = await Promise.all([
      api.leaves.list(params),
      api.leaves.statistics(),
    ]);
    setLeaves(leavesData);
    setStatistics(statsData);
  };

  const loadUsersAndRoles = async () => {
    const [usersData, rolesData] = await Promise.all([
      api.users.list(),
      api.roles.list(),
    ]);
    setUsers(usersData);
    setRoles(rolesData);
  };

  useEffect(() => {
    load();
    loadUsersAndRoles();
  }, [filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.leaves.create({
        ...form,
        roleId: form.roleId || undefined,
        substituteActorId: form.substituteActorId || undefined,
      });
      setForm({
        type: 'other',
        reason: '',
        startDate: '',
        endDate: '',
        roleId: 0,
        substituteActorId: 0,
      });
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e.message || '提交失败');
    }
  };

  const handleApprove = async (id: number, substituteActorId?: number) => {
    if (!confirm('确定要批准这个请假申请吗？')) return;
    try {
      await api.leaves.approve(id, substituteActorId || undefined);
      load();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('请输入拒绝原因：');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('请填写拒绝原因');
      return;
    }
    try {
      await api.leaves.reject(id, reason);
      load();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个请假记录吗？')) return;
    try {
      await api.leaves.remove(id);
      load();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');
  const formatDateShort = (d: string) => new Date(d).toLocaleDateString('zh-CN');

  const getLeaveTypeLabel = (type: string) => {
    return LEAVE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getUserName = (id?: number) => {
    if (!id) return '-';
    const u = users.find((x) => x.id === id);
    return u?.displayName || u?.username || `#${id}`;
  };

  const getRoleName = (id?: number) => {
    if (!id) return '-';
    const r = roles.find((x) => x.id === id);
    return r?.characterName || `#${id}`;
  };

  const actorUsers = users.filter((u) => u.role === 'actor');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, color: '#e0e0e0' }}>请假管理</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
          {showForm ? '取消' : '+ 申请请假'}
        </button>
      </div>

      {statistics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e74c3c' }}>{statistics.total}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>总请假数</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f39c12' }}>{statistics.pending}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>待审批</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2ecc71' }}>{statistics.approved}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>已批准</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#9b59b6' }}>{statistics.activeLeaves}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>进行中</div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={formStyle}>
          <h3 style={{ margin: '0 0 12px', color: '#e0e0e0', fontSize: 16 }}>申请请假</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>请假类型</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={inputStyle}
                required
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>关联角色（可选）</label>
              <select
                value={form.roleId || 0}
                onChange={(e) => setForm({ ...form, roleId: Number(e.target.value) })}
                style={inputStyle}
              >
                <option value={0}>-- 不关联角色 --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.characterName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>开始时间</label>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>结束时间</label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                style={inputStyle}
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>期望替补演员（可选）</label>
              <select
                value={form.substituteActorId || 0}
                onChange={(e) => setForm({ ...form, substituteActorId: Number(e.target.value) })}
                style={inputStyle}
              >
                <option value={0}>-- 暂无 --</option>
                {actorUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>请假原因</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              style={{ ...inputStyle, minHeight: 80 }}
              placeholder="请描述请假原因..."
            />
          </div>

          <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #555', borderRadius: 6, color: '#aaa', cursor: 'pointer' }}
            >
              取消
            </button>
            <button type="submit" style={primaryBtnStyle}>提交申请</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: '全部' },
          { value: 'pending', label: '待审批' },
          { value: 'approved', label: '已批准' },
          { value: 'rejected', label: '已拒绝' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px',
              background: filter === f.value ? 'rgba(231, 76, 60, 0.2)' : 'transparent',
              border: `1px solid ${filter === f.value ? '#e74c3c' : '#444'}`,
              color: filter === f.value ? '#e74c3c' : '#aaa',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {leaves.map((leave) => {
          const status = STATUS_LABELS[leave.status] || STATUS_LABELS.pending;
          return (
            <div key={leave.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 15 }}>
                      {getLeaveTypeLabel(leave.type)}
                    </h3>
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

                  <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>
                    📅 {formatDateShort(leave.startDate)} ~ {formatDateShort(leave.endDate)}
                  </div>

                  <div style={{ fontSize: 13, color: '#aaa' }}>
                    申请人: <strong style={{ color: '#e0e0e0' }}>{leave.actorName || getUserName(leave.actorId)}</strong>
                  </div>

                  {leave.roleId && (
                    <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
                      角色: {getRoleName(leave.roleId)}
                    </div>
                  )}

                  {leave.substituteActorId && (
                    <div style={{ fontSize: 13, color: '#2ecc71', marginTop: 4 }}>
                      替补: {leave.substituteActorName || getUserName(leave.substituteActorId)}
                    </div>
                  )}

                  {leave.reason && (
                    <p style={{ fontSize: 13, color: '#666', margin: '8px 0 0' }}>
                      原因: {leave.reason}
                    </p>
                  )}

                  {leave.status === 'rejected' && leave.rejectionReason && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      background: 'rgba(231, 76, 60, 0.08)',
                      border: '1px solid rgba(231, 76, 60, 0.3)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#e74c3c',
                    }}>
                      拒绝原因: {leave.rejectionReason}
                    </div>
                  )}

                  {leave.reviewedAt && (
                    <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
                      由 {leave.reviewerName || getUserName(leave.reviewedBy)} 于 {formatDate(leave.reviewedAt)} 审批
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 12 }}>
                  {canReview && leave.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(leave.id, leave.substituteActorId || undefined)}
                        style={approveBtnStyle}
                      >
                        批准
                      </button>
                      <button
                        onClick={() => handleReject(leave.id)}
                        style={rejectBtnStyle}
                      >
                        拒绝
                      </button>
                    </>
                  )}
                  {canReview && (
                    <button
                      onClick={() => handleDelete(leave.id)}
                      style={deleteBtnStyle}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {leaves.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无请假记录</div>}
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

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #e74c3c',
  color: '#e74c3c',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const approveBtnStyle: React.CSSProperties = {
  background: 'rgba(46, 204, 113, 0.1)',
  border: '1px solid #2ecc71',
  color: '#2ecc71',
  padding: '4px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const rejectBtnStyle: React.CSSProperties = {
  background: 'rgba(231, 76, 60, 0.1)',
  border: '1px solid #e74c3c',
  color: '#e74c3c',
  padding: '4px 12px',
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

const statCardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 16,
  textAlign: 'center',
};
