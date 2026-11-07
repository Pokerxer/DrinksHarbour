import { brandCardData, displayableBrands, type BrandCardData } from '../../app/brands/brand-results.ts';

interface LoadBrandsOptions {
  apiUrl: string;
  search?: string;
  country?: string;
  signal?: AbortSignal;
  revalidate?: number;
  fetcher?: typeof fetch;
}

type BrandResponse = {
  success?: boolean;
  data?: {
    brands?: BrandCardData[];
    pagination?: { page?: number; pages?: number; totalPages?: number; total?: number };
  };
};

/** The public API owns matching (including aliases); collect its complete result set. */
export async function loadBrands({
  apiUrl, search, country, signal, revalidate, fetcher = fetch,
}: LoadBrandsOptions): Promise<BrandCardData[]> {
  const brands = new Map<string, BrandCardData>();
  let pages = 1;
  let received = 0;
  let total: number | undefined;

  for (let page = 1; page <= pages; page += 1) {
    signal?.throwIfAborted();
    const params = new URLSearchParams({ status: 'active', limit: '500', page: String(page) });
    if (search?.trim()) params.set('search', search.trim());
    if (country?.trim()) params.set('country', country.trim());
    const options: RequestInit & { next?: { revalidate: number } } = { signal };
    if (revalidate === undefined) options.cache = 'no-store';
    else options.next = { revalidate };

    const response = await fetcher(`${apiUrl.replace(/\/$/, '')}/api/brands?${params}`, options);
    signal?.throwIfAborted();
    if (!response.ok) throw new Error('Could not load brands. Please try again.');
    const payload: BrandResponse = await response.json();
    signal?.throwIfAborted();
    const rows = payload?.data?.brands;
    const pagination = payload?.data?.pagination;
    const pageCount = pagination?.totalPages ?? pagination?.pages;
    const pageTotal = pagination?.total;

    if (payload?.success !== true || !Array.isArray(rows) || !pagination ||
      !Number.isInteger(pageCount) || pageCount! < 0 ||
      !Number.isInteger(pageTotal) || pageTotal! < 0 ||
      (pagination.page !== undefined && pagination.page !== page) ||
      (page > 1 && (pageCount !== pages || pageTotal !== total)) ||
      (pageCount === 0 && (rows.length > 0 || pageTotal !== 0)) ||
      (rows.length === 0 && pageTotal! > 0)) {
      throw new Error('Could not load the complete brands directory. Please try again.');
    }

    pages = pageCount!;
    total = pageTotal;
    received += rows.length;
    for (const brand of displayableBrands(rows)) {
      if (!brands.has(brand._id)) brands.set(brand._id, brandCardData(brand));
    }
  }

  if (total !== undefined && received < total) {
    throw new Error('Could not load the complete brands directory. Please try again.');
  }
  return Array.from(brands.values());
}
