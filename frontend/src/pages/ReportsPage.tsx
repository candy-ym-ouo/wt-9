import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

type FrequencyGranularity = 'date' | 'week' | 'month';

interface FilterState {
  dateFrom: string;
  dateTo: string;
  actorId: string;
  scriptId: string;
  materialCategory: string;
  annotationTag: string;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filterOptions, setFilterOptions] = useState<any>({
    actors: [],
    scripts: [],
    materialCategories: [],
    annotationTags: [],
  });
  const [frequencyGranularity, setFrequencyGranularity] = useState<FrequencyGranularity>('week');
  const [filter, setFilter] = useState<FilterState>({
    dateFrom: '',
    dateTo: '',
    actorId: '',
    scriptId: '',
    materialCategory: '',
    annotationTag: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter.dateFrom) params.dateFrom = filter.dateFrom;
      if (filter.dateTo) params.dateTo = filter.dateTo;
      if (filter.actorId) params.actorId = Number(filter.actorId);
      if (filter.scriptId) params.scriptId = Number(filter.scriptId);
      if (filter.materialCategory) params.materialCategory = filter.materialCategory;
      if (filter.annotationTag) params.annotationTag = filter.annotationTag;

      const [reportsData, options] = await Promise.all([
        api.reports.getReports(params),
        api.reports.getFilterOptions(),
      ]);
      setData(reportsData);
      setFilterOptions(options);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilter = () => {
    setFilter({
      dateFrom: '',
      dateTo: '',
      actorId: '',
      scriptId: '',
      materialCategory: '',
      annotationTag: '',
    });
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}分钟`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  };

  const getBarWidth = (value: number, max: number) => {
    if (max === 0) return '0%';
    return `${Math.min(100, (value / max) * 100)}%`;
  };

  const renderFrequencyChart = () => {
    if (!data) return null;
    const freq = data.rehearsalFrequency;
    const list =
      frequencyGranularity === 'date'
        ? freq.byDate
        : frequencyGranularity === 'week'
          ? freq.byWeek
          : freq.byMonth;
    const maxCount = list.length > 0 ? Math.max(...list.map((i: any) => i.count)) : 0;

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['date', 'week', 'month'] as FrequencyGranularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setFrequencyGranularity(g)}
              style={{
                ...chipBtnStyle,
                background: frequencyGranularity === g ? '#e74c3c' : '#222',
                borderColor: frequencyGranularity === g ? '#e74c3c' : '#444',
                color: frequencyGranularity === g ? '#fff' : '#aaa',
              }}
            >
              {g === 'date' ? '按日' : g === 'week' ? '按周' : '按月'}
            </button>
          ))}
        </div>
        {list.length > 0 ? (
          <div>
            {list.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: '#aaa' }}>{item.date}</span>
                  <span style={{ color: '#e0e0e0' }}>
                    {item.count} 次 · {formatMinutes(item.totalMinutes)}
                  </span>
                </div>
                <div style={{ background: '#222', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: getBarWidth(item.count, maxCount),
                      background: 'linear-gradient(90deg, #e74c3c, #c0392b)',
                      borderRadius: 4,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>暂无排练数据</div>
        )}
      </div>
    );
  };

  const renderActorParticipation = () => {
    if (!data) return null;
    const ap = data.actorParticipation;
    return (
      <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'auto', maxHeight: 400 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#222', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={thStyle}>演员</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>参与</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>出勤</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>迟到</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>缺席</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>参与率</th>
            </tr>
          </thead>
          <tbody>
            {ap.items.length > 0 ? ap.items.map((item: any) => (
              <tr key={item.actorId} style={{ borderBottom: '1px solid #222' }}>
                <td style={tdStyle}>{item.actorName}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.totalRehearsals}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#2ecc71' }}>{item.presentCount}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#f39c12' }}>{item.lateCount}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#e74c3c' }}>{item.absentCount}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: item.attendanceRate >= 90 ? 'rgba(46, 204, 113, 0.15)' : item.attendanceRate >= 70 ? 'rgba(243, 156, 18, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                    color: item.attendanceRate >= 90 ? '#2ecc71' : item.attendanceRate >= 70 ? '#f39c12' : '#e74c3c',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {item.attendanceRate}%
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#555', padding: 32 }}>
                  暂无演员参与数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMaterialUsage = () => {
    if (!data) return null;
    const mu = data.materialUsage;
    const maxUsage = mu.items.length > 0 ? Math.max(...mu.items.map((i: any) => i.totalUsage)) : 0;

    return (
      <div>
        {Object.keys(mu.byCategory).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>按分类统计</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(mu.byCategory).map(([cat, count]: any) => (
                <div key={cat} style={categoryTagStyle}>
                  <span style={{ color: '#e74c3c' }}>{cat}</span>
                  <span style={{ color: '#888', marginLeft: 6 }}>× {count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'auto', maxHeight: 360 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#222', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={thStyle}>素材名称</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>排练</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>批注</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>总使用</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>热度</th>
              </tr>
            </thead>
            <tbody>
              {mu.items.filter((i: any) => i.totalUsage > 0).slice(0, 20).map((item: any) => (
                <tr key={item.materialId} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.materialName}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{item.rehearsalCount}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{item.annotationCount}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#f39c12', fontWeight: 600 }}>
                    {item.totalUsage}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ background: '#222', borderRadius: 4, height: 8, width: 80 }}>
                      <div
                        style={{
                          height: '100%',
                          width: getBarWidth(item.totalUsage, maxUsage),
                          background: 'linear-gradient(90deg, #f39c12, #e67e22)',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {mu.items.filter((i: any) => i.totalUsage > 0).length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#555', padding: 32 }}>
                    暂无素材使用数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAnnotationActivity = () => {
    if (!data) return null;
    const aa = data.annotationActivity;
    const maxDateCount = aa.byDate.length > 0 ? Math.max(...aa.byDate.map((i: any) => i.count)) : 0;

    return (
      <div>
        {aa.byDate.length > 0 ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>批注活跃度趋势</div>
            {aa.byDate.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 12 }}>
                  <span style={{ color: '#aaa' }}>{item.date}</span>
                  <span style={{ color: '#e0e0e0' }}>{item.count} 条</span>
                </div>
                <div style={{ background: '#222', borderRadius: 4, height: 14 }}>
                  <div
                    style={{
                      height: '100%',
                      width: getBarWidth(item.count, maxDateCount),
                      background: 'linear-gradient(90deg, #1abc9c, #16a085)',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>暂无批注数据</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Object.keys(aa.byTag).length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>按标签统计</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(aa.byTag).map(([tag, count]: any) => (
                  <div key={tag} style={tagChipStyle}>
                    <span style={{ color: '#9b59b6' }}>#{tag}</span>
                    <span style={{ color: '#888', marginLeft: 4, fontSize: 11 }}>× {count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aa.byUser.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>批注贡献者</div>
              <div>
                {aa.byUser.slice(0, 8).map((u: any) => (
                  <div key={u.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                    <span style={{ color: '#e0e0e0' }}>{u.userName}</span>
                    <span style={{ color: '#1abc9c' }}>{u.count} 条</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0', fontSize: 22 }}>📊 报表中心</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleResetFilter} style={resetBtnStyle}>重置筛选</button>
          <button onClick={loadData} style={primaryBtnStyle}>
            {loading ? '加载中...' : '刷新数据'}
          </button>
        </div>
      </div>

      <div style={filterPanelStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={filterLabelStyle}>开始日期</label>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              style={filterInputStyle}
            />
          </div>
          <div>
            <label style={filterLabelStyle}>结束日期</label>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              style={filterInputStyle}
            />
          </div>
          <div>
            <label style={filterLabelStyle}>演员/导演</label>
            <select
              value={filter.actorId}
              onChange={(e) => handleFilterChange('actorId', e.target.value)}
              style={filterInputStyle}
            >
              <option value="">全部</option>
              {filterOptions.actors.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>剧本</label>
            <select
              value={filter.scriptId}
              onChange={(e) => handleFilterChange('scriptId', e.target.value)}
              style={filterInputStyle}
            >
              <option value="">全部</option>
              {filterOptions.scripts.map((s: any) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>素材分类</label>
            <select
              value={filter.materialCategory}
              onChange={(e) => handleFilterChange('materialCategory', e.target.value)}
              style={filterInputStyle}
            >
              <option value="">全部</option>
              {filterOptions.materialCategories.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>批注标签</label>
            <select
              value={filter.annotationTag}
              onChange={(e) => handleFilterChange('annotationTag', e.target.value)}
              style={filterInputStyle}
            >
              <option value="">全部</option>
              {filterOptions.annotationTags.map((t: string) => (
                <option key={t} value={t}>#{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <div style={loadingStyle}>加载中...</div>}

      {!loading && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ ...overviewCardStyle, borderLeftColor: '#e74c3c' }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>📅 排练总次数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e0' }}>{data.rehearsalFrequency.total}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                总时长 {formatMinutes(data.rehearsalFrequency.totalMinutes)}
              </div>
            </div>
            <div style={{ ...overviewCardStyle, borderLeftColor: '#9b59b6' }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>👥 参与演员数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e0' }}>{data.actorParticipation.totalActors}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                平均参与率 {data.actorParticipation.avgAttendanceRate}%
              </div>
            </div>
            <div style={{ ...overviewCardStyle, borderLeftColor: '#f39c12' }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>📁 素材总数量</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e0' }}>{data.materialUsage.totalMaterials}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                已使用 {data.materialUsage.totalUsed} 个
              </div>
            </div>
            <div style={{ ...overviewCardStyle, borderLeftColor: '#1abc9c' }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>📝 批注总数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e0' }}>{data.annotationActivity.total}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                {Object.keys(data.annotationActivity.byTag).length} 个标签
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>
                <span>📅</span> 排练频次统计
              </h3>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                平均单次时长: {formatMinutes(data.rehearsalFrequency.avgMinutes)}
              </div>
              {renderFrequencyChart()}
            </section>

            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>
                <span>👥</span> 演员参与度
              </h3>
              {renderActorParticipation()}
            </section>

            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>
                <span>📁</span> 素材使用量
              </h3>
              {renderMaterialUsage()}
            </section>

            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>
                <span>📝</span> 批注活跃度
              </h3>
              {renderAnnotationActivity()}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

const filterPanelStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 16,
  marginBottom: 24,
};

const filterLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#888',
  marginBottom: 6,
};

const filterInputStyle: React.CSSProperties = {
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

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#e74c3c',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};

const resetBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'none',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#aaa',
  cursor: 'pointer',
  fontSize: 14,
};

const chipBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  border: '1px solid',
  borderRadius: 16,
  cursor: 'pointer',
  fontSize: 12,
};

const sectionStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#e0e0e0',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: '#888',
  fontSize: 12,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  color: '#e0e0e0',
  fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#555',
  padding: 40,
  fontSize: 14,
};

const loadingStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#888',
  padding: 80,
  fontSize: 16,
};

const categoryTagStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: '#222',
  border: '1px solid #3a1a1a',
  borderRadius: 16,
  fontSize: 12,
};

const tagChipStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: '#222',
  border: '1px solid #2a1a3a',
  borderRadius: 12,
  fontSize: 12,
};

const overviewCardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  borderLeft: '4px solid',
  padding: 18,
};
