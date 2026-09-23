import { z } from 'zod';
const recordSchema = z.object({ _id: z.string() }).passthrough();
const paginationSchema = z.object({
  totalPages: z.number().optional(),
  pages: z.number().optional(),
});
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .union([
      z.array(recordSchema),
      z.object({
        orders: z.array(recordSchema),
        pagination: paginationSchema.optional(),
      }),
    ])
    .optional(),
  pagination: paginationSchema.optional(),
});
export type HistoryRecord = z.infer<typeof recordSchema>;
type SalesItem = {
  subproduct?: string | { _id: string };
  quantity?: number;
  itemSubtotal?: number;
  priceAtPurchase?: number;
};
type SalesOrder = {
  items?: SalesItem[];
  isVoided?: boolean;
  paymentStatus?: string;
  totalAmount?: number;
  total?: number;
  refunds?: { totalRefunded?: number }[];
};
export function salesLine(order: SalesOrder, productId: string) {
  const lines = (order.items ?? []).filter(
    (item) =>
      (typeof item.subproduct === 'string'
        ? item.subproduct
        : item.subproduct?._id) === productId
  );
  if (!lines.length) return undefined;
  const quantity = lines.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const itemSubtotal = lines.reduce(
    (sum, item) =>
      sum +
      (item.itemSubtotal ?? (item.priceAtPurchase ?? 0) * (item.quantity ?? 0)),
    0
  );
  return {
    quantity,
    itemSubtotal,
    priceAtPurchase: quantity ? itemSubtotal / quantity : 0,
  };
}
export function salesStatus(order: SalesOrder) {
  const refunded = (order.refunds ?? []).reduce(
    (sum, refund) => sum + (refund.totalRefunded ?? 0),
    0
  );
  if (order.isVoided) return 'Voided';
  if (
    order.paymentStatus === 'refunded' ||
    (refunded > 0 && refunded >= (order.totalAmount ?? order.total ?? Infinity))
  )
    return 'Refunded';
  if (refunded > 0 || order.paymentStatus === 'partially_refunded')
    return 'Part. Returned';
  return (order.paymentStatus || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
export function pageNumbers(page: number, total: number) {
  const start = Math.max(1, Math.min(page - 2, total - 4));
  return Array.from(
    new Set([
      1,
      ...Array.from({ length: Math.min(5, total) }, (_, i) => start + i),
      total,
    ])
  ).sort((a, b) => a - b);
}
export async function loadHistory(
  url: string,
  token: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
): Promise<HistoryRecord[]> {
  if (!token) throw new Error('Please sign in to view history.');
  const records = new Map<string, HistoryRecord>();
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    signal.throwIfAborted();
    const request = new URL(url);
    request.searchParams.set('page', String(page));
    request.searchParams.set('limit', '100');
    const response = await fetcher(request.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    const body = responseSchema.parse(await response.json());
    if (!response.ok || !body.success)
      throw new Error(body.message || 'Unable to load history. Please retry.');
    const rows = Array.isArray(body.data) ? body.data : body.data?.orders;
    if (!Array.isArray(rows))
      throw new Error('History returned an invalid response. Please retry.');
    const pagination =
      body.pagination ??
      (Array.isArray(body.data) ? undefined : body.data?.pagination);
    pages = Math.max(
      1,
      Number(pagination?.totalPages ?? pagination?.pages ?? 1)
    );
    if (!Number.isSafeInteger(pages))
      throw new Error('History returned invalid pagination.');
    for (const row of rows) records.set(row._id, row);
  }
  return Array.from(records.values());
}

// Alternatives within one filter category are ORed; separate categories intersect.
export function matchesChoices(
  filters: ReadonlySet<string>,
  choices: Record<string, boolean>
) {
  const selected = Object.keys(choices).filter((key) => filters.has(key));
  return selected.length === 0 || selected.some((key) => choices[key]);
}
