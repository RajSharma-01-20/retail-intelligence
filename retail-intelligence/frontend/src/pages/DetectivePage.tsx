import { useEffect, useState } from 'react';
import { Search, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import Topbar from '../components/Topbar';
import AnalysisLoader from '../components/AnalysisLoader';
import { getFindings } from '../services/api';
import { severityBadge, severityClass } from '../utils/format';

type Filter = 'ALL' | 'CRITICAL' | 'WARNING' | 'OBSERVATION';

export default function DetectivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const d = await getFindings(force);
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const findings = (data?.findings || []).filter((f: any) => filter === 'ALL' || f.severity === filter);
  const counts = {
    ALL: data?.findings?.length || 0,
    CRITICAL: data?.findings?.filter((f: any) => f.severity === 'CRITICAL').length || 0,
    WARNING: data?.findings?.filter((f: any) => f.severity === 'WARNING').length || 0,
    OBSERVATION: data?.findings?.filter((f: any) => f.severity === 'OBSERVATION').length || 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar
        title="Data Detective"
        subtitle="Autonomous anomaly and pattern discovery"
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load(true)} disabled={loading} style={{ fontSize: 11 }}>
            <RefreshCw size={12} /> Re-analyze
          </button>
        }
      />
      <div className="content-area">
        {data && (
          <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(124,92,255,0.08), rgba(13,15,19,0))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Dataset Investigation
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                  {data.findings_count} findings detected
                </div>
              </div>
              <div style={{ display: 'flex', gap: 32, marginLeft: 'auto' }}>
                {[
                  ['Records Analyzed', data.total_records_analyzed?.toLocaleString()],
                  ['Patterns Evaluated', data.patterns_evaluated],
                  ['Critical Issues', counts.CRITICAL],
                ].map(([label, val]) => (
                  <div key={String(label)} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="filter-tabs">
            {(['ALL', 'CRITICAL', 'WARNING', 'OBSERVATION'] as Filter[]).map((f) => (
              <div key={f} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                {f} {counts[f] > 0 && <span style={{ opacity: 0.7 }}>({counts[f]})</span>}
              </div>
            ))}
          </div>
        </div>

        {loading && (
          <AnalysisLoader
            title="Analyzing retail data"
            steps={['Loading dataset', 'Validating records', 'Calculating metrics', 'Detecting anomalies', 'Building insights']}
            activeIndex={3}
          />
        )}

        {!loading && error && (
          <div className="empty-state">
            <div className="empty-state-icon"><AlertTriangle size={22} /></div>
            <div className="empty-state-title">Analysis failed</div>
            <div className="empty-state-desc">{error}</div>
          </div>
        )}

        {!loading && !error && findings.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Search size={22} /></div>
            <div className="empty-state-title">No findings in this category</div>
            <div className="empty-state-desc">Try a different severity filter or generate a new dataset.</div>
          </div>
        )}

        {!loading && !error && findings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((f: any) => (
              <div
                key={f.id}
                className={`finding-card ${severityClass(f.severity)}`}
                onClick={() => setExpanded(expanded === f.id ? null : f.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${severityBadge(f.severity)}`}>{f.severity}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{f.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4 }}>{f.affected_entity}</span>
                  {expanded === f.id ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.description}</div>
                {expanded === f.id && (
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Metric</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.metric}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Deviation</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: f.deviation < 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                          {f.deviation > 0 ? '+' : ''}{Number(f.deviation).toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Affected Entity</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.affected_entity}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Evidence: </span>
                      {f.evidence}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
