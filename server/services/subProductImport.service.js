const RealSize = require('../models/Size');
const RealProduct = require('../models/Product');
const RealSubProduct = require('../models/SubProduct');
const RealCategory = require('../models/Category');

const SIZE_ENUM = new Set(RealSize.schema.path('size').enumValues);
const PRODUCT_TYPES = new Set(RealProduct.schema.path('type').enumValues);

// Keyword-based type fallback for when AI enrichment is unavailable or returns
// nothing useful. Checked against the product name before giving up.
const TYPE_KEYWORDS = [
  ['bourbon',   /\bbourbons?\b/i],
  ['scotch',    /\bscotch\b/i],
  ['whiskey',   /\bwhiskeys?\b|\bwhisky\b|\birish\s+whiskey\b|\brye\b/i],
  ['gin',       /\bgins?\b/i],
  ['vodka',     /\bvodkas?\b/i],
  ['rum',       /\brums?\b/i],
  ['tequila',   /\btequilas?\b|\bmezcal\b/i],
  ['champagne', /\bchampagne\b/i],
  ['prosecco',  /\bprosecco\b/i],
  ['wine',      /\bwines?\b/i],
  ['beer',      /\bbeers?\b|\blager\b|\bales?\b|\bstout\b|\bipa\b|\bpilsner\b/i],
  ['cognac',    /\bcognac\b|\barmagnac\b/i],
  ['brandy',    /\bbrandy\b|\bbrandies\b/i],
  ['liqueur',   /\bliqu[ei]urs?\b/i],
  ['cider',     /\bciders?\b/i],
  ['sake',      /\bsake\b/i],
];

function guessTypeFromName(name) {
  const n = String(name || '');
  for (const [type, re] of TYPE_KEYWORDS) {
    if (re.test(n) && PRODUCT_TYPES.has(type)) return type;
  }
  return 'spirit'; // safe default for a drinks-only marketplace
}

function toNum(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}
function numField(row, raw) {
  const has = raw !== undefined && raw !== null && String(raw).trim() !== '';
  const n = toNum(raw);
  return { value: n, bad: has && n === null };
}

function normalizeRows(rawRows) {
  return (rawRows || []).map((r, i) => {
    const cp = numField(r, r.costPrice);
    const sp = numField(r, r.sellingPrice);
    const szp = numField(r, r.sizePrice);
    const szc = numField(r, r.sizeCostPrice);
    const oq = numField(r, r.openingQty);
    return {
      productName: str(r.productName),
      productType: str(r.productType).toLowerCase(),
      brand: str(r.brand),
      category: str(r.category),
      subCategory: str(r.subCategory),
      subProductSku: str(r.subProductSku).toUpperCase(),
      costPrice: cp.value, _bad_costPrice: cp.bad,
      sellingPrice: sp.value,
      size: str(r.size),
      sizeSku: str(r.sizeSku).toUpperCase(),
      barcode: str(r.barcode).toUpperCase(),
      sizePrice: szp.value, _bad_sizePrice: szp.bad,
      sizeCostPrice: szc.value, _bad_sizeCostPrice: szc.bad,
      openingQty: oq.value, _bad_openingQty: oq.bad,
      _rowNum: i + 1,
    };
  });
}

function isValidSize(size) {
  return SIZE_ENUM.has(size);
}

function groupRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.subProductSku || `${r.productName}|${r.brand}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { key, productName: r.productName, brand: r.brand, rows: [] });
    }
    map.get(key).rows.push(r);
  }
  return Array.from(map.values());
}

function defaultDeps(deps = {}) {
  return {
    Product: deps.Product || RealProduct,
    SubProduct: deps.SubProduct || RealSubProduct,
    Size: deps.Size || RealSize,
    Category: deps.Category || RealCategory,
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Canonical key for de-duplicating product names. Drops apostrophes entirely
 * (so "Daniel's" == "Daniels"), turns every other punctuation run into a single
 * space, lowercases, and collapses whitespace. This is what makes
 * "Jack Daniel's Old No. 7", "Jack Daniels Old No 7" and "Jack Daniels Old No. 7"
 * resolve to the SAME existing product instead of spawning duplicates.
 */
function normalizeProductName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['’‘`´]/g, '')     // apostrophes vanish: daniel's -> daniels
    .replace(/[^a-z0-9]+/g, ' ') // any other punctuation -> single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build an in-memory Map<normalizedName, {_id, name}> from product docs.
 * First doc wins on a key collision so an established product isn't shadowed.
 */
