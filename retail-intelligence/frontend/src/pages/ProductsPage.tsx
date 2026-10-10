import { useEffect, useMemo, useState } from 'react';
import { GitBranch, AlertTriangle, ArrowRight } from 'lucide-react';
import Topbar from '../components/Topbar';
import { getProductList, getProductRelationships } from '../services/api';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [relData, setRelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relLoading, setRelLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    getProductList()
      .then((p: any) => {
        const list = (p || []) as any[];
        setProducts(list);
        if (list.length) setSelected(String(list[0].product_id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setRelLoading(true);
    setRelData(null);
    getProductRelationships(selected)
      .then(setRelData)
      .catch((e) => setError(e.message))
      .finally(() => setRelLoading(false));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter((p) => !q || String(p.product_name).toLowerCase().includes(q) || String(p.category).toLowerCase().includes(q));
  }, [products, query]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Product Explorer" />
        <div className="content-area"><div className="loading-screen"><div className="spinner" /></div></div>
      </div>
    );
  }

  if (error && !products.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar title="Product Explorer" />
        <div className="content-area">
          <div className="empty-state">
            <div className="empty-state-icon"><AlertTriangle size={22} /></div>
            <div className="empty-state-title">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const relationships = relData?.relationships || [];
  const maxCount = relationships.length ? relationships[0].co_purchase_count : 1;
  const nodes = relationships.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar title="Product Relationship Explorer" subtitle="Co-purchase analysis and association discovery" />
      <div className="content-area">
        <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
          <div className="card" style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ marginBottom: 10 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Select Product</div>
              <input className="form-input" placeholder="Search SKUs" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.map((p) => (
                <div
                  key={p.product_id}
                  onClick={() => setSelected(p.product_id)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: selected === p.product_id ? 'rgba(124,92,255,0.12)' : 'transparent',
                    border: `1px solid ${selected === p.product_id ? 'rgba(124,92,255,0.25)' : 'transparent'}`,
                  }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: selected === p.product_id ? 600 : 400,
                    color: selected === p.product_id ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                    marginBottom: 1, lineHeight: 1.3,
                  }}>
                    {p.product_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.category}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {relData && (
              <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.06), rgba(13,15,19,0))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: 'rgba(124,92,255,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GitBranch size={18} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{relData.product_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relData.category} · {relationships.length} related products found</div>
                  </div>
                </div>
              </div>
            )}

            {relLoading && <div className="loading-screen"><div className="spinner" /></div>}

            {!relLoading && relationships.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon"><GitBranch size={22} /></div>
                <div className="empty-state-title">No relationships found</div>
                <div className="empty-state-desc">This product does not appear with others frequently enough to establish associations.</div>
              </div>
            )}

            {!relLoading && relationships.length > 0 && (
              <>
                <div className="card">
                  <div className="section-title" style={{ marginBottom: 8 }}>Relationship map</div>
                  <svg viewBox="0 0 640 220" style={{ width: '100%', height: 220 }}>
                    <circle cx="120" cy="110" r="36" fill="rgba(124,92,255,0.18)" stroke="#7C5CFF" />
                    <text x="120" y="114" textAnchor="middle" fill="#F5F7FA" fontSize="10" fontWeight="600">
                      {(relData.product_name || '').slice(0, 16)}
                    </text>
                    {nodes.map((rel: any, i: number) => {
                      const y = 24 + i * 24;
                      const w = 80 + (rel.co_purchase_count / maxCount) * 140;
                      return (
                        <g key={rel.product_b_id || i}>
                          <line x1="156" y1="110" x2="280" y2={y} stroke="rgba(155,132,255,0.35)" strokeWidth="1.5" />
                          <rect x="280" y={y - 10} width={w} height="18" rx="4" fill="rgba(23,26,33,0.95)" stroke="rgba(255,255,255,0.08)" />
                          <text x="288" y={y + 3} fill="#9299A6" fontSize="10">{rel.product_b}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="section-header">
                    <div className="section-title">Related Products</div>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {relationships.map((rel: any, i: number) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <ArrowRight size={11} color="var(--text-muted)" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rel.product_b}</span>
                          </div>
                          <div className="rel-bar-container">
                            <div className="rel-bar-track">
                              <div className="rel-bar-fill" style={{ width: `${(rel.co_purchase_count / maxCount) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                          <div style={{ textAlign: 'center', minWidth: 54 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{rel.co_purchase_count.toLocaleString()}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pairs</div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 54 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-secondary)' }}>{(rel.confidence * 100).toFixed(1)}%</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 54 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-info)' }}>{(rel.support * 100).toFixed(2)}%</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Support</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
