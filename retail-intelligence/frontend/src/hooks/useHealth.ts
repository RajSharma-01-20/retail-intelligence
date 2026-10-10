import { useCallback, useEffect, useState } from 'react';
import { getHealth } from '../services/api';

export function useHealth() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [records, setRecords] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const h = await getHealth();
      setDataLoaded(Boolean(h.dataset_loaded));
      setRecords(Number(h.records || 0));
    } catch {
      setDataLoaded(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { dataLoaded, records, refresh };
}