function buildProductIndex(docs) {
  const map = new Map();
  for (const d of docs || []) {
    const key = normalizeProductName(d.name);
    if (key && !map.has(key)) map.set(key, { _id: d._id, name: d.name });
  }
  return map;
}

/**
 * Load the normalized product index once per import. Returns null when the
 * Product model can't be queried (e.g. lightweight test stubs with only
 * `findOne`), in which case findProductByName falls back to an exact DB match.
 */
async function loadProductIndex(Product) {
  if (!Product || typeof Product.find !== 'function') return null;
  try {
    const q = Product.find({}).select('_id name');
    const docs = await (q && typeof q.lean === 'function' ? q.lean() : q);
    return buildProductIndex(docs);
  } catch {
    return null;
  }
}

/**
 * Resolve a product by name. Prefers a prebuilt normalized `index` (dedup-tolerant
 * of apostrophes/punctuation); falls back to an exact case-insensitive DB match
 * when no index is supplied.
 */
async function findProductByName(name, Product, index) {
  if (!name) return null;
  if (index instanceof Map) {
    return index.get(normalizeProductName(name)) || null;
  }
  const q = Product.findOne({ name: { $regex: new RegExp(`^${escapeRe(name)}$`, 'i') } });
  return (q && typeof q.select === 'function') ? q.select('_id').lean() : q;
}

/**
 * Merge spreadsheet values with AI-derived ones for a brand-new product.
 * Spreadsheet always wins; AI fills the gaps. The display-name fallback strips
 * size/volume tokens from the raw row name (size is a separate variant).
 */
function resolveNewProductFields(base, ai = {}) {
  const { stripSizeFromName } = require('./productEnrich.service');
  return {
    name: str(ai.name) || stripSizeFromName(base.productName) || base.productName,
    type: base.productType || str(ai.type) || undefined,
    brand: base.brand || str(ai.brand) || undefined,
    category: base.category || str(ai.category) || undefined,
    subCategory: base.subCategory || str(ai.subCategory) || undefined,
    shortDescription: str(ai.shortDescription) || undefined,
    description: str(ai.description) || undefined,
  };
}

