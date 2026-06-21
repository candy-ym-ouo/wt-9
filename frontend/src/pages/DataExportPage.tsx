import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface ExportTypeOption {
  type: string;
  label: string;
}

interface ExportFormatOption {
  format: string;
  label: string;
}

interface FilterState {
  dramaId: string;
  startDate: string;
  endDate: string;
  keyword: string;
  category: string;
  status: string;
  participantId: string;
  sceneNumber: string;
  tag: string;
}

const TYPE_ICONS: Record<string, string> = {
  rehearsals: '📅',
  roles: '🎭',
  annotations: '📝',
  materials: '📁',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  rehearsals: '导出排练计划，包含时间、地点、参与人员、考勤等信息',
  roles: '导出角色清单，包含角色名称、演员分配、替补演员等',
  annotations: '导出批注记录，包含台词内容、批注、标签、场次等',
  materials: '导出素材目录，包含文件名、分类、标签、大小等',
};

const FORMAT_ICONS: Record<string, string> = {
  excel: '📊',
  csv: '📄',
  json: '🔧',
};

const INITIAL_FILTER: FilterState = {
  dramaId: '',
  startDate: '',
  endDate: '',
  keyword: '',
  category: '',
  status: '',
  participantId: '',
  sceneNumber: '',
  tag: '',
};

