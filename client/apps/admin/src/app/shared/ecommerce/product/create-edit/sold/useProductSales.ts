'use client';
import { useEffect, useState } from 'react';
import { ProductReadError } from '@/services/product-read';
import { productService } from '@/services/product.service';
import { salesReportFromResponse, type SalesReport } from './sales-report';
export function useProductSales(productId: string, token: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    report: SalesReport | null;
    loading: boolean;
    error: string | null;
    updatedAt: Date | null;
  }>({ key: '', report: null, loading: true, error: null, updatedAt: null });
  const key = `${productId}:${token || ''}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    setState({
      key,
      report: null,
      loading: !!token && !!productId,
      error: token ? null : 'Sign in again to load sales history.',
      updatedAt: null,
    });
    if (!token || !productId) return () => controller.abort();
    void productService
      .getProductSalesHistory(productId, token, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const report = salesReportFromResponse(response);
        setState({
          key,
          report,
          loading: false,
          error: null,
          updatedAt: new Date(),
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            report: null,
            loading: false,
            error:
              error instanceof ProductReadError && error.status === 422
                ? error.message
                : error instanceof ProductReadError &&
                    [401, 403].includes(error.status)
                  ? 'Your session cannot access this sales history. Sign in with an authorized account.'
                  : 'Sales history could not be loaded. Please try again.',
            updatedAt: null,
          });
      });
    return () => controller.abort();
  }, [key, productId, token, attempt]);
  const current =
    state.key === key
      ? state
      : {
          report: null,
          loading: !!token && !!productId,
          error: null,
          updatedAt: null,
        };
  return { ...current, refresh: () => setAttempt((value) => value + 1) };
}
