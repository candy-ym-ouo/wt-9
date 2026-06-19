import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface TodayTask {
  rehearsal: {
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
  };
  role: string;
  tasks: string[];
  priority: 'high' | 'medium' | 'low';
  participants: any[];
}

interface ReminderItem {
  id: number;
  type: string;
  channel: string;
  status: string;
  title: string;
  message: string;
  rehearsalId?: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

interface ReminderConfig {
  id: number;
  type: string;
  targetRoles: string[];
  channels: string[];
  enabled: boolean;
  advanceMinutes: number;
  template?: string;
}

const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high: { color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.08)', border: '#e74c3c', label: '紧急' },
  medium: { color: '#f39c12', bg: 'rgba(243, 156, 18, 0.08)', border: '#f39c12', label: '重要' },
  low: { color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.08)', border: '#2ecc71', label: '一般' },
};

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#f39c12', bg: 'rgba(243, 156, 18, 0.1)', label: '待发送' },
  sent: { color: '#3498db', bg: 'rgba(52, 152, 219, 0.1)', label: '未读' },
  read: { color: '#888', bg: 'rgba(136, 136, 136, 0.1)', label: '已读' },
  dismissed: { color: '#555', bg: 'rgba(85, 85, 85, 0.1)', label: '已忽略' },
  failed: { color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)', label: '失败' },
};

const REMINDER_TYPE_LABELS: Record<string, string> = {
  rehearsal_today: '今日排练',
  rehearsal_upcoming: '即将开始',
  material_due: '资料截止',
  task_assigned: '任务指派',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  director: '导演',
  actor: '演员',
  viewer: '观察者',
};

