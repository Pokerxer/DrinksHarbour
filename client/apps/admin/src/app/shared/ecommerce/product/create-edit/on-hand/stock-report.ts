export interface StockRow {
  key: string;
  tenant: string;
  sku: string;
  size: string;
  quantity: number | null;
  reserved: number | null;
  available: number | null;
  inconsistent: boolean;
  availability: string;
  listingStatus: string;
}
export interface StockReport {
  rows: StockRow[];
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  missingReservations: number;
  inconsistentBalances: number;
  knownOnHand: number;
  listings: number;
  missingQuantities: number;
  mismatchedListings: number;
}
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;
const quantity = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
const label = (value: unknown) => text(value, 'Unknown').replaceAll('_', ' ');

function balance(
  stock: number | null,
  reservedValue: unknown,
  availableValue: unknown
) {
  const reserved = quantity(reservedValue);
  const recordedAvailable = quantity(availableValue);
  const calculated =
    stock !== null && reserved !== null ? Math.max(0, stock - reserved) : null;
  return {
    reserved,
    available: calculated ?? recordedAvailable,
    inconsistent:
      (stock !== null && reserved !== null && reserved > stock) ||
      (calculated !== null &&
        recordedAvailable !== null &&
        calculated !== recordedAvailable),
  };
}
const sum = (rows: StockRow[], key: 'quantity' | 'reserved' | 'available') =>
  rows.every((row) => row[key] !== null)
    ? rows.reduce((total, row) => total + (row[key] ?? 0), 0)
    : null;

/** Match the editor's on-hand scope: listing total, or its size stocks when absent. */
export function buildStockReport(product: unknown): StockReport {
  const raw = record(product)?.subProducts;
  if (!Array.isArray(raw))
    throw new Error('Stock details were not returned. Please retry.');
  const rows: StockRow[] = [];
  let knownOnHand = 0,
    complete = true,
    mismatchedListings = 0;
  let reservedTotal = 0,
    availableTotal = 0,
    completeReserved = true,
    completeAvailable = true;
  for (let index = 0; index < raw.length; index++) {
    const value = raw[index];
    const listing = record(value);
    if (!listing)
      throw new Error('Stock details were incomplete. Please retry.');
    const tenant = text(record(listing.tenant)?.name, 'Tenant unavailable');
    const listingId = text(listing._id, `listing-${index}`);
    const sizes = Array.isArray(listing.sizes) ? listing.sizes : [];
    const aggregate = quantity(listing.totalStock);
    const listingRows = sizes.length
      ? sizes.map((value, sizeIndex): StockRow => {
          const size = record(value);
          const stock = quantity(size?.stock);
          return {
            key: `${listingId}:${text(size?._id, String(sizeIndex))}`,
            tenant,
            sku: text(size?.sku, text(listing.sku, '—')),
            size: text(
              size?.displayName,
              text(size?.size, 'Size details unavailable')
            ),
            quantity: stock,
            ...balance(stock, size?.reservedStock, size?.availableStock),
            availability:
              stock === 0 ? 'Out of stock' : label(size?.availability),
            listingStatus: label(listing.status),
          };
        })
      : [
          {
            key: listingId,
            tenant,
            sku: text(listing.sku, '—'),
            size: 'All sizes (listing total)',
            quantity: aggregate,
            ...balance(
              aggregate,
              listing.reservedStock,
              listing.availableStock
            ),
            availability: aggregate === 0 ? 'Out of stock' : 'Unknown',
            listingStatus: label(listing.status),
          },
        ];
    rows.push(...listingRows);
    const sizeTotal = sum(listingRows, 'quantity');
    if (
      aggregate !== null &&
      sizes.length &&
      sizeTotal !== null &&
      aggregate !== sizeTotal
    )
      mismatchedListings++;
    const total = aggregate ?? sizeTotal;
    const reserved =
      quantity(listing.reservedStock) ?? sum(listingRows, 'reserved');
    // Holds belong to a size: never offset an over-reservation against another size.
    const available =
      sum(listingRows, 'available') ??
      (total !== null && reserved !== null
        ? Math.max(0, total - reserved)
        : quantity(listing.availableStock));
    if (reserved === null) completeReserved = false;
    else reservedTotal += reserved;
    if (available === null) completeAvailable = false;
    else availableTotal += available;
    if (total === null) {
      complete = false;
      knownOnHand += listingRows.reduce(
        (sum, row) => sum + (row.quantity ?? 0),
        0
      );
    } else knownOnHand += total;
  }
  return {
    rows,
    onHand: complete ? knownOnHand : null,
    reserved: completeReserved ? reservedTotal : null,
    available: completeAvailable ? availableTotal : null,
    missingReservations: rows.filter((row) => row.reserved === null).length,
    inconsistentBalances: rows.filter((row) => row.inconsistent).length,
    knownOnHand,
    listings: raw.length,
    missingQuantities: rows.filter((row) => row.quantity === null).length,
    mismatchedListings,
  };
}
export function filterStockRows(rows: StockRow[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    const haystack =
      `${row.tenant} ${row.sku} ${row.size} ${row.listingStatus} ${row.availability}`.toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
export function stockReportFromResponse(response: unknown): StockReport {
  const envelope = record(response);
  if (envelope?.success !== true)
    throw new Error('Stock details could not be loaded.');
  return buildStockReport(record(envelope.data)?.product);
}
