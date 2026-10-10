import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import Topbar from '../components/Topbar';
import AnalysisLoader from '../components/AnalysisLoader';
import { getDashboard } from '../services/api';
import { formatCurrency, formatNumber, formatPct, deltaClass, statusBadgeClass, severityBadge } from '../utils/format';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '8px 12px', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {p.name === 'revenue' ? formatCurrency(p.value) : formatNumber(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await getDashboard();
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Overview" subtitle="Retail Intelligence Command Center" />
        <div className="content-area">
          <AnalysisLoader
            title="Building command center"
            steps={['Loading dataset', 'Calculating metrics', 'Detecting anomalies', 'Building insights']}
            activeIndex={2}
          />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Overview" />
        <div className="content-area">
          <div className="empty-state">
            <div className="empty-state-icon"><AlertTriangle size={22} /></div>
            <div className="empty-state-title">No dataset available</div>
            <div className="empty-state-desc">{error || 'Generate a synthetic retail dataset or upload an Excel/CSV file to begin.'}</div>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const kpis = data.kpis;
  const revTrend = data.revenue_trend || [];
  const findings = data.top_findings || [];
  const pairs = data.top_product_pairs || [];
  const alerts = data.store_alerts || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar
        title="Overview"
        subtitle="Understand your retail data before it becomes a problem"
        actions={<button type="button" className="btn btn-ghost" onClick={() => void load()} style={{ fontSize: 11 }}>Refresh</button>}
      />
      <div className="content-area">
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-label">Total Revenue</div>
            <div className="kpi-value">{formatCurrency(kpis.total_revenue)}</div>
            <div className="kpi-sub">All stores combined</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Transactions</div>
            <div className="kpi-value">{formatNumber(kpis.total_transactions)}</div>
            <div className="kpi-sub">Line items recorded</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Products</div>
            <div className="kpi-value">{kpis.unique_products}</div>
            <div className="kpi-sub">Active SKUs</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Stores</div>
            <div className="kpi-value">{kpis.unique_stores}</div>
            <div className="kpi-sub">Retail locations</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Active Findings</div>
            <div className="kpi-value" style={{ color: kpis.active_findings > 3 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
              {kpis.active_findings}
            </div>
            <div className="kpi-sub">Requires attention</div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Demand Overview</div>
                <div className="section-subtitle">Revenue, last 30 days</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revTrend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C5CFF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7C5CFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false}
                  tickFormatter={(v) => String(v).slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#7C5CFF" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Intelligence Findings</div>
                <div className="section-subtitle">{kpis.active_findings} significant findings detected</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {findings.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '16px 0' }}>No findings available.</div>
              ) : findings.map((f: any) => (
                <div key={f.id} className={`finding-card ${String(f.severity).toLowerCase()}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge ${severityBadge(f.severity)}`}>{f.severity}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="section-header">
              <div className="section-title">Product Opportunities</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pairs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No relationship data.</div>
              ) : pairs.slice(0, 5).map((p: any, i: number) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {p.product_a} — {p.product_b}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.co_purchase_count} pairs</span>
                  </div>
                  <div className="rel-bar-container">
                    <div className="rel-bar-track">
                      <div className="rel-bar-fill" style={{ width: `${Math.min(Number(p.strength) || 0, 100)}%` }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>
                      {Number(p.strength || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div className="section-title">Store Alerts</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alerts.length} stores need attention</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.length === 0 ? (
                <div style={{ color: 'var(--color-success)', fontSize: 12 }}>All stores performing within expected range.</div>
              ) : alerts.map((s: any) => (
                <div key={s.store_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--bg-elevated)',
                  borderRadius: 6, border: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.store_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.city}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span>
                    <div className={deltaClass(s.revenue_change_pct)} style={{ marginTop: 4 }}>
                      {formatPct(s.revenue_change_pct, true)} revenue
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
