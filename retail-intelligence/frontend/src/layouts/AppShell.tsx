import type { ReactNode } from 'react';
import Sidebar from '../components/Sidebar';
import type { Page } from '../types';

interface AppShellProps {
  page: Page;
  onNavigate: (page: Page) => void;
  dataLoaded: boolean;
  children: ReactNode;
}

export default function AppShell({ page, onNavigate, dataLoaded, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar currentPage={page} onNavigate={onNavigate} dataLoaded={dataLoaded} />
      <div className="main-area">{children}</div>
    </div>
  );
}