async function validateImport(rawRows, opts, tenantId, deps) {
  const { Product, SubProduct, Size, Category, enrich, getCategoryOptions, getProductNames } = defaultServiceDeps(deps);
  const warehouseId = opts?.warehouseId || null;
  const mode = opts?.mode === 'update' ? 'update' : 'create';
  const rows = normalizeRows(rawRows);
  const groups = groupRows(rows);
  const blocking = [];
  const totals = {
    groups: groups.length, sizes: 0,
    willCreateProduct: 0, willLinkProduct: 0, willUpdateSubProduct: 0,
    willSkipNoMatch: 0, errorRows: 0,
  };
  let anyQty = false;

  // Normalized product index, built once, so near-identical names
  // ("Jack Daniel's Old No. 7" vs "Jack Daniels Old No 7") link to the same
  // existing product instead of creating a duplicate.
  const productIndex = await loadProductIndex(Product);

  const groupReports = [];
  const toEnrich = []; // createProduct groups, enriched in parallel after the scan
  for (const g of groups) {
    const existingProduct = await findProductByName(g.productName, Product, productIndex);
    let existingSub = null;
    if (existingProduct) {
      const firstSku = g.rows.find((r) => r.subProductSku)?.subProductSku;
      const subQ = SubProduct.findOne({
        tenant: tenantId,
        ...(firstSku ? { sku: firstSku } : { product: existingProduct._id }),
      });
      existingSub = await ((subQ && typeof subQ.select === 'function') ? subQ.select('_id').lean() : subQ);
    }
    // UPDATE mode only ever updates an existing sub-product; anything else is a
    // no-match that will be skipped (never created).
    const action = mode === 'update'
      ? (existingSub ? 'updateSubProduct' : 'noMatch')
      : (existingSub ? 'updateSubProduct' : existingProduct ? 'linkProduct' : 'createProduct');

    let existingSizes = new Set();
    if (existingSub) {
      const sizeQ = Size.find({ subproduct: existingSub._id });
      const sizeDocs = await ((sizeQ && typeof sizeQ.select === 'function') ? sizeQ.select('size').lean() : sizeQ);
      existingSizes = new Set(sizeDocs.map((s) => s.size));
    }

    const seen = new Set();
    const rowErrors = [];
    const sizeNotes = [];
    for (const r of g.rows) {
      if (r.openingQty && r.openingQty > 0) anyQty = true;
      if (!r.productName) rowErrors.push({ rowNum: r._rowNum, field: 'productName', message: 'productName is required' });
      if (!r.size) {
        rowErrors.push({ rowNum: r._rowNum, field: 'size', message: 'size is required' });
      } else if (!isValidSize(r.size)) {
        rowErrors.push({ rowNum: r._rowNum, field: 'size', message: `"${r.size}" is not a valid size` });
      }
      // New products are AI-enriched from their name at commit, so productType is
      // NOT required here. Only flag a productType that was supplied but invalid.
      if (action === 'createProduct' && r.productType && !PRODUCT_TYPES.has(r.productType)) {
        rowErrors.push({ rowNum: r._rowNum, field: 'productType', message: `"${r.productType}" is not a valid product type` });
      }
      if (action === 'linkProduct' && (r.costPrice == null || r.costPrice <= 0)) {
        rowErrors.push({ rowNum: r._rowNum, field: 'costPrice', message: 'costPrice required when linking an existing product' });
      }
      for (const f of ['costPrice', 'sizePrice', 'sizeCostPrice', 'openingQty']) {
        if (r[`_bad_${f}`]) rowErrors.push({ rowNum: r._rowNum, field: f, message: `${f} must be a number` });
      }
      if (r.size && isValidSize(r.size)) {
        if (seen.has(r.size)) sizeNotes.push({ rowNum: r._rowNum, size: r.size, note: 'duplicate-in-file' });
        else if (existingSizes.has(r.size)) sizeNotes.push({ rowNum: r._rowNum, size: r.size, note: 'exists' });
        seen.add(r.size);
      }
    }

    const sizeCount = seen.size;
    totals.sizes += sizeCount;
    totals.errorRows += new Set(rowErrors.map((e) => e.rowNum)).size;
    if (action === 'createProduct') totals.willCreateProduct += 1;
    else if (action === 'linkProduct') totals.willLinkProduct += 1;
    else if (action === 'noMatch') totals.willSkipNoMatch += 1;
    else totals.willUpdateSubProduct += 1;

    const report = { key: g.key, productName: g.productName, action, sizeCount, rowErrors, sizeNotes };
    if (action === 'createProduct' && g.rows[0]?.productName) toEnrich.push({ report, base: g.rows[0] });
    groupReports.push(report);
  }

  // Enrich brand-new products at preview-time so the admin reviews (and the
  // commit reuses) the resolved name/type/brand/category before confirming.
  if (toEnrich.length) {
    let catalog = { categories: [], subcategories: {} };
    try { catalog = await getCategoryOptions({ Category }); } catch { /* keep empty */ }
    // Feed existing product names so the model reuses their exact stored spelling
    // (the canonical-name lever that drives the exact/normalized dedup match).
    let productNames = [];
    try { productNames = (await getProductNames({ Product })) || []; } catch { productNames = []; }
    const enrichOpts = { ...catalog, productNames };
    await Promise.all(toEnrich.map(async ({ report, base }) => {
      let ai = {};
      try { ai = (await enrich(base.productName, enrichOpts)) || {}; } catch { ai = {}; }
      report.enrichment = resolveNewProductFields(base, ai);
    }));
  }

  if (anyQty && !warehouseId) {
    blocking.push('Select a target warehouse — some rows have an opening quantity.');
  }
  const ok = blocking.length === 0 && totals.errorRows === 0;
  return { ok, groups: groupReports, totals, blocking };
}

function defaultServiceDeps(deps = {}) {
  const base = defaultDeps(deps);
  const sp = require('./subproduct.service');
  const wh = require('./warehouse.service');
  const invSvc = require('./inventory.service');
  const enrichSvc = require('./productEnrich.service');
  return {
    ...base,
    createSubProduct: deps.createSubProduct || sp.createSubProduct,
    addSize: deps.addSize || sp.addSize,
    adjustStock: deps.adjustStock || wh.adjustStock,
    recordReceiptMovement: deps.recordReceiptMovement || invSvc.recordReceiptMovement,
    enrich: deps.enrich || enrichSvc.enrichProductFromName,
    getCategoryOptions: deps.getCategoryOptions || enrichSvc.getCategoryOptions,
    getProductNames: deps.getProductNames || enrichSvc.getProductNames,
  };
}

