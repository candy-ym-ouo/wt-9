import React, { useState } from 'react';
import { api } from '../api/client';

interface SearchResult {
  rehearsals: any[];
  roles: any[];
  annotations: any[];
  materials: any[];
  total: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.search.query(query.trim());
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', color: '#e0e0e0' }}>全站检索</h2>

      <form onSubmit={handleSearch} style={{
        display: 'flex',
        gap: 8,
        marginBottom: 32,
      }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索排练、角色、批注、素材..."
          style={{
            flex: 1,
            padding: '12px 16px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 16,
            outline: 'none',
          }}
        />
        <button type="submit" disabled={loading} style={{
          padding: '12px 24px',
          background: '#e74c3c',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
        }}>
          {loading ? '搜索中...' : '🔍 搜索'}
        </button>
      </form>

      {results && (
        <div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
            共找到 <strong style={{ color: '#e74c3c' }}>{results.total}</strong> 条结果
          </div>

          {results.rehearsals.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#e67e22', fontSize: 15, marginBottom: 12 }}>📅 排练 ({results.rehearsals.length})</h3>
              {results.rehearsals.map((r: any) => (
                <div key={r.id} style={{ ...cardStyle, borderLeft: r.hasConflict ? '4px solid #e74c3c' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <strong style={{ color: '#e0e0e0' }}>{r.title}</strong>
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
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    {formatDate(r.startTime)}
                    {r.location && ` · 📍 ${r.location}`}
                  </div>
                  {r.description && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{r.description}</div>}
                  {r.hasConflict && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: 'rgba(231, 76, 60, 0.08)',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#e74c3c',
                    }}>
                      {r.timeConflicts && r.timeConflicts.length > 0 && (
                        <div>📅 时间冲突：{r.timeConflicts.map((x: any) => x.title).join('、')}</div>
                      )}
                      {r.participantConflicts && r.participantConflicts.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          👥 参与人占用：{r.participantConflicts.map((p: any) => `${p.userName || '用户#' + p.userId}在${p.conflictingRehearsals.map((x: any) => x.title).join('、')}有安排`).join('；')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {results.roles.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#9b59b6', fontSize: 15, marginBottom: 12 }}>🎭 角色 ({results.roles.length})</h3>
              {results.roles.map((r: any) => {
                const statusInfo = (() => {
                  if (!r.actorId) return { text: '未分配演员', color: '#888', bg: 'rgba(136,136,136,0.1)' };
                  if (r.actorOnLeave) {
                    if (r.currentSubstitute) return { text: '请假中（有替补）', color: '#e67e22', bg: 'rgba(230,126,34,0.1)' };
                    return { text: '请假中（无替补）', color: '#e74c3c', bg: 'rgba(231,76,60,0.1)' };
                  }
                  return { text: '正常', color: '#2ecc71', bg: 'rgba(46,204,113,0.1)' };
                })();
                return (
                  <div key={r.id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <strong style={{ color: '#e0e0e0' }}>{r.characterName}</strong>
                      <span style={{
                        padding: '2px 8px',
                        background: statusInfo.bg,
                        border: `1px solid ${statusInfo.color}`,
                        color: statusInfo.color,
                        borderRadius: 10,
                        fontSize: 11,
                      }}>
                        {statusInfo.text}
                      </span>
                    </div>
                    {r.characterDescription && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{r.characterDescription}</div>}
                    {r.actorName && (
                      <div style={{ fontSize: 13, color: '#aaa', marginTop: 6 }}>
                        扮演者: <strong style={{ color: '#e0e0e0' }}>{r.actorName}</strong>
                      </div>
                    )}
                    {r.substituteActors && r.substituteActors.length > 0 && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                        替补: {r.substituteActors.map((s: any) => (
                          <span key={s.id} style={{
                            padding: '2px 6px',
                            background: s.isOnLeave ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
                            border: `1px solid ${s.isOnLeave ? '#e74c3c' : '#2ecc71'}`,
                            color: s.isOnLeave ? '#e74c3c' : '#2ecc71',
                            borderRadius: 8,
                            fontSize: 11,
                            marginRight: 4,
                          }}>
                            {s.displayName || s.username}{s.isOnLeave ? '(请假)' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.activeLeave && (
                      <div style={{
                        marginTop: 8,
                        padding: '6px 10px',
                        background: 'rgba(230,126,34,0.08)',
                        border: '1px solid rgba(230,126,34,0.3)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#e67e22',
                      }}>
                        请假中 · {r.activeLeave.type === 'sick' ? '病假' : r.activeLeave.type === 'personal' ? '事假' : '其他'}
                        {r.activeLeave.reason && ` · ${r.activeLeave.reason}`}
                        {r.currentSubstitute && ` → 替补: ${r.currentSubstitute.displayName || r.currentSubstitute.username}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {results.annotations.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#2ecc71', fontSize: 15, marginBottom: 12 }}>📝 批注 ({results.annotations.length})</h3>
              {results.annotations.map((a: any) => (
                <div key={a.id} style={cardStyle}>
                  <div style={{ fontStyle: 'italic', color: '#e0e0e0', fontSize: 14 }}>"{a.scriptContent}"</div>
                  {a.note && <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>→ {a.note}</div>}
                  {a.tag && <span style={{ background: '#333', color: '#aaa', padding: '2px 6px', borderRadius: 8, fontSize: 11, marginTop: 4, display: 'inline-block' }}>{a.tag}</span>}
                </div>
              ))}
            </section>
          )}

          {results.materials.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#3498db', fontSize: 15, marginBottom: 12 }}>📁 素材 ({results.materials.length})</h3>
              {results.materials.map((m: any) => (
                <div key={m.id} style={cardStyle}>
                  <strong style={{ color: '#e0e0e0' }}>{m.originalName}</strong>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    {m.category} · {(m.size / 1024).toFixed(1)} KB
                  </div>
                  {m.description && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{m.description}</div>}
                </div>
              ))}
            </section>
          )}

          {results.total === 0 && (
            <div style={{ textAlign: 'center', color: '#555', padding: 48 }}>未找到相关结果</div>
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
  padding: 12,
  marginBottom: 8,
};