export default function DataExportPage() {
  const { isAdmin, isDirector } = useAuth();

  const [types, setTypes] = useState<ExportTypeOption[]>([]);
  const [formats, setFormats] = useState<ExportFormatOption[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [previewData, setPreviewData] = useState<{ total: number; preview: any[] } | null>(null);
  const [dramas, setDramas] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [annotationTags, setAnnotationTags] = useState<{ name: string; color: string | null }[]>([]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadFilterOptions();
    }
  }, [selectedType]);

  const loadInitialData = async () => {
    try {
      const [typesRes, formatsRes] = await Promise.all([
        api.dataExport.getTypes(),
        api.dataExport.getFormats(),
      ]);
      setTypes(typesRes);
      setFormats(formatsRes);
      if (typesRes.length > 0) {
        setSelectedType(typesRes[0].type);
      }

      const dramasRes = await api.dramas.list();
      setDramas(dramasRes);
    } catch {
      setError('加载初始数据失败');
    }
  };

  const loadFilterOptions = async () => {
    try {
      if (selectedType === 'materials') {
        const cats = await api.materials.getCategories();
        setCategories(cats);
      }
      if (selectedType === 'annotations') {
        const tags = await api.annotations.getTags();
        setAnnotationTags(tags);
      }
    } catch {}
  };

  const buildFilterPayload = () => {
    const payload: any = {};
    if (filter.dramaId) payload.dramaId = Number(filter.dramaId);
    if (filter.startDate) payload.startDate = filter.startDate;
    if (filter.endDate) payload.endDate = filter.endDate;
    if (filter.keyword) payload.keyword = filter.keyword;
    if (filter.category) payload.category = filter.category;
    if (filter.status) payload.status = filter.status;
    if (filter.participantId) payload.participantId = Number(filter.participantId);
    if (filter.sceneNumber) payload.sceneNumber = Number(filter.sceneNumber);
    if (filter.tag) payload.tag = filter.tag;
    return payload;
  };

  const handlePreview = async () => {
    if (!selectedType) return;
    setLoadingPreview(true);
    setError('');
    try {
      const result = await api.dataExport.preview(selectedType, buildFilterPayload());
      setPreviewData(result);
    } catch (e: any) {
      setError(e.message || '预览失败');
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    if (!selectedType || !selectedFormat) return;
    setExporting(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.dataExport.exportAndDownload(selectedType, selectedFormat, buildFilterPayload());
      setSuccessMsg('导出成功，文件已开始下载');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setError(e.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilter = () => {
    setFilter(INITIAL_FILTER);
    setPreviewData(null);
  };

  if (!isAdmin && !isDirector) {
    return (
      <div style={forbiddenStyle}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, color: '#e0e0e0', marginBottom: 8 }}>权限不足</div>
        <div style={{ color: '#888', fontSize: 14 }}>仅管理员和导演可使用数据导出功能</div>
      </div>
    );
  }

  const renderTypeSpecificFilters = () => {
    switch (selectedType) {
      case 'rehearsals':
        return (
          <>
            <div>
              <label style={filterLabelStyle}>开始日期</label>
              <input type="date" value={filter.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} style={filterInputStyle} />
            </div>
            <div>
              <label style={filterLabelStyle}>结束日期</label>
              <input type="date" value={filter.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} style={filterInputStyle} />
            </div>
          </>
        );
      case 'roles':
        return (
          <div>
            <label style={filterLabelStyle}>角色状态</label>
            <select value={filter.status} onChange={(e) => handleFilterChange('status', e.target.value)} style={filterInputStyle}>
              <option value="">全部</option>
              <option value="assigned">已分配演员</option>
              <option value="unassigned">未分配演员</option>
            </select>
          </div>
        );
      case 'annotations':
        return (
          <>
            <div>
              <label style={filterLabelStyle}>场次号</label>
              <input type="number" placeholder="输入场次号" value={filter.sceneNumber} onChange={(e) => handleFilterChange('sceneNumber', e.target.value)} style={filterInputStyle} />
            </div>
            {annotationTags.length > 0 && (
              <div>
                <label style={filterLabelStyle}>批注标签</label>
                <select value={filter.tag} onChange={(e) => handleFilterChange('tag', e.target.value)} style={filterInputStyle}>
                  <option value="">全部标签</option>
                  {annotationTags.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        );
      case 'materials':
        return (
          <>
            {categories.length > 0 && (
              <div>
                <label style={filterLabelStyle}>素材分类</label>
                <select value={filter.category} onChange={(e) => handleFilterChange('category', e.target.value)} style={filterInputStyle}>
                  <option value="">全部分类</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const renderPreviewTable = () => {
    if (!previewData || previewData.total === 0) return null;

    const sample = previewData.preview[0];
    if (!sample) return null;

    const columns = Object.keys(sample).filter(
      (key) => !['participantIds', 'materialIds', 'attendance', 'substituteActorIds', 'sceneNumbers', 'downloadRoles'].includes(key),
    );

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: '#e0e0e0' }}>
            数据预览 <span style={{ color: '#888', fontSize: 12 }}>(前10条，共{previewData.total}条)</span>
          </span>
          <span style={{
            padding: '4px 12px',
            background: 'rgba(231, 76, 60, 0.15)',
            color: '#e74c3c',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
          }}>
            共 {previewData.total} 条
          </span>
        </div>
        <div style={{ background: '#1a1a1a', borderRadius: 8, border: '1px solid #333', overflow: 'auto', maxHeight: 360 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#222', zIndex: 1 }}>
              <tr>
                {columns.slice(0, 8).map((col) => (
                  <th key={col} style={thStyle}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.preview.map((row: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                  {columns.slice(0, 8).map((col) => (
                    <td key={col} style={tdStyle}>
                      {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#e0e0e0', fontSize: 22 }}>📤 数据导出</h2>
      </div>

      {error && (
        <div style={errorBannerStyle}>
          <span>⚠️</span> {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', marginLeft: 12, fontSize: 16 }}>✕</button>
        </div>
      )}

      {successMsg && (
        <div style={successBannerStyle}>
          <span>✅</span> {successMsg}
        </div>
      )}

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span>📋</span> 选择导出类型
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {types.map((t) => (
            <div
              key={t.type}
              onClick={() => {
                setSelectedType(t.type);
                setPreviewData(null);
              }}
              style={{
                ...typeCardStyle,
                borderColor: selectedType === t.type ? '#e74c3c' : '#333',
                background: selectedType === t.type ? '#2a1515' : '#1a1a1a',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{TYPE_ICONS[t.type] || '📦'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: selectedType === t.type ? '#e74c3c' : '#e0e0e0', marginBottom: 4 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>
                {TYPE_DESCRIPTIONS[t.type]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span>🔍</span> 筛选条件
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={filterLabelStyle}>剧目</label>
            <select value={filter.dramaId} onChange={(e) => handleFilterChange('dramaId', e.target.value)} style={filterInputStyle}>
              <option value="">全部剧目</option>
              {dramas.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>关键词</label>
            <input
              type="text"
              placeholder="搜索关键词..."
              value={filter.keyword}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
              style={filterInputStyle}
            />
          </div>
          {renderTypeSpecificFilters()}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={handleResetFilter} style={resetBtnStyle}>重置筛选</button>
          <button onClick={handlePreview} disabled={loadingPreview} style={secondaryBtnStyle}>
            {loadingPreview ? '加载中...' : '👁 预览数据'}
          </button>
        </div>

        {renderPreviewTable()}
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span>💾</span> 选择格式并导出
        </h3>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {formats.map((f) => (
            <div
              key={f.format}
              onClick={() => setSelectedFormat(f.format)}
              style={{
                ...formatCardStyle,
                borderColor: selectedFormat === f.format ? '#e74c3c' : '#333',
                background: selectedFormat === f.format ? '#2a1515' : '#1a1a1a',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{FORMAT_ICONS[f.format] || '📄'}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: selectedFormat === f.format ? '#e74c3c' : '#e0e0e0' }}>
                {f.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#111', borderRadius: 8, border: '1px solid #333' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#e0e0e0', marginBottom: 4 }}>
              导出 <span style={{ color: '#e74c3c', fontWeight: 600 }}>{types.find((t) => t.type === selectedType)?.label || ''}</span>
              {' → '}
              <span style={{ color: '#f39c12', fontWeight: 600 }}>{formats.find((f) => f.format === selectedFormat)?.label || ''}</span>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {previewData ? `将导出 ${previewData.total} 条数据` : '点击「预览数据」查看匹配条数'}
              {filter.dramaId && ` · 剧目: ${dramas.find((d) => d.id === Number(filter.dramaId))?.title || ''}`}
              {filter.keyword && ` · 关键词: ${filter.keyword}`}
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || !selectedType}
            style={{
              ...primaryBtnStyle,
              opacity: exporting || !selectedType ? 0.6 : 1,
              cursor: exporting || !selectedType ? 'not-allowed' : 'pointer',
              padding: '12px 32px',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {exporting ? (
              <>⏳ 导出中...</>
            ) : (
              <>⬇️ 立即导出</>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #333',
  padding: 20,
  marginBottom: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#e0e0e0',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
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

const typeCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const formatCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.2s',
  textAlign: 'center',
  minWidth: 120,
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
  background: '#333',
  border: '1px solid #555',
  borderRadius: 6,
  color: '#e0e0e0',
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

const errorBannerStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'rgba(231, 76, 60, 0.1)',
  border: '1px solid rgba(231, 76, 60, 0.3)',
  borderRadius: 8,
  color: '#e74c3c',
  fontSize: 14,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const successBannerStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'rgba(46, 204, 113, 0.1)',
  border: '1px solid rgba(46, 204, 113, 0.3)',
  borderRadius: 8,
  color: '#2ecc71',
  fontSize: 14,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const forbiddenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 300,
  textAlign: 'center',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: '#888',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  color: '#e0e0e0',
  fontSize: 12,
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