// Round a price up to the nearest ₦100 (matches the admin pricing UI).
function roundUp100(n) {
  return Math.ceil(Number(n) / 100) * 100;
}

// Selling price for an imported size row. An explicit sizePrice always wins.
// Otherwise derive it from the row's cost and a markup % (the sub-product's
// stored markup, falling back to 25%) so an imported cost never lands with a
// blank selling price.
function deriveSizeSelling(r, fallbackMarkupPct) {
  if (r.sizePrice != null && r.sizePrice > 0) return r.sizePrice;
  const cost = r.sizeCostPrice ?? r.costPrice;
  if (cost == null || cost <= 0) return undefined;
  const markup =
    fallbackMarkupPct != null && fallbackMarkupPct > 0 ? fallbackMarkupPct : 25;
  return roundUp100(cost * (1 + markup / 100));
}

function sizePayload(r, fallbackMarkupPct) {
  return {
    size: r.size,
    sku: r.sizeSku || undefined,
    barcode: r.barcode || undefined,
    basePrice: deriveSizeSelling(r, fallbackMarkupPct),
    costPrice: r.sizeCostPrice ?? undefined,
    stock: 0,
  };
}

// Set a size's on-hand stock to an ABSOLUTE quantity (a stock-take correction),
// used by Update-mode imports. Mirrors the reliability pattern of the create path:
// the warehouse ledger is best-effort, but Size.stock (the shop's inStock source
// of truth) is always set directly.
async function applyAbsoluteStock(d, { subProductId, sizeId, qty, before, warehouseId, tenantId, user, unitCost }) {
  if (warehouseId) {
    try {
      await d.adjustStock(
        { warehouseId, subProduct: subProductId, size: sizeId, quantity: qty, type: 'adjusted', notes: 'Bulk import stock update' },
        user?._id, tenantId
      );
    } catch (_) { /* Size.stock is set below regardless */ }
  }
  await Promise.resolve(
    d.Size.findByIdAndUpdate(sizeId, {
      $set: { stock: qty, availableStock: qty, availability: qty > 0 ? 'in_stock' : 'out_of_stock' },
    })
  ).catch(() => {});
  try {
    await d.recordReceiptMovement({
      subProduct: subProductId, tenant: tenantId, size: sizeId,
      warehouse: warehouseId || undefined, quantity: qty - before,
      balanceBefore: before, balanceAfter: qty,
      unitCost, notes: 'Bulk import stock update (absolute)', reference: 'bulk-import-update',
      performedBy: user?._id,
    });
  } catch (_) { /* audit trail is non-fatal — Size.stock already set */ }
}

