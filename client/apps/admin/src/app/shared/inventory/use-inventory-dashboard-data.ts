import { useCallback, useEffect, useRef, useState } from 'react';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
/** Clear failed feeds so refreshed totals never combine current and stale data. */
export function useInventoryDashboardData(token: string) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'refreshing' | 'ready' | 'error'>('loading');
  const [errors, setErrors] = useState<string[]>([]);
  const [stockAvailable, setStockAvailable] = useState(false);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!token) return;
    const current = ++request.current;
    setStatus((old) => (old === 'loading' ? 'loading' : 'refreshing'));
    const [stock, history] = await Promise.allSettled([
      warehouseStockService.getAllStock(token, { includeUnstocked: true }),
      inventoryService.getAllMovements(token),
    ]);
    if (current !== request.current) return;
    const failures: string[] = [];
    setStockAvailable(stock.status === 'fulfilled');
    setHistoryAvailable(history.status === 'fulfilled');
    if (stock.status === 'fulfilled') setStockRows(stock.value.data);
    else {
      setStockRows([]);
      failures.push(
        `Stock unavailable: ${stock.reason instanceof Error ? stock.reason.message : 'Unable to load stock'}`,
      );
    }
    if (history.status === 'fulfilled') {
      setMovements(history.value.movements);
      setIncomplete(history.value.truncated);
    } else {
      setMovements([]);
      setIncomplete(false);
      failures.push(
        `History unavailable: ${history.reason instanceof Error ? history.reason.message : 'Unable to load history'}`,
      );
    }
    setErrors(failures);
    setStatus(failures.length === 2 ? 'error' : 'ready');
    setLastUpdated(failures.length ? null : new Date().toISOString());
  }, [token]);
  useEffect(() => {
    setStockRows([]);
    setMovements([]);
    setStockAvailable(false);
    setHistoryAvailable(false);
    setStatus('loading');
    setLastUpdated(null);
    if (token) void load();
    return () => {
      request.current++;
    };
  }, [load, token]);
  return {
    stockRows,
    movements,
    status,
    errors,
    stockAvailable,
    historyAvailable,
    incomplete,
    lastUpdated,
    load,
  };
}
