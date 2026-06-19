import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface User {
  id: number;
  username: string;
  role: string;
  displayName: string;
  status: string;
  frozenAt: string | null;
  createdAt: string;
}

interface AuditLogEntry {
  id: number;
  action: string;
  operatorId: number;
  operatorName: string;
  targetUserId: number;
  targetUsername: string;
  detail: string;
  createdAt: string;
}

interface MaterialItem {
  id: number;
  originalName: string;
  categories: string[];
  tags: string[];
  downloadRoles: string[];
  description: string;
  mimeType: string;
  size: number;
  category: string;
}

const ROLES = [
  { value: 'admin', label: '管理员' },
  { value: 'director', label: '导演' },
  { value: 'actor', label: '演员' },
  { value: 'viewer', label: '观察者' },
];

const ROLE_LABELS: Record<string, string> = { admin: '管理员', director: '导演', actor: '演员', viewer: '观察者' };

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'actor', displayName: '' });
  const [leaveStats, setLeaveStats] = useState<any>(null);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [overview, setOverview] = useState<any>(null);

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{ categories: string; tags: string; downloadRoles: string[]; description: string }>({
    categories: '', tags: '', downloadRoles: [], description: '',
  });

  const load = async () => {
    const [usersData, statsData, attendanceData, logsData, overviewData] = await Promise.all([
      api.users.list(),
      api.leaves.statistics(),
      api.rehearsals.getStatistics(),
      api.auditLogs.list({ limit: 50 }),
      api.dashboard.overview(),
    ]);
    setUsers(usersData);
    setLeaveStats(statsData);
    setAttendanceStats(attendanceData);
    setAuditLogs(logsData.enriched || logsData.items || logsData);
    setOverview(overviewData);
  };

  const loadMaterials = async () => {
    const data = await api.materials.list();
    setMaterials(data);
  };

  useEffect(() => { load(); loadMaterials(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.auth.register(form);
    setForm({ username: '', password: '', role: 'actor', displayName: '' });
    setShowForm(false);
    load();
  };

  const handleRoleChange = async (id: number, role: string) => {
    await api.users.updateRole(id, role);
    load();
  };

  const handleDeleteUser = async (id: number) => {
    await api.users.remove(id);
    load();
  };

  const handleFreeze = async (id: number) => {
    await api.users.freeze(id);
    load();
  };

  const handleUnfreeze = async (id: number) => {
    await api.users.unfreeze(id);
    load();
  };

  const startEdit = (m: MaterialItem) => {
    setEditingId(m.id);
    setEditData({
      categories: (m.categories || []).join(', '),
      tags: (m.tags || []).join(', '),
      downloadRoles: m.downloadRoles || [],
      description: m.description || '',
    });
  };

  const saveEdit = async (id: number) => {
    const categories = editData.categories.split(',').map((c) => c.trim()).filter(Boolean);
    const tags = editData.tags.split(',').map((t) => t.trim()).filter(Boolean);
    await api.materials.update(id, {
      categories,
      category: categories[0] || 'general',
      tags,
      downloadRoles: editData.downloadRoles,
      description: editData.description,
    });
    setEditingId(null);
    loadMaterials();
  };

  const toggleEditRole = (role: string) => {
    setEditData((prev) => ({
      ...prev,
      downloadRoles: prev.downloadRoles.includes(role)
        ? prev.downloadRoles.filter((r) => r !== role)
        : [...prev.downloadRoles, role],
    }));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const roleLabel = (r: string) => ROLES.find((ro) => ro.value === r)?.label || r;

  return (
    <div>
      {overview && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 16px', color: '#e0e0e0', fontSize: 20 }}>📊 数据概览</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div
              onClick={() => navigate('/admin')}
              style={{ ...overviewCardStyle, borderLeftColor: '#3498db', cursor: 'pointer' }}
            >
              <div style={overviewCardHeader}>
                <span style={{ fontSize: 24 }}>👥</span>
                <span style={overviewCardLink}>查看 →</span>
              </div>
              <div style={overviewCardNumber}>{overview.users.total}</div>
              <div style={overviewCardLabel}>用户总数</div>
              <div style={overviewCardSubStats}>
                <span style={{ color: '#2ecc71' }}>● 活跃 {overview.users.active}</span>
                <span style={{ color: '#e74c3c' }}>● 冻结 {overview.users.frozen}</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/calendar')}
              style={{ ...overviewCardStyle, borderLeftColor: '#e74c3c', cursor: 'pointer' }}
            >
              <div style={overviewCardHeader}>
                <span style={{ fontSize: 24 }}>📅</span>
                <span style={overviewCardLink}>查看 →</span>
              </div>
              <div style={overviewCardNumber}>{overview.rehearsals.total}</div>
              <div style={overviewCardLabel}>排练总数</div>
              <div style={overviewCardSubStats}>
                <span style={{ color: '#f39c12' }}>● 本周 {overview.rehearsals.thisWeek}</span>
                <span style={{ color: '#2ecc71' }}>● 即将开始 {overview.rehearsals.upcoming}</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/roles')}
              style={{ ...overviewCardStyle, borderLeftColor: '#9b59b6', cursor: 'pointer' }}
            >
              <div style={overviewCardHeader}>
                <span style={{ fontSize: 24 }}>🎭</span>
                <span style={overviewCardLink}>查看 →</span>
              </div>
              <div style={overviewCardNumber}>{overview.roles.total}</div>
              <div style={overviewCardLabel}>角色总数</div>
              <div style={overviewCardSubStats}>
                <span style={{ color: '#2ecc71' }}>● 已分配 {overview.roles.withActor}</span>
                <span style={{ color: '#95a5a6' }}>● 有替补 {overview.roles.withSubstitutes}</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/materials')}
              style={{ ...overviewCardStyle, borderLeftColor: '#f39c12', cursor: 'pointer' }}
            >
              <div style={overviewCardHeader}>
                <span style={{ fontSize: 24 }}>📁</span>
                <span style={overviewCardLink}>查看 →</span>
              </div>
              <div style={overviewCardNumber}>{overview.materials.total}</div>
              <div style={overviewCardLabel}>素材总数</div>
              <div style={overviewCardSubStats}>
                <span style={{ color: '#3498db' }}>
                  总大小 {formatSize(overview.materials.totalSize)}
                </span>
              </div>
            </div>

            <div
              onClick={() => navigate('/annotations')}
              style={{ ...overviewCardStyle, borderLeftColor: '#1abc9c', cursor: 'pointer' }}
            >
              <div style={overviewCardHeader}>
                <span style={{ fontSize: 24 }}>📝</span>
                <span style={overviewCardLink}>查看 →</span>
              </div>
              <div style={overviewCardNumber}>{overview.annotations.total}</div>
              <div style={overviewCardLabel}>批注总数</div>
              <div style={overviewCardSubStats}>
                <span style={{ color: '#e67e22' }}>● {overview.annotations.scenes} 个场次</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>权限管理</h2>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtnStyle}>
          {showForm ? '取消' : '+ 新用户'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={formStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input placeholder="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required style={inputStyle} />
            <input placeholder="密码" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={inputStyle} />
            <input placeholder="显示名" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={inputStyle} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button type="submit" style={primaryBtnStyle}>创建</button>
          </div>
        </form>
      )}

      <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>用户名</th>
              <th style={thStyle}>显示名</th>
              <th style={thStyle}>角色</th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #222', opacity: u.status === 'frozen' ? 0.5 : 1 }}>
                <td style={tdStyle}>{u.id}</td>
                <td style={tdStyle}>{u.username}</td>
                <td style={tdStyle}>{u.displayName || '-'}</td>
                <td style={tdStyle}>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    style={{ ...inputStyle, padding: '4px 8px', width: 'auto' }}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    ...statusChipStyle,
                    background: u.status === 'frozen' ? '#e74c3c' : '#2ecc71',
                  }}>
                    {u.status === 'frozen' ? '已冻结' : '正常'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {u.status === 'frozen' ? (
                      <button onClick={() => handleUnfreeze(u.id)} style={unfreezeBtnStyle}>解冻</button>
                    ) : (
                      <button onClick={() => handleFreeze(u.id)} style={freezeBtnStyle}>冻结</button>
                    )}
                    <button onClick={() => handleDeleteUser(u.id)} style={deleteBtnStyle}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无用户</div>}

      {auditLogs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 16px', color: '#e0e0e0', fontSize: 16 }}>操作日志</h3>
          <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'auto', maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={thStyle}>时间</th>
                  <th style={thStyle}>操作人</th>
                  <th style={thStyle}>操作</th>
                  <th style={thStyle}>目标用户</th>
                  <th style={thStyle}>详情</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td style={tdStyle}>{log.operatorName || `用户#${log.operatorId}`}</td>
                    <td style={tdStyle}>
                      <span style={{
                        ...actionChipStyle,
                        background: log.action.includes('freeze') ? '#e74c3c' : '#3498db',
                      }}>
                        {log.action === 'freeze_user' ? '冻结' : log.action === 'unfreeze_user' ? '解冻' : log.action}
                      </span>
                    </td>
                    <td style={tdStyle}>{log.targetUsername || `用户#${log.targetUserId}`}</td>
                    <td style={tdStyle}>{log.detail || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leaveStats && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 16px', color: '#e0e0e0', fontSize: 16 }}>请假统计</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e74c3c' }}>{leaveStats.total}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>总请假数</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f39c12' }}>{leaveStats.pending}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>待审批</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2ecc71' }}>{leaveStats.approved}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>已批准</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e74c3c' }}>{leaveStats.rejected}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>已拒绝</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#9b59b6' }}>{leaveStats.activeLeaves}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>进行中</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e67e22' }}>{leaveStats.activeActorsOnLeave}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>当前请假人数</div>
            </div>
          </div>
          {leaveStats.byType && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#3498db' }}>{leaveStats.byType.sick}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>病假</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1abc9c' }}>{leaveStats.byType.personal}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>事假</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#95a5a6' }}>{leaveStats.byType.other}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>其他</div>
              </div>
            </div>
          )}
        </div>
      )}

      {attendanceStats && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 16px', color: '#e0e0e0', fontSize: 16 }}>签到统计</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3498db' }}>{attendanceStats.totalRehearsals}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>排练总数</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#9b59b6' }}>{attendanceStats.totalParticipants}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>参与人次</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2ecc71' }}>{attendanceStats.presentCount}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>出勤人次</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e74c3c' }}>{attendanceStats.absentCount}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>缺席人次</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f39c12' }}>{attendanceStats.lateCount}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>迟到人次</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#95a5a6' }}>{attendanceStats.pendingCount}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>待签到</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1abc9c' }}>
                {attendanceStats.attendanceRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>出勤率</div>
            </div>
          </div>

          {attendanceStats.byUser && attendanceStats.byUser.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: '0 0 12px', color: '#aaa', fontSize: 14 }}>个人签到排行</h4>
              <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>排名</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>演员</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>参与次数</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>出勤</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>缺席</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>迟到</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>出勤率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...attendanceStats.byUser]
                      .sort((a: any, b: any) => b.attendanceRate - a.attendanceRate)
                      .map((u: any, index: number) => (
                      <tr key={u.userId} style={{ borderBottom: '1px solid #222' }}>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-block',
                            width: 24,
                            height: 24,
                            lineHeight: '24px',
                            textAlign: 'center',
                            borderRadius: '50%',
                            background: index === 0 ? '#f39c12' : index === 1 ? '#95a5a6' : index === 2 ? '#e67e22' : '#333',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 600,
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={tdStyle}>{u.displayName || u.userName}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u.total}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#2ecc71' }}>{u.present}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#e74c3c' }}>{u.absent}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#f39c12' }}>{u.late}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: u.attendanceRate >= 90 ? 'rgba(46, 204, 113, 0.15)' : u.attendanceRate >= 70 ? 'rgba(243, 156, 18, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                            color: u.attendanceRate >= 90 ? '#2ecc71' : u.attendanceRate >= 70 ? '#f39c12' : '#e74c3c',
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {u.attendanceRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h3 style={{ margin: '0 0 16px', color: '#e0e0e0', fontSize: 16 }}>素材库管理</h3>
        <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>文件名</th>
                <th style={thStyle}>大小</th>
                <th style={thStyle}>分类</th>
                <th style={thStyle}>标签</th>
                <th style={thStyle}>下载权限</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={tdStyle}>{m.id}</td>
                  <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.originalName}</td>
                  <td style={tdStyle}>{formatSize(m.size)}</td>
                  {editingId === m.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          value={editData.categories}
                          onChange={(e) => setEditData({ ...editData, categories: e.target.value })}
                          placeholder="逗号分隔"
                          style={{ ...inputStyle, padding: '4px 8px', width: 120, fontSize: 12 }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          value={editData.tags}
                          onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                          placeholder="逗号分隔"
                          style={{ ...inputStyle, padding: '4px 8px', width: 120, fontSize: 12 }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {ROLES.map((r) => (
                            <button
                              key={r.value}
                              onClick={() => toggleEditRole(r.value)}
                              style={{
                                ...roleChipStyle,
                                background: editData.downloadRoles.includes(r.value) ? '#2ecc71' : '#222',
                                color: editData.downloadRoles.includes(r.value) ? '#fff' : '#aaa',
                                borderColor: editData.downloadRoles.includes(r.value) ? '#2ecc71' : '#444',
                              }}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveEdit(m.id)} style={saveBtnStyle}>保存</button>
                          <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>取消</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {(m.categories || (m.category ? [m.category] : [])).map((c) => (
                            <span key={c} style={catTagStyle}>{c}</span>
                          ))}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {(m.tags || []).map((t) => (
                            <span key={t} style={labelTagStyle}>#{t}</span>
                          ))}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {m.downloadRoles && m.downloadRoles.length > 0
                          ? m.downloadRoles.map((r) => ROLE_LABELS[r] || r).join(', ')
                          : '所有人'}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => startEdit(m)} style={editBtnStyle}>编辑</button>
                          <button onClick={async () => { await api.materials.remove(m.id); loadMaterials(); }} style={deleteBtnStyle}>删除</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {materials.length === 0 && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>暂无素材</div>}
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
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  color: '#888',
  fontSize: 13,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  color: '#e0e0e0',
  fontSize: 14,
};

const statCardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 16,
  textAlign: 'center',
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

const saveBtnStyle: React.CSSProperties = {
  background: '#2ecc71',
  border: 'none',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #888',
  color: '#888',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const roleChipStyle: React.CSSProperties = {
  padding: '2px 6px',
  border: '1px solid #444',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 11,
};

const catTagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '1px 5px',
  borderRadius: 6,
  background: '#3a1a1a',
  color: '#e74c3c',
  border: '1px solid #5a2a2a',
};

const labelTagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '1px 5px',
  borderRadius: 6,
  background: '#1a2a3a',
  color: '#3498db',
  border: '1px solid #2a3a5a',
};

const statusChipStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 10,
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
};

const freezeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #f39c12',
  color: '#f39c12',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const unfreezeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #2ecc71',
  color: '#2ecc71',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const actionChipStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  color: '#fff',
  fontSize: 11,
};

const overviewCardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  borderLeft: '4px solid',
  padding: 16,
  transition: 'all 0.2s ease',
};

const overviewCardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};

const overviewCardLink: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  transition: 'color 0.2s',
};

const overviewCardNumber: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: '#e0e0e0',
  lineHeight: 1,
  marginBottom: 8,
};

const overviewCardLabel: React.CSSProperties = {
  fontSize: 14,
  color: '#888',
  marginBottom: 12,
};

const overviewCardSubStats: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  fontSize: 12,
  color: '#666',
};
