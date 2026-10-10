import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Download, Database, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import Topbar from '../components/Topbar';
import AnalysisLoader from '../components/AnalysisLoader';
import { generateDataset, uploadDataset, getDatasetProfile, getDatasetPreview } from '../services/api';
import { formatCurrency, formatNumber } from '../utils/format';

type Tab = 'generate' | 'upload' | 'profile' | 'preview';

interface DatasetPageProps {
  onChanged?: () => void;
}

export default function DatasetPage({ onChanged }: DatasetPageProps) {
  const [tab, setTab] = useState<Tab>('generate');
  const [profile, setProfile] = useState<any>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: any[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [genParams, setGenParams] = useState({ records: 15000, products: 50, stores: 10, months: 12 });
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    getDatasetProfile().then(setProfile).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setGenLoading(true);
    setGenResult(null);
    setError('');
    try {
      const res = await generateDataset(genParams);
      setGenResult(res);
      setProfile(res.profile);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setLoading(true);
    setUploadResult(null);
    setError('');
    try {
      const res = await uploadDataset(file);
      setUploadResult(res);
      setProfile(res.profile);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const p = await getDatasetPreview(100);
      setPreview(p);
      setTab('preview');
      setPage(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    let rows = preview.rows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) => preview.columns.some((c) => String(row[c] ?? '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return rows;
  }, [preview, search, sortKey, sortDir]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (col: string) => {
    if (sortKey === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(col);
      setSortDir('asc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar
        title="Dataset Management"
        subtitle="Generate, upload, and profile retail data"
        actions={profile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/api/dataset/download/xlsx" className="btn btn-ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
              <Download size={12} /> XLSX
            </a>
            <a href="/api/dataset/download/csv" className="btn btn-ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
              <Download size={12} /> CSV
            </a>
          </div>
        )}
      />
      <div className="content-area">
        <div className="filter-tabs" style={{ marginBottom: 20, display: 'inline-flex' }}>
          {([['generate', 'Generate'], ['upload', 'Upload'], ['profile', 'Data Profile'], ['preview', 'Preview']] as [Tab, string][]).map(([id, label]) => (
            <div key={id} className={`filter-tab${tab === id ? ' active' : ''}`} onClick={() => { setTab(id); if (id === 'preview' && !preview) void loadPreview(); }}>
              {label}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(255,92,103,0.08)', border: '1px solid rgba(255,92,103,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {tab === 'generate' && (
          <div className="grid-2" style={{ maxWidth: 900 }}>
            <div className="card">
              <div className="section-header"><div className="section-title">Generate Synthetic Dataset</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  ['records', 'Records', 1000, 50000],
                  ['products', 'Products', 10, 100],
                  ['stores', 'Stores', 2, 20],
                  ['months', 'Months Range', 1, 36],
                ].map(([key, label, min, max]) => (
                  <div key={String(key)}>
                    <label className="form-label">{String(label)}</label>
                    <input
                      className="form-input"
                      type="number"
                      min={Number(min)}
                      max={Number(max)}
                      value={(genParams as any)[key]}
                      onChange={(e) => setGenParams((p) => ({ ...p, [key as string]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-primary" onClick={() => void handleGenerate()} disabled={genLoading} style={{ width: '100%', justifyContent: 'center', padding: 10 }}>
                {genLoading ? 'Generating…' : 'Generate Dataset'}
              </button>
              {genLoading && (
                <AnalysisLoader
                  title="Generating synthetic retail data"
                  steps={['Building product catalog', 'Creating store network', 'Generating transactions', 'Injecting realistic patterns', 'Writing Excel/CSV']}
                  activeIndex={2}
                />
              )}
              {genResult && (
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(53,208,127,0.06)', borderRadius: 6, border: '1px solid rgba(53,208,127,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <CheckCircle size={14} color="var(--color-success)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>Dataset generated</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {[
                      ['Records', genResult.profile?.total_records?.toLocaleString()],
                      ['Products', genResult.profile?.unique_products],
                      ['Stores', genResult.profile?.unique_stores],
                      ['Date Range', `${genResult.profile?.date_range_start} → ${genResult.profile?.date_range_end}`],
                    ].map(([k, v]) => (
                      <div key={String(k)} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{k}: </span>{v}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {profile ? (
              <div className="card">
                <div className="section-header">
                  <div className="section-title">Current Dataset</div>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => void loadPreview()}>Preview</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Total Records', formatNumber(profile.total_records)],
                    ['Total Columns', profile.total_columns],
                    ['Unique Products', profile.unique_products],
                    ['Unique Stores', profile.unique_stores],
                    ['Total Sales', formatCurrency(profile.total_sales)],
                    ['Avg Transaction', formatCurrency(profile.avg_transaction_value)],
                    ['Missing Values', profile.missing_values],
                    ['Duplicates', profile.duplicate_records],
                    ['Date Range', `${profile.date_range_start}`],
                    ['Through', profile.date_range_end],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="metric-row">
                      <span className="metric-label">{k}</span>
                      <span className="metric-value">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card empty-state">
                <div className="empty-state-icon"><Database size={22} /></div>
                <div className="empty-state-title">No dataset available</div>
                <div className="empty-state-desc">Generate a synthetic retail dataset or upload an Excel/CSV file to begin.</div>
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div style={{ maxWidth: 560 }}>
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Upload Dataset</div>
              <div
                className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void handleUpload(file);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }} />
                <Upload size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Drop your file here or click to browse
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supported: .xlsx, .csv · Max 50MB</div>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Required Columns</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['transaction_id', 'date', 'store_id', 'product_id', 'price', 'units_sold', 'category'].map((c) => (
                    <span key={c} className="info-chip">{c}</span>
                  ))}
                </div>
              </div>
              {loading && <div style={{ marginTop: 16 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
              {uploadResult && (
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(53,208,127,0.06)', borderRadius: 6, border: '1px solid rgba(53,208,127,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={14} color="var(--color-success)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>
                      File uploaded — {formatNumber(Number(uploadResult.profile?.total_records || 0))} records
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ maxWidth: 800 }}>
            {!profile ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Database size={22} /></div>
                <div className="empty-state-title">No dataset loaded</div>
                <div className="empty-state-desc">Generate or upload a dataset to see its profile.</div>
              </div>
            ) : (
              <div className="grid-3" style={{ gap: 12 }}>
                {[
                  ['Total Records', formatNumber(profile.total_records)],
                  ['Total Columns', profile.total_columns],
                  ['Unique Products', profile.unique_products],
                  ['Unique Stores', profile.unique_stores],
                  ['Missing Values', profile.missing_values],
                  ['Duplicate Records', profile.duplicate_records],
                  ['Total Sales', formatCurrency(profile.total_sales)],
                  ['Avg Transaction', formatCurrency(profile.avg_transaction_value)],
                  ['Date Coverage', `${profile.date_range_start} to ${profile.date_range_end}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="kpi-card">
                    <div className="kpi-label">{label}</div>
                    <div className="kpi-value" style={{ fontSize: 16 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'preview' && (
          <div className="card" style={{ overflow: 'auto' }}>
            {loading && <div className="loading-screen"><div className="spinner" /></div>}
            {!loading && preview && (
              <>
                <div className="section-header">
                  <div className="section-title">Data Preview</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="form-input" style={{ width: 180 }} placeholder="Search rows" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {filteredRows.length} of {preview.total.toLocaleString()} shown
                    </span>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {preview.columns.map((c) => (
                          <th key={c} onClick={() => toggleSort(c)} style={{ cursor: 'pointer' }}>
                            {c}{sortKey === c ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, i) => (
                        <tr key={i}>
                          {preview.columns.map((c) => (
                            <td key={c} className={typeof row[c] === 'number' ? 'numeric' : ''}>{String(row[c] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>{page + 1} / {pageCount}</span>
                  <button type="button" className="btn btn-ghost" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </>
            )}
            {!loading && !preview && (
              <div className="empty-state">
                <div className="empty-state-icon"><FileText size={22} /></div>
                <div className="empty-state-title">No preview available</div>
                <div className="empty-state-desc">Generate or upload a dataset first.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
