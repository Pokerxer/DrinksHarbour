import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

export function useDirectory<T>(
  fetcher: (
    token: string,
    params: Record<string, unknown>
  ) => Promise<{ data: T[]; pagination?: { pages: number } }>
) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, updateSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setError('');
    fetchRef
      .current(token, { page, limit: 50, search: query || undefined })
      .then((res) => {
        if (current) {
          setRows(res.data ?? []);
          setPages(res.pagination?.pages ?? 1);
        }
      })
      .catch((err) => {
        if (current) {
          setRows([]);
          setError(
            err instanceof Error ? err.message : 'Unable to load directory'
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token, page, query, revision]);
  return {
    rows,
    loading,
    page,
    pages,
    search,
    setSearch: updateSearch,
    setPage,
    error,
    retry: () => setRevision((value) => value + 1),
  };
}
