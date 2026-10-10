import type { ReactNode } from 'react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="topbar">
      <div style={{ flex: 1 }}>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-crumb">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
