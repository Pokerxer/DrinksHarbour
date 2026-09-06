// scripts/lib/catalog.js
//
// Discover buyable Product × SubProduct × Size combinations.
//
// ── Why this uses the ADMIN subproduct endpoint, not the public product page ──
//
// The natural discovery path would be:
//     GET /api/products        → summaries
//     GET /api/products/:id    → detail with subProducts[] + sizes[]
//
// That path is currently BROKEN and returns `subProducts: []` for every
// product, so nothing is discoverable through it.
//
//   Root cause: services/product.service.js getProductById() (and
//   getProductBySlug()) assign the populated listings to
//   `product.subProducts`, but helpers/buildProductQuery.helper.js reads
//   `product.activeSubProducts` (lines 246, 255, 369, 409, 413, 485).
//   getAllProducts works because product.service.js:9084 does the
//   `product.activeSubProducts = product.subProducts || []` handoff; the
//   by-id/by-slug paths never do. Every product detail response therefore
//   reports availability.tenantCount 0 / "Not available yet" regardless of
//   real stock.
//
//   Verified against the live dataset on this machine: 894 published
//   SubProducts and 581 in-stock Sizes exist, yet /api/products/:id returned
//   0 subProducts for all of them. Injecting `activeSubProducts` in-process
//   immediately produced `{ totalStock: 26, tenantCount: 1, isAvailable: true }`
//   for the same product.
//
// The operator chose to leave the service bug alone for now, so the seeder
// sources inventory from the admin listing endpoint instead:
//
//     GET /api/subproducts?page&limit     (authenticate + attachTenant +
//                                          tenantAdminOrSuperAdmin)
//
// which returns SubProducts with `product` (name/type/isAlcoholic), a fully
// populated `sizes[]`, and — for super_admin with no tenant scope — `tenant`.
// This requires the admin JWT the seeder already needs for order transitions.
//
// WHEN THE SERVICE BUG IS FIXED, switch back: collectViaPublicCatalog() below
// is kept working and is the preferred path (it exercises the same surface a
// real customer hits). Pass `{ source: 'public' }` to use it.

const { ageFromDob } = require('./fake-data');

// Size.availability values that mean "a customer can buy this right now".
//
// 'in_stock' is a LEGACY value that is not in the Size schema enum
// (models/Size.js declares available|low_stock|out_of_stock|pre_order|
// coming_soon|discontinued|backorder|limited_stock). A normalising hook at
// Size.js:739 rewrites 'in_stock' → 'available', but it only fires on
// document .save() — bulk-inserted seed data never passed through it. On this
// dataset 439 of 1023 Sizes still carry 'in_stock' with real stock behind them.
//
// Excluding it would hide ~43% of sellable inventory from the seeder, so it is
// treated as an alias for 'available'. The cart/order endpoints only reject
// `availability === 'out_of_stock'` (services/cart.service.js), so ordering an
// 'in_stock' size succeeds — this is purely a discovery-side concern.
const SELLABLE_AVAILABILITY = ['available', 'low_stock', 'in_stock'];

// ────────────────────────────────────────────────────────────────────────────
// Shared row shape
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalise one SubProduct + Size pair into a buyable row.
 * `price` must be the customer-facing price. On the admin endpoint the only
 * price available is the tenant-facing Size.sellingPrice — the order controller
 * recomputes the authoritative platform price server-side anyway (it only falls
 * back to our number when a line cannot be priced), and POST /api/cart/validate
 * rewrites it before we order. So sellingPrice is a safe seed value.
 */
