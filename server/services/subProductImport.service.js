const RealSize = require('../models/Size');
const RealProduct = require('../models/Product');
const RealSubProduct = require('../models/SubProduct');

const SIZE_ENUM = new Set(RealSize.schema.path('size').enumValues);
const PRODUCT_TYPES = new Set(RealProduct.schema.path('type').enumValues);

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
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findProductByName(name, Product) {
  if (!name) return null;
  const q = Product.findOne({ name: { $regex: new RegExp(`^${escapeRe(name)}$`, 'i') } });
  return (q && typeof q.select === 'function') ? q.select('_id').lean() : q;
}

async function validateImport(rawRows, opts, tenantId, deps) {
  const { Product, SubProduct, Size } = defaultDeps(deps);
  const warehouseId = opts?.warehouseId || null;
  const rows = normalizeRows(rawRows);
  const groups = groupRows(rows);
  const blocking = [];
  const totals = {
    groups: groups.length, sizes: 0,
    willCreateProduct: 0, willLinkProduct: 0, willUpdateSubProduct: 0, errorRows: 0,
  };
  let anyQty = false;

  const groupReports = [];
  for (const g of groups) {
    const existingProduct = await findProductByName(g.productName, Product);
    let existingSub = null;
    if (existingProduct) {
      const firstSku = g.rows.find((r) => r.subProductSku)?.subProductSku;
      const subQ = SubProduct.findOne({
        tenant: tenantId,
        ...(firstSku ? { sku: firstSku } : { product: existingProduct._id }),
      });
      existingSub = await ((subQ && typeof subQ.select === 'function') ? subQ.select('_id').lean() : subQ);
    }
    const action = existingSub ? 'updateSubProduct'
      : existingProduct ? 'linkProduct' : 'createProduct';

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
      if (action === 'createProduct' && (!r.productType || !PRODUCT_TYPES.has(r.productType))) {
        rowErrors.push({ rowNum: r._rowNum, field: 'productType', message: 'valid productType required to create a new product' });
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
    totals.errorRows += rowErrors.length;
    if (action === 'createProduct') totals.willCreateProduct += 1;
    else if (action === 'linkProduct') totals.willLinkProduct += 1;
    else totals.willUpdateSubProduct += 1;

    groupReports.push({ key: g.key, productName: g.productName, action, sizeCount, rowErrors, sizeNotes });
  }

  if (anyQty && !warehouseId) {
    blocking.push('Select a target warehouse — some rows have an opening quantity.');
  }
  const ok = blocking.length === 0 && totals.errorRows === 0;
  return { ok, groups: groupReports, totals, blocking };
}

module.exports = { normalizeRows, isValidSize, groupRows, SIZE_ENUM, validateImport, findProductByName };
