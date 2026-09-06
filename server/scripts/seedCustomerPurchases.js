#!/usr/bin/env node
// scripts/seedCustomerPurchases.js
//
// Populate a SEED dataset with realistic customer activity: register customers
// from a name directory, place Cash-on-Delivery orders for products reconciled
// against a real sales report, walk each order to `delivered`, leave reviews,
// then spread the whole order book across a historical date window.
//
// ── SAFETY MODEL ───────────────────────────────────────────────────────────
//  1. Refuses to run unless the database name ends in `_seed`. Clone the
//     catalog with scripts/cloneToSeedDataset.js first.
//  2. Refuses to run when NODE_ENV=production.
//  3. Every order and review is stamped `seedSource: 'seed-script'`, so seeded
//     rows stay identifiable and can be deleted in one query. This is not
//     optional and cannot be disabled by a flag.
//  4. Customer emails are rewritten to a domain you control (--email-domain,
//     default drinksharbour.test) so a seeded run cannot send mail to the real
//     inboxes listed in the directory. Live SMTP is configured in .env and the
//     order pipeline sends confirmations, so this guard matters.
//
// ── PIPELINE ───────────────────────────────────────────────────────────────
//   customers .xlsx ─┐
//                    ├─> register (real API) ─> order (real API, COD)
//   matched products ┘        └─> admin advances to delivered
//                                  └─> customer posts review
//                                       └─> backdate order + review
//
// Everything that creates state goes through the HTTP API and the real
// controllers. The ONLY direct database writes are the date fields in
// lib/backdate.js, which are gated on the `_seed` database check.
//
// Usage:
//   node -r dotenv/config scripts/seedCustomerPurchases.js \
//     --customers 60 \
//     --customers-file ~/Downloads/Nigerian_Names_Directory_200.xlsx \
//     --date-range 2026-01-01..2026-09-04 \
//     --admin-email seed-admin@drinksharbour.test --admin-password 'SeedAdmin1!' \
//     --approve-reviews

'use strict';

const mongoose = require('mongoose');

const { ApiClient, ApiError, sleep } = require('./lib/api-client');
const { registerCustomer, loginCustomer, loginAdmin, bulkCreateCustomersAsAdmin, issueTokenFromDb } = require('./lib/auth');
const { generateAddress, generateCustomer, intBetween } = require('./lib/fake-data');
const { loadCustomersFromXlsx } = require('./lib/customers-file');
const {
  loadMatchedProducts, scaleQuantityToStock, buildWeightedPool, weightedPick,
  loadSizeOptions,
} = require('./lib/products-file');
const { validateCart, saveCart, clearCart } = require('./lib/cart');
const { placeOrder, advanceOrderToDelivered, markOrderPaid } = require('./lib/order');
const { checkEligibility, submitReview, approveReview } = require('./lib/review');
const {
  parseDateRange, randomOrderDate, reviewDateFor,
  assertSeedDatabase, applyOrderDate, applyReviewDate, SEED_MARKER,
} = require('./lib/backdate');
const flagsLib = require('./lib/flags');
const report = require('./lib/report');

const DEFAULTS = {
  customers: 40,
  ordersPerCustomer: [1, 4],
  itemsPerOrder: [1, 4],
  ratingRange: [4, 5],
  reviewRate: 0.55,          // share of delivered orders that get a review
  apiUrl: 'http://localhost:5001',
  dateRange: '2026-01-01..2026-09-04',
  // null → consumer mix (gmail/yahoo). Pass --email-domain to pin one.
  emailDomain: null,
  pacingMs: 120,
};

