import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Store, AlertTriangle } from 'lucide-react';
import Topbar from '../components/Topbar';
import { getStoreSummary, getStoreInvestigation } from '../services/api';
import { formatCurrency, formatPct, deltaClass, statusBadgeClass } from '../utils/format';

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [investigation, setInvestigation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invLoading, setInvLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStoreSummary()
      .then((s: any) => {
        const list = (s || []) as any[];
        setStores(list);
        if (list.length) setSelected(String(list[0].store_id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setInvLoading(true);
    setInvestigation(null);
    getStoreInvestigation(selected)
      .then(setInvestigation)
      .catch((e) => setError(e.message))
      .finally(() => setInvLoading(false));
  }, [selected]);

  const CT = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="card" style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatCurrency(p.value)}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Store Investigator" />
        <div className="content-area"><div className="loading-screen"><div className="spinner" /></div></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar title="Store Performance Investigator" subtitle="Diagnose store performance against peers and baseline" />
      <div className="content-area">
        {error && !stores.length ? (
          <div className="empty-state">
            <div className="empty-state-icon"><AlertTriangle size={22} /></div>
            <div className="empty-state-title">Unable to load stores</div>
            <div className="empty-state-desc">{error}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
            <div className="card" style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ marginBottom: 10 }}>
                <div className="section-title" style={{ marginBottom: 4 }}>Stores</div>
                <div className="section-subtitle">{stores.length} locations</div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {stores.map((s) => (
                  <div
                    key={s.store_id}
                    onClick={() => setSelected(s.store_id)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 3,
                      background: selected === s.store_id ? 'rgba(124,92,255,0.12)' : 'transparent',
                      border: `1px solid ${selected === s.store_id ? 'rgba(124,92,255,0.25)' : 'transparent'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{
                        fontSize: 12, fontWeight: selected === s.store_id ? 600 : 400,
                        color: selected === s.store_id ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                      }}>
                        {s.store_name}
                      </span>
                      <span className={`badge ${statusBadgeClass(s.status)}`} style={{ fontSize: 9 }}>
                        {s.status === 'NEEDS ATTENTION' ? '!' : s.status === 'STRONG' ? '+' : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {formatCurrency(s.revenue)} · Score {Number(s.performance_score).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, overflowY: 'auto' }}>
              {!selected && (
                <div className="empty-state">
                  <div className="empty-state-title">No store selected</div>
                  <div className="empty-state-desc">Choose a store to run a performance investigation.</div>
                </div>
              )}
              {invLoading && <div className="loading-screen"><div className="spinner" /></div>}
              {!invLoading && investigation && (() => {
                const inv = investigation;
                const m = inv.metrics;
                return (
                  <>
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.06), rgba(13,15,19,0))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, background: 'rgba(124,92,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Store size={20} color="var(--accent-primary)" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16, fontWeight: 700 }}>{inv.store_name}</span>
                            <span className={`badge ${statusBadgeClass(inv.status)}`}>{inv.status}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {inv.city} · Performance Score: {Number(inv.performance_score).toFixed(1)}/100
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(m.total_revenue)}</div>
                          <div className={deltaClass(m.revenue_trend_60d_pct)} style={{ fontSize: 12 }}>
                            {formatPct(m.revenue_trend_60d_pct, true)} vs prior period
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid-4">
                      {[
                        ['Revenue vs Peers', m.revenue_vs_peer_pct, '%', true],
                        ['Units vs Peers', m.units_vs_peer_pct, '%', true],
                        ['Return Rate', m.return_rate, '%', false],
                        ['Promo Rate', m.promo_rate, '%', false],
                      ].map(([label, val, unit, isDelta]) => (
                        <div key={String(label)} className="kpi-card">
                          <div className="kpi-label">{String(label)}</div>
                          <div className={`kpi-value ${isDelta ? deltaClass(Number(val)) : ''}`} style={{ fontSize: 18 }}>
                            {isDelta && Number(val) > 0 ? '+' : ''}{Number(val).toFixed(1)}{String(unit)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid-2">
                      <div className="card">
                        <div className="section-header"><div className="section-title">Monthly Revenue Trend</div></div>
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={inv.monthly_trend || []} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="month_str" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} tickFormatter={(v) => String(v || '').slice(5)} />
                            <YAxis tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(Number(v))} />
                            <Tooltip content={<CT />} />
                            <Line type="monotone" dataKey="revenue" stroke="#7C5CFF" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="card">
                        <div className="section-header"><div className="section-title">Category vs Peer Average</div></div>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={inv.category_performance || []} layout="vertical" margin={{ left: 80, right: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(0)}%`} />
                            <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: '#9299A6' }} tickLine={false} axisLine={false} />
                            <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
                            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                            <Bar dataKey="vs_peer_pct" name="vs Peer %" fill="#7C5CFF" radius={[0, 3, 3, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="card">
                      <div className="section-header"><div className="section-title">Investigation summary</div></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(inv.key_findings || []).map((f: string, i: number) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                            background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)',
                          }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%', background: 'rgba(124,92,255,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, color: 'var(--accent-secondary)', flexShrink: 0,
                            }}>
                              {i + 1}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card">
                      <div className="section-header"><div className="section-title">Weekend vs Weekday Performance</div></div>
                      <div className="grid-2">
                        <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Weekend AOV</div>
                          <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(m.weekend_aov)}</div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Weekday AOV</div>
                          <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(m.weekday_aov)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