export default function RemindersPage() {
  const { user, isDirector, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'list' | 'configs'>('tasks');
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [reminders, setReminders] = useState<{ items: ReminderItem[]; total: number }>({ items: [], total: 0 });
  const [configs, setConfigs] = useState<ReminderConfig[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const canManage = isDirector || isAdmin;

  const loadTodayTasks = async () => {
    try {
      const data = await api.reminders.todayTasks();
      setTodayTasks(data);
    } catch {
      setTodayTasks([]);
    }
  };

  const loadReminders = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const data = await api.reminders.list(params);
      setReminders(data);
    } catch {
      setReminders({ items: [], total: 0 });
    }
  };

  const loadConfigs = async () => {
    try {
      const data = await api.reminders.configs.list();
      setConfigs(data);
    } catch {
      setConfigs([]);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await api.reminders.summary();
      setSummary(data);
      const upcomingData = await api.reminders.upcoming(7);
      setUpcoming(upcomingData);
    } catch {
      setSummary(null);
      setUpcoming([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadTodayTasks(), loadReminders(), loadSummary()]);
    if (canManage) await loadConfigs();
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [filter]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.reminders.markAsRead(id);
      loadReminders();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.reminders.markAllAsRead();
      loadAll();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await api.reminders.dismiss(id);
      loadReminders();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleToggleConfig = async (id: number, enabled: boolean) => {
    try {
      await api.reminders.configs.update(id, { enabled: !enabled });
      loadConfigs();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleDeleteConfig = async (id: number) => {
    if (!confirm('确定要删除这条提醒配置吗？')) return;
    try {
      await api.reminders.configs.remove(id);
      loadConfigs();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleGenerateDaily = async () => {
    if (!confirm('确定要为所有用户生成今日排练提醒吗？')) return;
    try {
      const res = await api.reminders.generateDaily();
      alert(`已为 ${res.generated} 位用户生成提醒`);
      loadAll();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleInitDefaults = async () => {
    if (!confirm('确定要初始化默认提醒配置吗？')) return;
    try {
      await api.reminders.initDefaults();
      loadConfigs();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>🔔 排练提醒</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {summary && summary.unread > 0 && (
            <button onClick={handleMarkAllAsRead} style={ghostBtnStyle}>
              ✓ 全部已读 ({summary.unread})
            </button>
          )}
          {isAdmin && (
            <button onClick={handleGenerateDaily} style={ghostBtnStyle}>
              📤 生成今日提醒
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e74c3c' }}>{summary.todayTasks?.length || 0}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>今日排练</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f39c12' }}>{summary.unread || 0}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>未读提醒</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3498db' }}>{upcoming.length}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>近7日排练</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #333', paddingBottom: 0 }}>
        {[
          { key: 'tasks' as const, label: '📋 今日任务' },
          { key: 'list' as const, label: '📬 提醒列表' },
          ...(canManage ? [{ key: 'configs' as const, label: '⚙️ 提醒配置' }] : []),
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #e74c3c' : '2px solid transparent',
              color: activeTab === tab.key ? '#e74c3c' : '#888',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>加载中...</div>}

      {!loading && activeTab === 'tasks' && (
        <div>
          {todayTasks.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ color: '#888', fontSize: 16 }}>今日没有排练任务</div>
              <div style={{ color: '#555', fontSize: 13, marginTop: 8 }}>
                {user?.role === 'actor' ? '好好休息，明天加油！' : '暂无需要处理的排练事项'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {todayTasks.map((task, idx) => {
                const pStyle = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low;
                return (
                  <div key={idx} style={{
                    ...cardStyle,
                    borderLeft: `4px solid ${pStyle.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>{task.rehearsal.title}</h3>
                          <span style={{
                            padding: '2px 8px',
                            background: pStyle.bg,
                            border: `1px solid ${pStyle.border}`,
                            color: pStyle.color,
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {pStyle.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#888' }}>
                          ⏰ {formatTime(task.rehearsal.startTime)} - {formatTime(task.rehearsal.endTime)}
                          {task.rehearsal.location && <span style={{ marginLeft: 16 }}>📍 {task.rehearsal.location}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                          🎭 你的角色：{task.role}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: '#151515',
                      borderRadius: 6,
                      padding: 12,
                    }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>待办事项</div>
                      {task.tasks.map((t, tIdx) => (
                        <div key={tIdx} style={{
                          fontSize: 13,
                          color: '#ccc',
                          padding: '4px 0',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}>
                          <span style={{ color: pStyle.color, flexShrink: 0 }}>•</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>

                    {task.participants && task.participants.length > 0 && task.participants.some((p: any) => p.isOnLeave) && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: 'rgba(230, 126, 34, 0.08)',
                        border: '1px solid rgba(230, 126, 34, 0.3)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}>
                        <div style={{ color: '#e67e22', fontWeight: 600, marginBottom: 4 }}>请假人员</div>
                        {task.participants.filter((p: any) => p.isOnLeave).map((p: any) => (
                          <div key={p.userId} style={{ color: '#aaa' }}>
                            {p.displayName || p.userName} ({p.roleName || '演员'})
                            {p.substituteName ? ` → 替补: ${p.substituteName}` : ' (无替补)'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {upcoming.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ color: '#e0e0e0', fontSize: 15, marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 8 }}>
                📅 近7日排练
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map((r: any) => (
                  <div key={r.id} style={{
                    background: '#1a1a1a',
                    borderRadius: 6,
                    border: '1px solid #333',
                    padding: '10px 14px',
                    fontSize: 13,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ color: '#e0e0e0' }}>{r.title}</span>
                      <span style={{ color: '#888', marginLeft: 12 }}>{r.location && `📍${r.location}`}</span>
                    </div>
                    <span style={{ color: '#888' }}>{formatDate(r.startTime)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { value: 'all', label: '全部' },
              { value: 'sent', label: '未读' },
              { value: 'read', label: '已读' },
              { value: 'dismissed', label: '已忽略' },
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

          {reminders.items.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ color: '#888', fontSize: 16 }}>暂无提醒</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reminders.items.map((reminder) => {
                const sStyle = STATUS_STYLE[reminder.status] || STATUS_STYLE.pending;
                return (
                  <div key={reminder.id} style={{
                    ...cardStyle,
                    opacity: reminder.status === 'dismissed' ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <h4 style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>{reminder.title}</h4>
                          <span style={{
                            padding: '2px 8px',
                            background: sStyle.bg,
                            color: sStyle.color,
                            borderRadius: 10,
                            fontSize: 11,
                          }}>
                            {sStyle.label}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(52, 152, 219, 0.1)',
                            color: '#3498db',
                            borderRadius: 10,
                            fontSize: 11,
                          }}>
                            {REMINDER_TYPE_LABELS[reminder.type] || reminder.type}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#aaa', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {reminder.message}
                        </div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
                          {reminder.sentAt ? `发送于 ${formatDate(reminder.sentAt)}` : `创建于 ${formatDate(reminder.createdAt)}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
                        {(reminder.status === 'sent' || reminder.status === 'pending') && (
                          <button onClick={() => handleMarkAsRead(reminder.id)} style={actionBtnStyle}>已读</button>
                        )}
                        {reminder.status !== 'dismissed' && reminder.status !== 'read' && (
                          <button onClick={() => handleDismiss(reminder.id)} style={dismissBtnStyle}>忽略</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'configs' && canManage && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ color: '#888', fontSize: 13 }}>
              配置提醒规则，按角色推送不同类型的提醒
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {configs.length === 0 && (
                <button onClick={handleInitDefaults} style={ghostBtnStyle}>
                  🏗️ 初始化默认配置
                </button>
              )}
            </div>
          </div>

          {configs.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
              <div style={{ color: '#888', fontSize: 16 }}>暂无提醒配置</div>
              <div style={{ color: '#555', fontSize: 13, marginTop: 8 }}>
                点击上方「初始化默认配置」快速创建
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {configs.map((config) => (
                <div key={config.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <h4 style={{ margin: 0, color: '#e0e0e0', fontSize: 14 }}>
                          {REMINDER_TYPE_LABELS[config.type] || config.type}
                        </h4>
                        <span style={{
                          padding: '2px 8px',
                          background: config.enabled ? 'rgba(46, 204, 113, 0.1)' : 'rgba(85, 85, 85, 0.1)',
                          color: config.enabled ? '#2ecc71' : '#555',
                          borderRadius: 10,
                          fontSize: 11,
                        }}>
                          {config.enabled ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        推送角色：{config.targetRoles.map((r) => ROLE_LABELS[r] || r).join('、')}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        提前 {config.advanceMinutes} 分钟 | 渠道：{config.channels.join('、')}
                      </div>
                      {config.template && (
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
                          模板：{config.template}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => handleToggleConfig(config.id, config.enabled)}
                        style={{
                          ...actionBtnStyle,
                          color: config.enabled ? '#f39c12' : '#2ecc71',
                          borderColor: config.enabled ? '#f39c12' : '#2ecc71',
                        }}
                      >
                        {config.enabled ? '禁用' : '启用'}
                      </button>
                      <button onClick={() => handleDeleteConfig(config.id)} style={dismissBtnStyle}>
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 64,
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#aaa',
  cursor: 'pointer',
  fontSize: 13,
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #3498db',
  color: '#3498db',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const dismissBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #e74c3c',
  color: '#e74c3c',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};
