import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import Topbar from '../components/Topbar';
import AnalysisLoader from '../components/AnalysisLoader';
import { getDemandSummary, getProductList, getStoreSummary, predictDemand, trainDemandModel } from '../services/api';
import { formatNumber, formatPct, deltaClass } from '../utils/format';

const CT = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ fontSize: 12, fontWeight: 600, color: p.color }}>
          {p.name}: {formatNumber(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function DemandPage() {
  const [summary, setSummary] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [predForm, setPredForm] = useState({
    product_id: '', store_id: '', price: '', discount_percent: '0', promotion: '0', date: '',
  });
  const [predResult, setPredResult] = useState<any>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState('');
  const [modelMetrics, setModelMetrics] = useState<any>(null);
  const [avp, setAvp] = useState<any[]>([]);
  const [training, setTraining] = useState(false);

  useEffect(() => {
    Promise.all([getDemandSummary(), getProductList(), getStoreSummary()])
      .then(([sData, pData, stData]: [any, any, any]) => {
        const s = sData || {};
        const p = (pData || []) as any[];
        const st = (stData || []) as any[];
        setSummary(s);
        setProducts(p);
        setStores(st);
        const end = String(s.date_range_end || '2024-12-15');
        const firstPrice = p?.[0]?.total_sold && p?.[0]?.total_revenue
          ? Math.round(Number(p[0].total_revenue) / Number(p[0].total_sold))
          : 5000;
        setPredForm((f) => ({
          ...f,
          product_id: String(f.product_id || p?.[0]?.product_id || ''),
          store_id: String(f.store_id || st?.[0]?.store_id || ''),
          price: f.price || String(firstPrice),
          date: f.date || end,
        }));
        if (s.model?.mae) setModelMetrics(s.model);
        if (s.model?.actual_vs_predicted) setAvp(s.model.actual_vs_predicted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handlePredict = async () => {
    setPredLoading(true);
    setPredError('');
    setPredResult(null);
    try {
      if (!predForm.product_id || !predForm.store_id || !predForm.date) {
        throw new Error('Please fill product, store and date.');
      }
      const res = await predictDemand({
        product_id: predForm.product_id,
        store_id: predForm.store_id,
        price: Number(predForm.price) || 1000,
        discount_percent: Number(predForm.discount_percent) || 0,
        promotion: Number(predForm.promotion) || 0,
        date: predForm.date,
      });
      setPredResult(res);
      if (res.metrics) setModelMetrics(res.metrics);
      if (res.actual_vs_predicted) setAvp(res.actual_vs_predicted as any[]);
    } catch (e: unknown) {
      setPredError(e instanceof Error ? e.message : 'Prediction failed');
    } finally {
      setPredLoading(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await trainDemandModel();
      const metrics = (res.metrics || res) as any;
      setModelMetrics(metrics);
      if (metrics.actual_vs_predicted) setAvp(metrics.actual_vs_predicted);
    } catch (e: unknown) {
      setPredError(e instanceof Error ? e.message : 'Training failed');
    }
    setTraining(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Demand Intelligence" />
        <div className="content-area">
          <AnalysisLoader title="Calculating demand" steps={['Loading dataset', 'Engineering features', 'Summarizing demand']} activeIndex={1} />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Demand Intelligence" />
        <div className="content-area">
          <div className="empty-state">
            <div className="empty-state-icon"><AlertTriangle size={22} /></div>
            <div className="empty-state-title">No data available</div>
            <div className="empty-state-desc">{error || 'Generate or upload a dataset first.'}</div>
          </div>
        </div>
      </div>
    );
  }

  const metrics = predResult?.metrics || modelMetrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar title="Demand Intelligence" subtitle="Demand analysis and forecasting" />
      <div className="content-area">
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-label">Avg Daily Demand</div>
            <div className="kpi-value">{formatNumber(summary.avg_daily_demand)}</div>
            <div className="kpi-sub">Units / day</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Demand Growth</div>
            <div className={`kpi-value ${deltaClass(summary.demand_growth_pct)}`} style={{ fontSize: 18 }}>
              {formatPct(summary.demand_growth_pct, true)}
            </div>
            <div className="kpi-sub">Month-over-month</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Top Product</div>
            <div className="kpi-value" style={{ fontSize: 14, lineHeight: 1.3 }}>{summary.top_product}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Peak Period</div>
            <div className="kpi-value" style={{ fontSize: 14 }}>{summary.peak_demand_period}</div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="section-header"><div className="section-title">Demand over time</div></div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={(summary.daily_trend || []).slice(-60)} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="demGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#35D07F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#35D07F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false}
                  tickFormatter={(v) => String(v).slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CT />} />
                <Area type="monotone" dataKey="units_sold" name="Units" stroke="#35D07F" strokeWidth={2} fill="url(#demGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="section-header"><div className="section-title">Product demand comparison</div></div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summary.product_demand || []} layout="vertical" margin={{ left: 90, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(Number(v))} />
                <YAxis type="category" dataKey="product_name" tick={{ fontSize: 9, fill: '#9299A6' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CT />} />
                <Bar dataKey="demand" name="Demand" fill="#9B84FF" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="section-header"><div className="section-title">Category demand</div></div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={summary.category_demand || []} layout="vertical" margin={{ left: 80, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(Number(v))} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#9299A6' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CT />} />
                <Bar dataKey="demand" name="Demand" fill="#7C5CFF" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="section-header"><div className="section-title">Seasonal trends</div></div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={summary.seasonal_trend || []} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="season" tick={{ fontSize: 10, fill: '#606775' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(Number(v))} />
                <Tooltip content={<CT />} />
                <Bar dataKey="demand" name="Demand" fill="#4BA3FF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Actual vs predicted</div>
                <div className="section-subtitle">Hold-out sample from Random Forest Regressor</div>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => void handleTrain()} disabled={training} style={{ fontSize: 10 }}>
                {training ? 'Training…' : 'Train model'}
              </button>
            </div>
            {metrics && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                {[['Model', 'Random Forest'], ['MAE', Number(metrics.mae || 0).toFixed(3)], ['RMSE', Number(metrics.rmse || 0).toFixed(3)], ['R²', Number(metrics.r2 || 0).toFixed(3)]].map(([k, v]) => (
                  <div key={k} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {avp.length ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={avp} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="index" tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#606775' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#4BA3FF" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke="#7C5CFF" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Train the model or run a demand estimate to see hold-out accuracy.</div>
            )}
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Demand estimate</div>
                <div className="section-subtitle">Random Forest Regressor</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="form-label">Product</label>
                <select className="form-select" value={predForm.product_id} onChange={(e) => setPredForm((f) => ({ ...f, product_id: e.target.value }))}>
                  {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Store</label>
                <select className="form-select" value={predForm.store_id} onChange={(e) => setPredForm((f) => ({ ...f, store_id: e.target.value }))}>
                  {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Price (₹)</label>
                <input className="form-input" type="number" value={predForm.price} onChange={(e) => setPredForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Discount %</label>
                <input className="form-input" type="number" min={0} max={50} value={predForm.discount_percent} onChange={(e) => setPredForm((f) => ({ ...f, discount_percent: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Promotion</label>
                <select className="form-select" value={predForm.promotion} onChange={(e) => setPredForm((f) => ({ ...f, promotion: e.target.value }))}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div>
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={predForm.date} onChange={(e) => setPredForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void handlePredict()} disabled={predLoading} style={{ width: '100%', justifyContent: 'center' }}>
              {predLoading ? 'Estimating…' : 'Predict Demand'}
            </button>
            {predError && <div style={{ color: 'var(--color-danger)', fontSize: 11, marginTop: 8 }}>{predError}</div>}
            {predResult && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-default)' }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Predicted Demand</span>
                  <span className="badge badge-success">Estimate</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-secondary)', letterSpacing: '-1px' }}>
                  {Number(predResult.predicted_demand).toFixed(0)}
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>units</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Expected range: {Number(predResult.range_low).toFixed(0)} – {Number(predResult.range_high).toFixed(0)} units
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
