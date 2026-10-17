'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  customerReturnsService,
  type CustomerReturnPage,
  type ReturnFilters,
} from '@/services/customerReturns.service';
export function useCustomerReturns(token: string, filters: ReturnFilters) {
  const [data, setData] = useState<CustomerReturnPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const serialized = JSON.stringify(filters);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setData(null);
    setError('');
    setLoading(true);
    try {
      const result = await customerReturnsService.list(
        token,
        JSON.parse(serialized) as ReturnFilters
      );
      if (current === request.current) setData(result);
    } catch (failure) {
      if (current === request.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not load customer returns'
        );
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [token, serialized]);
  const invalidate = useCallback(() => {
    ++request.current;
  }, []);
  useEffect(() => {
    void refresh();
    return invalidate;
  }, [refresh, invalidate]);
  return { data, loading, error, refresh };
}
