// Utility helpers

export function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('en-IN');
}

export function formatPct(value: number, sign = false): string {
  const s = sign && value > 0 ? '+' : '';
  return `${s}${value.toFixed(1)}%`;
}

export function deltaClass(value: number): string {
  if (value > 0) return 'delta-positive';
  if (value < 0) return 'delta-negative';
  return 'delta-neutral';
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'NEEDS ATTENTION': return 'badge-attention';
    case 'BELOW AVERAGE': return 'badge-below';
    case 'STRONG': return 'badge-strong';
    default: return 'badge-average';
  }
}

export function severityClass(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'critical';
    case 'WARNING': return 'warning';
    default: return 'observation';
  }
}

export function severityBadge(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'badge-critical';
    case 'WARNING': return 'badge-warning';
    default: return 'badge-observation';
  }
}
