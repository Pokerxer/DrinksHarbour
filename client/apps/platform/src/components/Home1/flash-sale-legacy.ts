import type { SaleProduct } from "./flash-sale-types";
import { API_URL } from "@/lib/api";
const _saleCache = new Map<string, { data: SaleProduct[]; ts: number }>();
const SALE_CACHE_TTL = 60_000;
const SALE_QUERY = "sortBy=discount&limit=100&allPages=true";
const SALE_CACHE_KEY = SALE_QUERY;


export async function fetchSaleProducts(saleType?: string): Promise<SaleProduct[]> {
  const params = new URLSearchParams({
    sortBy: "discount",
    // The API applies its on-sale post-filter after pagination. Fetch a wider
    // window, then walk every page so discounted products later in the
    // catalogue are not lost.
    limit: "100",
  });
  if (saleType) params.set("saleType", saleType);

  const cached = _saleCache.get(SALE_CACHE_KEY);
  if (cached && Date.now() - cached.ts < SALE_CACHE_TTL) return cached.data;

  const fetchPage = async (page: number) => {
    const pageParams = new URLSearchParams(params);
    pageParams.set("page", String(page));
    const res = await fetch(`${API_URL}/api/products?${pageParams}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const products = data.success && data.data?.products
      ? data.data.products
      : Array.isArray(data.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];
    const totalPages = Number(data.data?.pagination?.totalPages || data.pagination?.totalPages || (products.length === 100 ? page + 1 : page));
    return { products, totalPages };
  };

  // Fetch page one first to learn the catalogue size, then request the
  // remaining pages concurrently. This still checks every product while
  // avoiding a full network waterfall.
  const firstPage = await fetchPage(1);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) => fetchPage(index + 2)),
  );
  const products = [firstPage, ...remainingPages].flatMap((pageResult) => pageResult.products);

  _saleCache.set(SALE_CACHE_KEY, { data: products, ts: Date.now() });
  return products;
}