function toRow({ product, subProduct, size, tenant }) {
  const stock = Number(size.stock) || 0;
  const availability = String(size.availability || '').toLowerCase();
  const price = Number(size.pricing?.websitePrice ?? size.sellingPrice);

  if (stock <= 0) return null;
  if (!SELLABLE_AVAILABILITY.includes(availability)) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!tenant?._id) return null;

  return {
    productId:    String(product._id),
    productName:  product.name,
    productType:  product.type,
    isAlcoholic:  !!product.isAlcoholic,
    subProductId: String(subProduct._id),
    tenantId:     String(tenant._id),
    tenantName:   tenant.name || null,
    sizeId:       String(size._id),
    sizeName:     size.size || size.displayName || null,
    stock,
    price,
    minOrderQuantity: Number(size.minOrderQuantity) || 1,
    maxOrderQuantity: Number(size.maxOrderQuantity) || null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Source A — admin subproduct listing (default; works today)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param {ApiClient} adminApi   MUST carry a super_admin/admin JWT
 * @param {object} opts
 * @param {number} opts.pages
 * @param {number} opts.limitPerPage
 * @returns {Promise<Array>} buyable rows
 */
async function collectViaAdminListing(adminApi, { pages = 4, limitPerPage = 50 } = {}) {
  const rows = [];

  for (let page = 1; page <= pages; page += 1) {
    const res = await adminApi.get('/api/subproducts', {
      query: { page, limit: limitPerPage, status: 'active' },
    });
    const payload = res?.data || {};
    const list = payload.subProducts || payload.data || payload.items || [];
    if (!Array.isArray(list) || list.length === 0) break;

    for (const sp of list) {
      const product = sp.product;
      // `product` is populated; skip listings whose product was removed or is
      // not approved — ordering one would 400 at the cart/product check.
      if (!product?._id) continue;
      if (product.status && product.status !== 'approved') continue;
      if (sp.isPublished === false) continue;

      const tenant = sp.tenant && typeof sp.tenant === 'object'
        ? sp.tenant
        : { _id: sp.tenant, name: null };

      for (const size of sp.sizes || []) {
        const row = toRow({ product, subProduct: sp, size, tenant });
        if (row) rows.push(row);
      }
    }

    // getMySubProducts returns { page, limit, total, pages, hasNext, hasPrev } —
    // note `pages`, not `totalPages` (which is what /api/products uses).
    const pag = payload.pagination || {};
    if (pag.hasNext === false) break;
    const totalPages = pag.pages ?? pag.totalPages ?? 1;
    if (page >= totalPages) break;
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// Source B — public catalog (preferred once the service bug is fixed)
// ────────────────────────────────────────────────────────────────────────────

async function listProductSummaries(api, { pages = 3, limitPerPage = 24 } = {}) {
  const out = [];
  for (let page = 1; page <= pages; page += 1) {
    const res = await api.get('/api/products', { query: { page, limit: limitPerPage } });
    const products = res?.data?.products || [];
    if (products.length === 0) break;
    out.push(...products);
    const totalPages = res?.data?.pagination?.totalPages ?? 1;
    if (page >= totalPages) break;
  }
  return out;
}

async function getProductDetail(api, productId) {
  try {
    const res = await api.get(`/api/products/${productId}`);
    return res?.data?.product || null;
  } catch (err) {
    // "not currently available from any seller" is a legitimate 404 to skip.
    if (err?.status === 404) return null;
    throw err;
  }
}

function extractBuyableLines(product) {
  if (!product || !Array.isArray(product.subProducts)) return [];
  const rows = [];
  for (const sp of product.subProducts) {
    if (!sp?.tenant?._id) continue;
    for (const size of sp.sizes || []) {
      const row = toRow({ product, subProduct: sp, size, tenant: sp.tenant });
      if (row) rows.push(row);
    }
  }
  return rows;
}

async function collectViaPublicCatalog(api, { sampleSize = 12, random = Math.random } = {}) {
  const summaries = await listProductSummaries(api, { pages: 3 });
  if (summaries.length === 0) return [];

  const shuffled = [...summaries]
    .sort(() => random() - 0.5)
    .slice(0, Math.min(sampleSize, summaries.length));

  const rows = [];
  for (const p of shuffled) {
    const detail = await getProductDetail(api, p._id);
    if (!detail) continue;
    rows.push(...extractBuyableLines(detail));
  }
  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Collect buyable rows this customer is allowed to purchase.
 * Age-gates alcoholic products against the customer's DOB.
 *
 * @param {object} opts
 * @param {ApiClient} opts.api          unauthenticated client (public source)
 * @param {ApiClient} [opts.adminApi]   admin client (admin source; required for 'admin')
 * @param {object} opts.customer        needs dateOfBirth
 * @param {'admin'|'public'} [opts.source]
 * @returns {Promise<Array>} buyable rows
 */
async function collectBuyableLines({ api, adminApi, customer, source = 'admin', sampleSize = 12, random = Math.random }) {
  const isAdult = ageFromDob(customer.dateOfBirth) >= 18;

  let rows;
  if (source === 'admin') {
    if (!adminApi) {
      throw new Error(
        "catalog: source 'admin' requires an admin API client. Pass --admin-email/--admin-password, " +
        "or use --catalog-source public once the getProductById activeSubProducts bug is fixed.",
      );
    }
    rows = await collectViaAdminListing(adminApi);
  } else {
    rows = await collectViaPublicCatalog(api, { sampleSize, random });
  }

  // Age gate — never let an under-18 seeded customer buy an alcoholic product.
  return isAdult ? rows : rows.filter((r) => !r.isAlcoholic);
}

module.exports = {
  SELLABLE_AVAILABILITY,
  toRow,
  collectViaAdminListing,
  collectViaPublicCatalog,
  collectBuyableLines,
  // kept for the public path / future re-enable
  listProductSummaries,
  getProductDetail,
  extractBuyableLines,
};
