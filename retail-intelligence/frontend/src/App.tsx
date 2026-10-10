import { useState } from 'react';
import AppShell from './layouts/AppShell';
import OverviewPage from './pages/OverviewPage';
import DemandPage from './pages/DemandPage';
import DetectivePage from './pages/DetectivePage';
import ProductsPage from './pages/ProductsPage';
import StoresPage from './pages/StoresPage';
import DatasetPage from './pages/DatasetPage';
import { useHealth } from './hooks/useHealth';
import type { Page } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const { dataLoaded, refresh } = useHealth();

  const renderPage = () => {
    switch (page) {
      case 'overview':
        return <OverviewPage />;
      case 'demand':
        return <DemandPage />;
      case 'detective':
        return <DetectivePage />;
      case 'products':
        return <ProductsPage />;
      case 'stores':
        return <StoresPage />;
      case 'dataset':
        return <DatasetPage onChanged={refresh} />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <AppShell page={page} onNavigate={setPage} dataLoaded={dataLoaded}>
      {renderPage()}
    </AppShell>
  );
}
