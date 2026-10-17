'use client';
import { useEffect, useRef, useState } from 'react';
import { productService } from '@/services/product.service';
import { stockReportFromResponse, type StockReport } from './stock-report';
export function useProductOnHand(
  productId: string,
  token: string | undefined,
  onTotalChange?: (total: number) => void
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    report: StockReport | null;
    loading: boolean;
    error: string | null;
    updatedAt: Date | null;
  }>({ key: '', report: null, loading: true, error: null, updatedAt: null });
  const callback = useRef(onTotalChange);
  callback.current = onTotalChange;
  const key = `${productId}:${token || ''}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    setState({
      key,
      report: null,
      loading: !!token,
      error: token ? null : 'Sign in again to load stock details.',
      updatedAt: null,
    });
    if (!token) return () => controller.abort();
    void productService
      .getProductStock(productId, token, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const report = stockReportFromResponse(response);
        setState({
          key,
          report,
          loading: false,
          error: null,
          updatedAt: new Date(),
        });
        if (report.onHand !== null) callback.current?.(report.onHand);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            key,
            report: null,
            loading: false,
            error: 'Stock details could not be loaded. Please try again.',
            updatedAt: null,
          });
      });
    return () => controller.abort();
  }, [key, productId, token, attempt]);
  const current =
    state.key === key
      ? state
      : { report: null, loading: !!token, error: null, updatedAt: null };
  return { ...current, refresh: () => setAttempt((value) => value + 1) };
}
