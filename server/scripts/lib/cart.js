// scripts/lib/cart.js
//
// Pre-checkout cart operations for the purchase seeder.
//
// Two responsibilities, kept separate so the orchestrator can skip either:
//   1. validateCart(lines) — POST /api/cart/validate against the SAME server
//      pipeline the storefront runs before checkout. Rejects lines with
//      status: 'unavailable' | 'out_of_stock' and rewrites `price` on lines
//      the server flagged 'price_changed'. This is what keeps the seeder in
//      lockstep with product/tenant sale changes made between runs.
//   2. saveCart(lines) — POST /api/cart/save. Optional: the order endpoint
//      does not require a saved cart, but a real customer's cart is emptied
//      and rebuilt at checkout time, so populating it makes seeded traffic
//      look like real traffic in analytics.
//
// server/services/cart.service.js validateCartItems() returns per-line:
//   { subProductId, sizeId, status, available, currentPrice, priceDiff,
//     stockStatus, maxQuantity, ... }
// We only fold `status` and `currentPrice` back into the buyable rows here —
// the other fields are informational.

/**
 * @param {ApiClient} api               unauthenticated is fine; endpoint is public
 * @param {Array<object>} lines         buyable rows from catalog.extractBuyableLines
 * @returns {Promise<{ okLines: Array, dropped: Array<{ line, reason }> }>}
 */
async function validateCart(api, lines) {
  if (!lines.length) return { okLines: [], dropped: [] };

  const payload = lines.map((l) => ({
    subProductId: l.subProductId,
    sizeId: l.sizeId,
    quantity: l.quantity,
    price: l.price,
  }));

  const res = await api.post('/api/cart/validate', { items: payload });
  const results = res?.data?.items || [];

  const okLines = [];
  const dropped = [];

  results.forEach((r, idx) => {
    const line = lines[idx];
    if (!line) return;
    if (r.status === 'unavailable' || r.status === 'out_of_stock' || r.available === false) {
      dropped.push({ line, reason: r.status || 'unavailable' });
      return;
    }
    // `quantity_reduced` — clamp so we don't get a stock 400 at order-create time.
    let quantity = line.quantity;
    if (r.status === 'quantity_reduced' && Number.isFinite(r.maxQuantity)) {
      quantity = Math.max(1, Math.min(line.quantity, r.maxQuantity));
    }
    okLines.push({
      ...line,
      quantity,
      // Server may have moved the price (sale went live, pack rate applied);
      // use its number so subtotal/total submitted to the order endpoint match.
      price: Number.isFinite(r.currentPrice) && r.currentPrice > 0 ? r.currentPrice : line.price,
    });
  });

  return { okLines, dropped };
}

/**
 * Persist the (validated) cart against the authenticated customer.
 * `syncCart` on the server enforces `productId + subProductId + sizeId + tenantId`
 * per item, so the seeder must send tenantId here even though the order endpoint
 * derives it server-side.
 *
 * @param {ApiClient} customerApi   client bound to the customer's JWT
 * @param {Array<object>} lines
 * @returns {Promise<object>} { added, skipped, errors }
 */
async function saveCart(customerApi, lines) {
  if (!lines.length) return { added: 0, skipped: 0, errors: [] };

  const items = lines.map((l) => ({
    productId: l.productId,
    subProductId: l.subProductId,
    sizeId: l.sizeId,
    tenantId: l.tenantId,
    quantity: l.quantity,
    price: l.price,
  }));

  const res = await customerApi.post('/api/cart/save', { items });
  return res?.data?.results || { added: items.length, skipped: 0, errors: [] };
}

/**
 * Empty the cart after ordering, matching the storefront's post-checkout flow.
 * Best-effort — a failure here must not fail the customer's run.
 */
async function clearCart(customerApi) {
  try {
    await customerApi.request('DELETE', '/api/cart');
  } catch {
    // ignore
  }
}

module.exports = { validateCart, saveCart, clearCart };