function parseOptions(argv) {
  const f = flagsLib.parseArgv(argv);
  return {
    customers:         flagsLib.parseInteger(flagsLib.get(f, 'customers'), DEFAULTS.customers),
    ordersPerCustomer: flagsLib.parseRange(flagsLib.get(f, 'orders-per-customer'), DEFAULTS.ordersPerCustomer),
    itemsPerOrder:     flagsLib.parseRange(flagsLib.get(f, 'items-per-order'), DEFAULTS.itemsPerOrder),
    ratingRange:       flagsLib.parseRange(flagsLib.get(f, 'rating-range'), DEFAULTS.ratingRange),
    reviewRate:        Number(flagsLib.get(f, 'review-rate') ?? DEFAULTS.reviewRate),
    dateRange:         parseDateRange(flagsLib.get(f, 'date-range') || DEFAULTS.dateRange),
    apiUrl:            String(flagsLib.get(f, 'api-url', 'API_URL') || DEFAULTS.apiUrl),
    emailDomain:       flagsLib.get(f, 'email-domain') || DEFAULTS.emailDomain,
    customersFile:     flagsLib.get(f, 'customers-file') || null,
    productsFile:      flagsLib.get(f, 'products-file') || null,
    adminEmail:        flagsLib.get(f, 'admin-email', 'ADMIN_EMAIL') || null,
    adminPassword:     flagsLib.get(f, 'admin-password', 'ADMIN_PASSWORD') || null,
    approveReviews:    flagsLib.bool(flagsLib.get(f, 'approve-reviews')),
    persistCart:       flagsLib.bool(flagsLib.get(f, 'persist-cart')),
    dryRun:            flagsLib.bool(flagsLib.get(f, 'dry-run')),
    // Rotate products across their multiple catalog sizes. Off by default so
    // existing runs are untouched; needs a size-options.json build.
    multiSize:         flagsLib.bool(flagsLib.get(f, 'multi-size')),
    multiSizesFile:    flagsLib.get(f, 'multi-sizes-file') || null,
    // Escape hatch for the outbound-mail gate. Only safe when every seeded
    // address is provably unroutable (e.g. a .test/.invalid domain).
    allowOutboundEmail: flagsLib.bool(flagsLib.get(f, 'allow-outbound-email')),
  };
}

// ────────────────────────────────────────────────────────────────────────────