async function commitImport(rawRows, opts, tenantId, user, deps) {
  const d = defaultServiceDeps(deps);
  const warehouseId = opts?.warehouseId || null;
  // 'update' = touch existing products only (cost/selling/stock); 'create' (default)
  // = the original additive behavior (create new, skip existing sizes).
  const mode = opts?.mode === 'update' ? 'update' : 'create';
  // Preview-confirmed enrichments, keyed by group key (see validateImport).
  const enrichments = (opts?.enrichments && typeof opts.enrichments === 'object') ? opts.enrichments : {};
  const rows = normalizeRows(rawRows);
  const groups = groupRows(rows);
  const out = { createdProducts: 0, createdSubProducts: 0, createdSizes: 0, updatedSizes: 0, stockApplied: 0, stockUpdated: 0, skipped: 0, skippedNoMatch: 0, errors: [] };

  // Existing category hierarchy, fetched once, so Haiku enrichment picks real
  // categories that createSubProductCore can resolve by name. Best-effort.
  let catalog = { categories: [], subcategories: {} };
  try {
    catalog = await d.getCategoryOptions({ Category: d.Category });
  } catch { /* keep empty */ }
  // Existing product names for exact-spelling reuse when a group needs live
  // enrichment (preview enrichment absent/incomplete). Best-effort.
  let productNames = [];
  try { productNames = (await d.getProductNames({ Product: d.Product })) || []; } catch { productNames = []; }
  const enrichOpts = { ...catalog, productNames };

  // Normalized product index, built once, so dedup at commit matches the same
  // near-identical names the preview linked (apostrophe/punctuation tolerant).
  const productIndex = await loadProductIndex(d.Product);

  // Best-effort bulk import: each group is isolated by try/catch. A group is
  // processed independently; if opening-stock adjustStock throws mid-group the
  // catalog records already created still count in the totals AND the group is
  // recorded in errors[]. Also: a group that resolves to a newly-created,
  // still-`pending` Product (e.g. a re-run before admin approval, or two
  // same-named new-product groups in one file) may fail to link at commit even
  // when preview said ok — caught here per-group. Surfacing pending status in
  // preview is a deferred follow-up.
  for (const g of groups) {
    try {
      // Keep only rows with a usable size; de-dupe within the group (first wins).
      const seen = new Set();
      const goodRows = g.rows.filter((r) => {
        if (!r.productName || !isValidSize(r.size) || seen.has(r.size)) return false;
        seen.add(r.size);
        return true;
      });
      if (goodRows.length === 0) { out.skipped += g.rows.length; continue; }

      const existingProduct = await findProductByName(g.productName, d.Product, productIndex);
      const firstSku = goodRows.find((r) => r.subProductSku)?.subProductSku;
      const existingSub = existingProduct
        ? await d.SubProduct.findOne({
            tenant: tenantId,
            ...(firstSku ? { sku: firstSku } : { product: existingProduct._id }),
          }).select('_id').lean()
        : null;

      let subProductId;
      let createdSizeDocs = []; // { _id, size, _row }

      // UPDATE mode never creates: an unmatched product is skipped & reported.
      if (mode === 'update' && !existingSub) {
        out.skippedNoMatch += goodRows.length;
        continue;
      }

      if (existingSub) {
        subProductId = existingSub._id;
        // Sub-product markup — the fallback when a size has no prior selling price
        // to learn a markup from.
        const subDoc = await d.SubProduct.findById(existingSub._id)
          .select('markupPercentage').lean();
        const subMarkup = subDoc?.markupPercentage ?? 25;

        // Full docs (not just size names) so we can update cost/selling in place.
        const existingSizes = await d.Size.find({ subproduct: existingSub._id })
          .select('_id size costPrice basePrice markupPercentage stock').lean();
        const existingBySize = new Map(existingSizes.map((s) => [s.size, s]));

        for (const r of goodRows) {
          const ex = existingBySize.get(r.size);

          if (mode === 'update') {
            // UPDATE mode: only touch sizes that already exist.
            if (!ex) { out.skippedNoMatch += 1; continue; }

            const newCost = r.sizeCostPrice ?? r.costPrice;
            const oldCost = Number(ex.costPrice) || 0;
            const oldSelling = Number(ex.basePrice) || 0;
            const set = {};

            if (newCost != null && newCost > 0) {
              set.costPrice = newCost;
              // Explicit selling price wins; otherwise preserve last markup.
              const selling =
                r.sizePrice != null && r.sizePrice > 0
                  ? r.sizePrice
                  : oldCost > 0 && oldSelling > 0
                    ? roundUp100(newCost * (oldSelling / oldCost))
                    : roundUp100(newCost * (1 + (ex.markupPercentage ?? subMarkup) / 100));
              set.basePrice = selling;
              set.markupPercentage = Number(((selling / newCost - 1) * 100).toFixed(2));
            } else if (r.sizePrice != null && r.sizePrice > 0) {
              // Selling-only update (no new cost supplied).
              set.basePrice = r.sizePrice;
              if (oldCost > 0) {
                set.markupPercentage = Number(((r.sizePrice / oldCost - 1) * 100).toFixed(2));
              }
            }

            if (Object.keys(set).length > 0) {
              await d.Size.findByIdAndUpdate(ex._id, { $set: set });
              out.updatedSizes += 1;
            }

            // Absolute stock set (stock-take) when the row supplies an opening qty.
            if (r.openingQty != null && r.openingQty >= 0) {
              await applyAbsoluteStock(d, {
                subProductId, sizeId: ex._id, qty: r.openingQty,
                before: Number(ex.stock) || 0, warehouseId, tenantId, user,
                unitCost: (r.sizeCostPrice ?? r.costPrice ?? ex.costPrice) ?? undefined,
              });
              out.stockUpdated += 1;
            }
            continue;
          }

          // CREATE mode (default): additive — skip existing sizes, add new ones.
          if (ex) { out.skipped += 1; continue; }
          const sizeDoc = await d.addSize(subProductId, sizePayload(r, subMarkup), tenantId, user); // returns the Size doc
          createdSizeDocs.push({ _id: sizeDoc._id, size: r.size, _row: r });
        }
      } else {
        const base = goodRows[0];
        const baseCost = base.costPrice ?? base.sizeCostPrice ?? null;
        const data = {
          costPrice: base.costPrice ?? undefined,
          baseSellingPrice:
            base.sellingPrice ??
            (baseCost != null && baseCost > 0
              ? roundUp100(baseCost * 1.25)
              : undefined),
          markupPercentage: 25,
          status: 'active',
          sizes: goodRows.map((r) => sizePayload(r, 25)),
        };
        if (existingProduct) {
          data.product = existingProduct._id;
        } else {
          // Brand-new product. Preview already enriched and the admin approved
          // those values — use them verbatim when supplied (keyed by group key).
          // IMPORTANT: undefined values are stripped by JSON.stringify, so a
          // preview enrichment that only has 'name' (type/brand/category were
          // undefined) arrives here as { name: '...' } — that object check is
          // insufficient. Re-run live Haiku whenever 'type' is absent.
          let ai = enrichments[g.key];
          if (!ai || typeof ai !== 'object' || !ai.type) {
            try {
              ai = (await d.enrich(base.productName, enrichOpts)) || {};
            } catch { ai = {}; }
          }
          data.createNewProduct = true;
          data.newProductData = resolveNewProductFields(base, ai);
          // Last-resort: if Haiku is unavailable, infer type from keywords so
          // createSubProductCore doesn't throw and the import doesn't silently skip.
          if (!data.newProductData.type) {
            data.newProductData.type = guessTypeFromName(base.productName);
          }
        }
        const sub = await d.createSubProduct(data, tenantId, user);
        subProductId = sub._id;
        if (!existingProduct) out.createdProducts += 1;
        out.createdSubProducts += 1;
        // Map returned size docs back to their source rows by size value.
        const bySize = new Map((sub.sizes || []).map((s) => [s.size, s._id]));
        createdSizeDocs = goodRows
          .map((r) => ({ _id: bySize.get(r.size), size: r.size, _row: r }))
          .filter((s) => s._id);
      }

      out.createdSizes += createdSizeDocs.length;

      // Apply opening stock for created sizes with qty > 0.
      for (const s of createdSizeDocs) {
        const qty = s._row.openingQty;
        if (!(qty > 0)) continue;

        // WarehouseStock ledger — only when a warehouse was selected.
        if (warehouseId) {
          await d.adjustStock(
            { warehouseId, subProduct: subProductId, size: s._id, quantity: qty, type: 'received', notes: 'Bulk import opening stock' },
            user?._id, tenantId
          );
        }

        // Size.stock — set directly so the shop's inStock filter always sees the
        // correct value even if the InventoryMovement audit trail fails to save.
        const Size = require('mongoose').model('Size');
        await Size.findByIdAndUpdate(s._id, {
          $set: { stock: qty, availableStock: qty, availability: 'in_stock' },
        }).catch(() => {});

        // InventoryMovement audit trail — best-effort; failure is non-fatal.
        try {
          await d.recordReceiptMovement({
            subProduct: subProductId,
            tenant: tenantId,
            size: s._id,
            warehouse: warehouseId || undefined,
            quantity: qty,
            balanceBefore: 0,
            balanceAfter: qty,
            unitCost: s._row.sizeCostPrice ?? s._row.costPrice ?? undefined,
            notes: 'Bulk import opening stock',
            reference: 'bulk-import',
            performedBy: user?._id,
          });
        } catch (_) { /* Size.stock already set above */ }

        out.stockApplied += 1;
      }
    } catch (err) {
      // Surface duplicate-key failures (e.g. a barcode/sku already used by this
      // tenant) as a readable message instead of the raw Mongo E11000 dump.
      const message = (err.code === 11000 || /E11000/.test(err.message || ''))
        ? `Duplicate value already exists (${Object.entries(err.keyValue || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'unique field'}) — group skipped`
        : err.message;
      out.errors.push({ group: g.key, message });
    }
  }
  return out;
}

module.exports = {
  normalizeRows, isValidSize, groupRows, SIZE_ENUM,
  validateImport, findProductByName, commitImport,
  normalizeProductName, buildProductIndex, loadProductIndex,
};
