const Size = require('../models/Size');

const SIZE_ENUM = new Set(Size.schema.path('size').enumValues);

function toNum(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function normalizeRows(rawRows) {
  return (rawRows || []).map((r, i) => ({
    productName: str(r.productName),
    productType: str(r.productType).toLowerCase(),
    brand: str(r.brand),
    category: str(r.category),
    subCategory: str(r.subCategory),
    subProductSku: str(r.subProductSku).toUpperCase(),
    costPrice: toNum(r.costPrice),
    sellingPrice: toNum(r.sellingPrice),
    size: str(r.size),
    sizeSku: str(r.sizeSku).toUpperCase(),
    barcode: str(r.barcode).toUpperCase(),
    sizePrice: toNum(r.sizePrice),
    sizeCostPrice: toNum(r.sizeCostPrice),
    openingQty: toNum(r.openingQty),
    _rowNum: i + 1,
  }));
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

module.exports = { normalizeRows, isValidSize, groupRows, SIZE_ENUM };
