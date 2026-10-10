import { LayoutDashboard, TrendingUp, Search, GitBranch, Store, Database } from 'lucide-react';
import type { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  dataLoaded: boolean;
}

const navGroups = [
  {
    label: 'Overview',
    items: [{ id: 'overview' as Page, label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'demand' as Page, label: 'Demand', icon: TrendingUp },
      { id: 'detective' as Page, label: 'Data Detective', icon: Search },
      { id: 'products' as Page, label: 'Product Explorer', icon: GitBranch },
      { id: 'stores' as Page, label: 'Store Investigator', icon: Store },
    ],
  },
  {
    label: 'Data',
    items: [{ id: 'dataset' as Page, label: 'Dataset', icon: Database }],
  },
];

export default function Sidebar({ currentPage, onNavigate, dataLoaded }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">RI</div>
        <div className="brand-name">Retail</div>
        <div className="brand-name">Intelligence</div>
      </div>

      {navGroups.map((group) => (
        <div key={group.label} className="nav-section">
          <div className="nav-section-label">{group.label}</div>
          {group.items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-item w-full text-left${currentPage === id ? ' active' : ''}`}
              onClick={() => onNavigate(id)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-status">
        <div className="nav-section-label" style={{ marginBottom: 6 }}>Data Status</div>
        <div className="flex items-center gap-2">
          <span className={`status-dot${dataLoaded ? '' : ' offline'}`} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {dataLoaded ? 'System Online' : 'No Dataset'}
          </span>
        </div>
      </div>
    </aside>
  );
}