async function runCustomer({
  api, conn, options, admin, customer, products, stockBudget, pendingBackdates, log,
}) {
  const entry = {
    email: customer.email, userId: null, ordersPlaced: 0, ordersDelivered: 0,
    ordersPaid: 0, itemsPurchased: 0, reviewsLeft: 0, reviewsApproved: 0,
    totalSpent: 0, errors: [],
  };

  // ── Session ───────────────────────────────────────────────────────────────
  // Accounts were bulk-created via POST /api/users (admin), bypassing the
  // register rate limiter. The token is minted in-process against the seed DB
  // (issueTokenFromDb) instead of calling the login endpoint, which is
  // rate-limited to 20/15min per IP — 200 customers would otherwise stall for
  // over an hour. The token is structurally identical to a real login token
  // (same jwt.sign, same payload, same JWT_SECRET) and protects() accepts it.
  let auth;
  try {
    auth = await issueTokenFromDb(conn, customer.email);
    entry.userId = auth.user?._id || null;
  } catch (err) {
    // Degraded fallback: the public login route. Rate-limited — fine for tiny runs.
    try {
      auth = await loginCustomer(api, customer.email, customer.password);
      entry.userId = auth.user?._id || null;
    } catch (loginErr) {
      entry.errors.push({ stage: 'login', message: loginErr.message, status: loginErr.status || null });
      log(`  ✗ ${customer.email}: ${loginErr.message}`);
      return entry;
    }
  }
  const customerApi = api.withToken(auth.token);

  const pool = buildWeightedPool(
    products.filter((p) => (stockBudget.get(p.sizeId) ?? 0) > 0),
    { multiProducts: options.multiProducts },
  );
  if (pool.length === 0) return entry;

  const orderCount = intBetween(options.ordersPerCustomer[0], options.ordersPerCustomer[1]);

  // ── helpers shared by every order of this customer ────────────────────────
  //
  // options.multiSizes = { "<productId>": { product, variants: [row, ...] } }
  // loaded from size-options.json. drawLine() honours it only when
  // --multi-size is on: it takes the weighted-pool pick, and if that product
  // owns sibling sizes the PDF never priced, it re-prices the line onto one of
  // them instead — budget permitting. It keeps the PDF-priced size ~40% of the
  // time so the documented size still sells. De-duplication still works because
  // every line is tracked by its central productId.
  const pickVariant = (row) => {
    if (!options.multiSizes) return row;
    const group = options.multiSizes[String(row.productId)];
    if (!group || !Array.isArray(group.variants) || group.variants.length < 2) return row;
    // 40% of draws keep the size the source report actually sold.
    if (Math.random() < 0.4) return row;
    const siblings = group.variants.filter((v) => v.sizeId !== row.sizeId);
    if (siblings.length === 0) return row;
    // Try up to a handful of siblings, preferring one the run has not consumed.
    const shuffled = [...siblings].sort(() => Math.random() - 0.5);
    for (const v of shuffled) {
      const budget = stockBudget.get(v.sizeId) ?? 0;
      if (budget > 0) {
        return {
          ...row,                       // carry product/type/subType/name/tenant…
          sizeId: v.sizeId, sizeName: v.sizeName,
          stock: v.stock, price: v.price,
          minOrderQuantity: v.min, maxOrderQuantity: v.max,
          soldQty: v.checkedSoldQty || row.soldQty,
          // productKey keeps both sizes under one product for de-dup below.
          productKey: `${row.productKey}~${v.sizeId}`,
        };
      }
    }
    return row;                        // all siblings consumed — keep the PDF pick
  };

  for (let i = 0; i < orderCount; i += 1) {
    // ── Choose lines, respecting the run-wide stock budget ──────────────────
    const wanted = intBetween(options.itemsPerOrder[0], options.itemsPerOrder[1]);
    const lines = [];
    const usedSizes = new Set();
    const usedProducts = new Set();

    for (let a = 0; a < wanted * 4 && lines.length < wanted; a += 1) {
      const picked = weightedPick(pool);
      if (!picked) continue;
      // One line per beverage — never two sizes (or two tenants) of the same
      // product in a single order.
      if (usedProducts.has(String(picked.productId))) continue;
      const row = options.multiSize ? pickVariant(picked) : picked;
      if (!row || usedSizes.has(row.sizeId)) continue;
      const budget = stockBudget.get(row.sizeId) ?? 0;
      if (budget <= 0) continue;
      const qty = scaleQuantityToStock(row, budget);
      if (qty <= 0) continue;
      usedSizes.add(row.sizeId);
      usedProducts.add(String(row.productId));
      lines.push({ ...row, quantity: qty });
    }
    if (lines.length === 0) break;

    // ── Validate against live pricing/stock ────────────────────────────────
    let okLines;
    try {
      const v = await validateCart(api, lines);
      okLines = v.okLines;
    } catch (err) {
      entry.errors.push({ stage: 'cart-validate', message: err.message });
      continue;
    }
    if (okLines.length === 0) continue;

    if (options.persistCart) {
      try { await saveCart(customerApi, okLines); } catch { /* non-fatal */ }
    }

    // ── Place the order ────────────────────────────────────────────────────
    const address = generateAddress();
    let placed;
    try {
      placed = await placeOrder(customerApi, { customer, address, lines: okLines });
    } catch (err) {
      entry.errors.push({ stage: 'order', message: err.message, status: err.status || null });
      continue;
    }

    // Commit the stock we just consumed so later orders cannot oversell.
    for (const l of okLines) {
      stockBudget.set(l.sizeId, Math.max(0, (stockBudget.get(l.sizeId) ?? 0) - l.quantity));
    }

    entry.ordersPlaced += 1;
    entry.itemsPurchased += okLines.reduce((s, l) => s + l.quantity, 0);
    entry.totalSpent += Number(placed.totalAmount || 0);

    // ── Deliver + settle (admin) ───────────────────────────────────────────
    let delivered = false;
    if (admin) {
      try {
        await advanceOrderToDelivered(admin.api, placed._id, placed.status || 'pending');
        entry.ordersDelivered += 1;
        delivered = true;
        if (await markOrderPaid(admin.api, placed._id)) entry.ordersPaid += 1;
      } catch (err) {
        entry.errors.push({ stage: 'advance', message: err.message, orderNumber: placed.orderNumber });
      }
    }

    // ── Defer backdating ───────────────────────────────────────────────────
    //
    // Do NOT move dates yet. utils/orderUtils.js generateOrderNumber() builds
    // `DH<yymmdd><sequence>` where the sequence is
    //   countDocuments({ createdAt: within today })  + 1
    // Backdating an order removes it from "today", so the next order counts 0
    // again, regenerates the SAME number, and dies on the unique index with
    // E11000 dup key orderNumber. Every order after the first would fail.
    //
    // Collecting the intended dates and applying them once all orders exist
    // keeps the live counter monotonic while still producing a spread book.
    const placedAt = randomOrderDate(options.dateRange);
    const deliveryDays = intBetween(1, 4);
    pendingBackdates.push({ orderId: placed._id, placedAt, deliveryDays });

    log(`  · ${placed.orderNumber}  ${placedAt.toISOString().slice(0, 10)}  ` +
        `${okLines.length} line(s)  ₦${Number(placed.totalAmount || 0).toLocaleString()}` +
        `${delivered ? '  delivered' : ''}`);

    // ── Review a share of delivered orders ─────────────────────────────────
    if (delivered && Math.random() < options.reviewRate) {
      const target = okLines[Math.floor(Math.random() * okLines.length)];
      try {
        const elig = await checkEligibility(customerApi, target.productId);
        if (elig.canReview) {
          const purchasedSize = elig.purchasedSizes?.[0] || {
            orderId: placed._id, subproductId: target.subProductId,
            sizeId: target.sizeId, sizeName: target.sizeName,
          };
          const { reviewId } = await submitReview(customerApi, {
            productId: target.productId,
            productType: target.productType,
            productSubType: target.productSubType,
            ratingRange: options.ratingRange,
            purchasedSize,
          });
          entry.reviewsLeft += 1;

          // Deferred with the orders — see the note above. A review's date is
          // derived from its order's date, so both are applied in the same pass.
          pendingBackdates.push({
            reviewId,
            reviewAt: reviewDateFor(placedAt, options.dateRange),
          });

          if (options.approveReviews && admin) {
            try {
              await approveReview(admin.api, reviewId);
              entry.reviewsApproved += 1;
            } catch (e) {
              entry.errors.push({ stage: 'review-approve', message: e.message });
            }
          }
        }
      } catch (err) {
        entry.errors.push({ stage: 'review', message: err.message, status: err.status || null });
      }
    }

    if (options.persistCart) await clearCart(customerApi);
    await sleep(DEFAULTS.pacingMs);
  }

  return entry;
}

