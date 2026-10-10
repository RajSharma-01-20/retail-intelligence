const BASE = '/api';

function parseDetail(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const detail = (err as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: string }).msg);
        return JSON.stringify(item);
      })
      .join('; ');
  }
  return fallback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(parseDetail(err, `Request failed: ${res.status}`));
  }
  return res.json();
}

export const getHealth = () => request<{ status: string; dataset_loaded: boolean; records: number }>('/health');
export const getDashboard = () => request<Record<string, unknown>>('/dashboard');

export const generateDataset = (params: {
  records: number;
  products: number;
  stores: number;
  months: number;
}) => request<Record<string, unknown>>('/dataset/generate', {
  method: 'POST',
  body: JSON.stringify(params),
});

export const uploadDataset = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<Record<string, unknown>>('/dataset/upload', { method: 'POST', body: form });
};

export const getDatasetProfile = () => request<Record<string, unknown>>('/dataset/profile');
export const getDatasetPreview = (n = 100) =>
  request<{ columns: string[]; rows: Record<string, unknown>[]; total: number }>(`/dataset/preview?n=${n}`);

export const getDemandSummary = () => request<Record<string, unknown>>('/demand/summary');
export const getDemandTrends = () => request<Record<string, unknown>>('/demand/trends');
export const trainDemandModel = () => request<Record<string, unknown>>('/demand/train');
export const predictDemand = (params: {
  product_id: string;
  store_id: string;
  price: number;
  discount_percent: number;
  promotion: number;
  date: string;
}) => request<Record<string, unknown>>('/demand/predict', { method: 'POST', body: JSON.stringify(params) });

export const getFindings = (force = false) =>
  request<Record<string, unknown>>(`/detective/findings${force ? '?force=true' : ''}`);

export const getProductList = () => request<Record<string, unknown>[]>('/products/list');
export const getAllRelationships = (limit = 50) =>
  request<{ relationships: Record<string, unknown>[] }>(`/products/relationships?limit=${limit}`);
export const getProductRelationships = (productId: string) =>
  request<Record<string, unknown>>(`/products/${encodeURIComponent(productId)}/relationships`);

export const getStoreSummary = () => request<Record<string, unknown>[]>('/stores/summary');
export const getStoreInvestigation = (storeId: string) =>
  request<Record<string, unknown>>(`/stores/${encodeURIComponent(storeId)}/investigation`);
