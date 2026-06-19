import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface AuditLogEntry {
  id: number;
  action: string;
  module?: string;
  operatorId: number;
  operatorName?: string;
  targetUserId?: number;
  targetUsername?: string;
  targetId?: number;
  targetType?: string;
  detail?: string;
  metadata?: any;
  createdAt: string;
}

interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  enriched: AuditLogEntry[];
}

interface MetaData {
  actions: string[];
  modules: string[];
  actionLabels: Record<string, string>;
  moduleLabels: Record<string, string>;
}

const PAGE_SIZE = 20;

const MODULE_COLORS: Record<string, string> = {
  user: '#3498db',
  role: '#9b59b6',
  material: '#e67e22',
  rehearsal: '#27ae60',
};

const ACTION_COLORS: Record<string, string> = {
  freeze_user: '#e74c3c',
  unfreeze_user: '#2ecc71',
  update_user_role: '#3498db',
  create_user: '#2ecc71',
  delete_user: '#e74c3c',
  update_role: '#f39c12',
  create_role: '#2ecc71',
  delete_role: '#e74c3c',
  add_role_substitute: '#3498db',
  remove_role_substitute: '#e67e22',
  update_role_priority: '#f39c12',
  create_material: '#2ecc71',
  update_material: '#3498db',
  delete_material: '#e74c3c',
  create_rehearsal: '#2ecc71',
  update_rehearsal: '#3498db',
  delete_rehearsal: '#e74c3c',
  update_attendance: '#f39c12',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    module: '',
    action: '',
    operatorId: '',
    targetUserId: '',
    keyword: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadMeta = async () => {
    try {
      const data = await api.auditLogs.meta();
      setMeta(data);
    } catch (e) {
      console.error('Failed to load meta:', e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      };
      if (filters.module) params.module = filters.module;
      if (filters.action) params.action = filters.action;
      if (filters.operatorId) params.operatorId = Number(filters.operatorId);
      if (filters.targetUserId) params.targetUserId = Number(filters.targetUserId);
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const data: AuditLogsResponse = await api.auditLogs.list(params);
      setLogs(data.enriched || data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleReset = () => {
    setFilters({
      module: '',
      action: '',
      operatorId: '',
      targetUserId: '',
      keyword: '',
      dateFrom: '',
      dateTo: '',
    });
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0' }}>🔍 操作审计日志</h2>
        <div style={{ fontSize: 13, color: '#888' }}>
          共 <span style={{ color: '#e74c3c', fontWeight: 600 }}>{total}</span> 条记录
        </div>
      </div>

      <div style={filterBoxStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle}>模块</label>
            <select
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
              style={selectStyle}
            >
              <option value="">全部模块</option>
              {meta?.modules.map((m) => (
                <option key={m} value={m}>
                  {meta.moduleLabels[m] || m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>操作类型</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              style={selectStyle}
            >
              <option value="">全部操作</option>
              {meta?.actions.map((a) => (
                <option key={a} value={a}>
                  {meta.actionLabels[a] || a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>操作人ID</label>
            <input
              type="number"
              placeholder="输入用户ID"
              value={filters.operatorId}
              onChange={(e) => setFilters({ ...filters, operatorId: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>目标用户ID</label>
            <input
              type="number"
              placeholder="输入用户ID"
              value={filters.targetUserId}
              onChange={(e) => setFilters({ ...filters, targetUserId: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>开始日期</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>结束日期</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>关键词搜索（操作人/目标用户/详情）</label>
            <input
              type="text"
              placeholder="输入关键词..."
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              style={{ ...inputStyle, width: '100%' }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={handleReset} style={resetBtnStyle}>重置</button>
          <button onClick={handleSearch} style={searchBtnStyle}>🔍 查询</button>
        </div>
      </div>

      <div style={{ marginTop: 20, background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>加载中...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>暂无审计日志</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', background: '#222' }}>
                  <th style={thStyle}>时间</th>
                  <th style={thStyle}>模块</th>
                  <th style={thStyle}>操作</th>
                  <th style={thStyle}>操作人</th>
                  <th style={thStyle}>目标</th>
                  <th style={thStyle}>详情</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr style={{ borderBottom: '1px solid #2a2a2a', cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 12, color: '#aaa' }}>
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td style={tdStyle}>
                        {log.module && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: `${MODULE_COLORS[log.module] || '#666'}20`,
                            color: MODULE_COLORS[log.module] || '#aaa',
                            border: `1px solid ${MODULE_COLORS[log.module] || '#666'}40`,
                          }}>
                            {meta?.moduleLabels?.[log.module] || log.module}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${ACTION_COLORS[log.action] || '#888'}20`,
                          color: ACTION_COLORS[log.action] || '#ccc',
                          border: `1px solid ${ACTION_COLORS[log.action] || '#888'}40`,
                        }}>
                          {meta?.actionLabels?.[log.action] || log.action}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13 }}>{log.operatorName || `用户#${log.operatorId}`}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>ID: {log.operatorId}</div>
                      </td>
                      <td style={tdStyle}>
                        {log.targetUsername ? (
                          <>
                            <div style={{ fontSize: 13 }}>{log.targetUsername}</div>
                            <div style={{ fontSize: 11, color: '#666' }}>
                              {log.targetType ? `${log.targetType}#${log.targetId || log.targetUserId}` : `用户#${log.targetUserId}`}
                            </div>
                          </>
                        ) : log.targetId ? (
                          <div style={{ fontSize: 12, color: '#aaa' }}>
                            {log.targetType || '对象'}#{log.targetId}
                          </div>
                        ) : (
                          <span style={{ color: '#555' }}>-</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={log.detail}>{log.detail || '-'}</span>
                      </td>
                      <td style={tdStyle}>
                        {log.metadata && (
                          <span style={{ color: '#3498db', fontSize: 12 }}>
                            {expandedId === log.id ? '收起 ▲' : '详情 ▼'}
                          </span>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && log.metadata && (
                      <tr style={{ background: '#151515' }}>
                        <td colSpan={7} style={{ padding: 16 }}>
                          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, fontWeight: 600 }}>扩展元数据：</div>
                          <pre style={{
                            margin: 0,
                            padding: 12,
                            background: '#0d0d0d',
                            borderRadius: 4,
                            border: '1px solid #333',
                            fontSize: 12,
                            color: '#9cdcfe',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: 300,
                            overflowY: 'auto',
                          }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16, borderTop: '1px solid #333' }}>
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              style={{ ...pageBtnStyle, opacity: page === 1 ? 0.4 : 1 }}
            >
              首页
            </button>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{ ...pageBtnStyle, opacity: page === 1 ? 0.4 : 1 }}
            >
              上一页
            </button>
            <span style={{ color: '#aaa', fontSize: 13, margin: '0 12px' }}>
              第 <span style={{ color: '#e74c3c', fontWeight: 600 }}>{page}</span> / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{ ...pageBtnStyle, opacity: page === totalPages ? 0.4 : 1 }}
            >
              下一页
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              style={{ ...pageBtnStyle, opacity: page === totalPages ? 0.4 : 1 }}
            >
              末页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const filterBoxStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 20,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#888',
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#222',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const searchBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#e74c3c',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

const resetBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'none',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#aaa',
  cursor: 'pointer',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  color: '#888',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#e0e0e0',
  fontSize: 13,
  verticalAlign: 'middle',
};

const pageBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: 4,
  color: '#ccc',
  cursor: 'pointer',
  fontSize: 12,
};