// ────────────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('✋ Refusing to run with NODE_ENV=production.');
    process.exit(1);
  }

  const options = parseOptions(process.argv.slice(2));
  const log = (...a) => console.log(...a);

  // Hard gate: seed database only. assertSeedDatabase throws otherwise.
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const conn = await mongoose.createConnection(uri).asPromise();
  const dbName = assertSeedDatabase(conn);

  // ── Outbound-mail gate ────────────────────────────────────────────────────
  //
  // Seeded customers carry consumer addresses (@gmail.com / @yahoo.com) that
  // can collide with real mailboxes. order.controller.js fires
  // sendOrderConfirmationToCustomer() for EVERY order placed, and
  // services/email.service.js does not consult NODE_ENV on its send path — it
  // only falls back to logging when the transport fails to build. With working
  // MAIL_* credentials, seeding would deliver hundreds of confirmations for
  // fictitious orders to strangers, from the production domain.
  //
  // So: refuse to run unless outbound mail is explicitly disabled. Override
  // with --allow-outbound-email only when you know the addresses are unroutable.
  const outboundBlocked = (
    String(process.env.OUTBOUND_EMAIL || '').toLowerCase() === 'off' ||
    ['true', '1', 'yes'].includes(String(process.env.DISABLE_OUTBOUND_EMAIL || '').toLowerCase())
  );
  if (!outboundBlocked && !options.allowOutboundEmail) {
    console.error('✋ Outbound email is ENABLED. Seeding would send real order');
    console.error('   confirmations to every seeded address.');
    console.error('   Set OUTBOUND_EMAIL=off in server/.env, or pass --allow-outbound-email.');
    await conn.close();
    process.exit(1);
  }

  // Load inputs ───────────────────────────────────────────────────────────────
  const { rows: products } = loadMatchedProducts(options.productsFile || undefined);

  // Optional size-variant universe. When --multi-size is set, the picker can
  // re-price a matched line onto a sibling size (see lib/products-file).
  if (options.multiSize) {
    const so = loadSizeOptions(options.multiSizesFile || undefined);
    options.multiSizes = so.products || {};
    // Products that own more than one sellable size get a pick-frequency boost
    // so the size dimension actually shows up in the order book, instead of
    // these 1-in-1000 picks never appearing at all.
    options.multiProducts = new Set(
      Object.entries(options.multiSizes)
        .filter(([, g]) => Array.isArray(g.variants) && g.variants.length > 1)
        .map(([k]) => k),
    );
    log(`  size variants: ${options.multiProducts.size} product(s) with multi-size variants ` +
        `(from ${options.multiSizesFile || 'size-options.json'})`);
  }
  log(`  multi-size   : ${options.multiSize ? 'yes' : 'no'}`);

  let customers;
  if (options.customersFile) {
    const loaded = loadCustomersFromXlsx(options.customersFile, {
      limit: options.customers,
      emailDomain: options.emailDomain,   // null → gmail/yahoo mix
    });
    customers = loaded.customers;
    if (loaded.rejected.length) log(`  ! ${loaded.rejected.length} directory row(s) rejected`);
  } else {
    const usedNames = new Set();
    const usedEmails = new Set();
    customers = Array.from({ length: options.customers }, () =>
      generateCustomer({ emailDomain: options.emailDomain, usedNames, usedEmails }));
  }

  log('▶ DrinksHarbour purchase seeder');
  log(`  database   : ${dbName}`);
  log(`  api        : ${options.apiUrl}`);
  log(`  customers  : ${customers.length}`);
  log(`  products   : ${products.length} matched listings`);
  log(`  date range : ${options.dateRange[0].toISOString().slice(0, 10)} → ${options.dateRange[1].toISOString().slice(0, 10)}`);
  log(`  email dom. : ${options.emailDomain ? '@' + options.emailDomain : 'gmail.com / yahoo.com mix'}`);
  log(`  outbound   : ${outboundBlocked ? 'BLOCKED (OUTBOUND_EMAIL=off)' : '⚠️  ENABLED — real mail may be sent'}`);
  log(`  marker     : seedSource="${SEED_MARKER}"`);
  log(`  dry run    : ${options.dryRun ? 'yes' : 'no'}`);
  log('');

  if (options.dryRun) {
    const totalStock = products.reduce((s, p) => s + p.stock, 0);
    log(`  would register ${customers.length} customers`);
    log(`  would draw from ${products.length} listings, ${totalStock.toLocaleString()} units of stock`);
    log(`  first 3: ${customers.slice(0, 3).map((c) => c.email).join(', ')}`);
    await conn.close();
    return;
  }

  const api = new ApiClient({ baseUrl: options.apiUrl, onRetry: (m) => log(`  ↻ ${m}`) });
  const r = report.newReport({ apiUrl: options.apiUrl, options: { ...options, dateRange: undefined } });

  // ── Admin session ─────────────────────────────────────────────────────────
  let admin = null;
  if (options.adminEmail && options.adminPassword) {
    try {
      const { token, user } = await loginAdmin(api, options.adminEmail, options.adminPassword);
      admin = { api: api.withToken(token), user };
      log(`✓ admin: ${user.email} (${user.role})\n`);
    } catch (err) {
      log(`✗ admin login failed: ${err.message}`);
      log('  Orders will stay pending and no reviews can be left.\n');
      report.recordError(r, err);
    }
  } else {
    log('! no --admin-email/--admin-password: orders stay pending, no reviews.\n');
  }

  // ── Bulk-create customer accounts (bypasses the /register rate limit) ─────
  if (admin) {
    try {
      const created = await bulkCreateCustomersAsAdmin(admin.api, customers);
      const ok = created.filter((c) => c.ok).length;
      const failed = created.filter((c) => !c.ok);
      log(`✓ customers provisioned: ${ok}/${customers.length}` +
          `${failed.length ? `  (${failed.length} failed: ${failed[0]?.error})` : ''}`);
      if (failed.length) {
        for (const f of failed) report.recordError(r, { stage: 'provision', email: f.email, message: f.error });
      }
      log('');
    } catch (err) {
      log(`✗ bulk customer provisioning failed: ${err.message}`);
      report.recordError(r, err);
    }
  } else {
    // No admin — fall back to the rate-limited public register for small runs.
    if (customers.length > 4) log('! no admin session: falling back to /register (rate-limited to ~5/hour)\n');
  }

  // Run-wide stock ledger so the whole seed cannot oversell any single size.
  const stockBudget = new Map(products.map((p) => [p.sizeId, p.stock]));
  if (options.multiSizes) {
    // Variant sizes are not match-file rows (the PDF priced only one size per
    // SKU), so fold their real stock into the ledger or the picker would always
    // see 0 budget and never select a sibling.
    for (const group of Object.values(options.multiSizes)) {
      for (const v of group.variants || []) {
        if (v && v.sizeId && !stockBudget.has(v.sizeId)) {
          stockBudget.set(v.sizeId, Number(v.stock) || 0);
        }
      }
    }
  }

  // Date changes are collected here and applied only after every order has been
  // created, so the server's daily order-number sequence stays intact.
  const pendingBackdates = [];

  for (let i = 0; i < customers.length; i += 1) {
    const c = customers[i];
    log(`[${i + 1}/${customers.length}] ${c.fullName || `${c.firstName} ${c.lastName}`} <${c.email}>`);
    try {
      const entry = await runCustomer({
        api, conn, options, admin, customer: c, products, stockBudget, pendingBackdates, log,
      });
      report.recordCustomer(r, entry);
    } catch (err) {
      report.recordError(r, err);
      log(`  ✗ ${err.message}`);
    }
  }

  // ── Apply all deferred dates ──────────────────────────────────────────────
  const orderDates  = pendingBackdates.filter((p) => p.orderId);
  const reviewDates = pendingBackdates.filter((p) => p.reviewId);
  if (orderDates.length || reviewDates.length) {
    log(`\n⏱  backdating ${orderDates.length} order(s) and ${reviewDates.length} review(s)…`);
    let ok = 0, failed = 0;
    for (const p of orderDates) {
      try {
        await applyOrderDate(conn, p.orderId, p.placedAt, { deliveryDays: p.deliveryDays });
        ok += 1;
      } catch (err) { failed += 1; report.recordError(r, err); }
    }
    for (const p of reviewDates) {
      try {
        await applyReviewDate(conn, p.reviewId, p.reviewAt);
        ok += 1;
      } catch (err) { failed += 1; report.recordError(r, err); }
    }
    log(`   ✓ ${ok} updated${failed ? `, ✗ ${failed} failed` : ''}`);
  }

  report.finalize(r);
  const file = report.writeReport(r);
  report.printConsoleSummary(r, log);
  if (file) log(`\n📄 report: ${file}`);
  log(`\nTo remove everything this run created:`);
  log(`   db.orders.deleteMany({ seedSource: "${SEED_MARKER}" })`);
  log(`   db.reviews.deleteMany({ seedSource: "${SEED_MARKER}" })`);

  await conn.close();
}

main().catch((err) => {
  console.error('\n💥', err.message);
  if (err instanceof ApiError && err.body) {
    console.error('  body:', JSON.stringify(err.body, null, 2));
  }
  process.exit(1);
});
