// controllers/vendorPricelist.controller.js
const VendorPricelist = require('../models/VendorPricelist');
const PurchaseOrder = require('../models/PurchaseOrder');
const { syncVendorPricelistFromPO } = require('../services/vendorPricelistSync.service');
const { pushHistory, changePercent, findLine } = require('../utils/pricelistHistory');
const { activeWindowFilter } = require('../utils/pricelistWindow');
const asyncHandler = require('../utils/asyncHandler');

// Fields a client may write. Everything else (tenant, createdBy,
// lastSyncedAt, lastSyncedPO, updatedBy…) is server-owned.
const EDITABLE_FIELDS = [
  'name',
  'vendor',
  'vendorName',
  'currency',
  'startDate',
  'endDate',
  'isActive',
  'discountPercent',
  'notes',
  'items',
  'source',
  'autoManaged',
];

/**
 * Embedded price lines must reference a product and carry a positive price.
 * Returns an error message or null when valid.
 */
function validateItems(items) {
  if (!Array.isArray(items)) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || !it.subProductId) {
      return `Line ${i + 1}: a linked product is required`;
    }
    if (!(Number(it.unitPrice) > 0)) {
      return `Line ${i + 1}: unit price must be greater than 0`;
    }
  }
  return null;
}

const createVendorPricelist = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const {
    name, vendor, vendorName, currency, startDate, endDate,
    isActive, discountPercent, notes, items,
  } = req.body;

  if (!name || !vendorName) {
    return res.status(400).json({ success: false, message: 'Name and vendor are required' });
  }
  const itemError = validateItems(items);
  if (itemError) {
    return res.status(400).json({ success: false, message: itemError });
  }

  const pricelist = await VendorPricelist.create({
    tenant: tenantId,
    name,
    vendor,
    vendorName,
    currency: currency || 'NGN',
    startDate,
    endDate,
    isActive: isActive !== false,
    discountPercent: discountPercent || 0,
    notes,
    items: items || [],
    createdBy: userId,
  });

  res.status(201).json({ success: true, data: pricelist });
});

const getVendorPricelist = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { id } = req.params;
  // Workstream B: bare findById let any tenant read another tenant's list by
  // guessing an _id. Scope every read by the JWT tenant.
  const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId })
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'name email');

  if (!pricelist) {
    return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
  }

  res.json({ success: true, data: pricelist });
});

const getVendorPricelists = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { vendor, isActive, page = 1, limit = 20 } = req.query;

  const filter = { tenant: tenantId };
  if (vendor) filter.vendor = vendor;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const pricelists = await VendorPricelist.find(filter)
    .populate('vendor', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await VendorPricelist.countDocuments(filter);

  res.json({
    success: true,
    data: pricelists,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const updateVendorPricelist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const updates = req.body;

  const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId });
  if (!pricelist) {
    return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
  }

  const itemError = validateItems(updates.items);
  if (itemError) {
    return res.status(400).json({ success: false, message: itemError });
  }

  // Log manual price changes into per-line history before applying item edits.
  if (Array.isArray(updates.items)) {
    const now = new Date();
    updates.items.forEach((incoming, idx) => {
      if (!incoming) return;
      const prevLine = findLine(pricelist.items, incoming) || pricelist.items[idx];
      const oldPrice = prevLine ? prevLine.unitPrice : undefined;
      const newPrice = Number(incoming.unitPrice) || 0;
      if (prevLine && oldPrice != null && newPrice > 0 && newPrice !== oldPrice) {
        if (!Array.isArray(incoming.priceHistory)) {
          incoming.priceHistory = Array.isArray(prevLine.priceHistory)
            ? [...prevLine.priceHistory]
            : [];
        }
        pushHistory(incoming, {
          unitPrice: newPrice,
          basePrice: Number(incoming.basePrice) || newPrice,
          date: now,
          source: 'manual',
          userId,
          changePercent: changePercent(oldPrice, newPrice),
        });
      }
    });
  }

  // Allowlist assignment — never copy arbitrary client keys onto the doc.
  EDITABLE_FIELDS.forEach((key) => {
    if (key in updates) pricelist[key] = updates[key];
  });
  pricelist.updatedBy = userId;

  await pricelist.save();

  res.json({ success: true, data: pricelist });
});

const deleteVendorPricelist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId });
  if (!pricelist) {
    return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
  }

  await pricelist.deleteOne();

  res.json({ success: true, message: 'Vendor pricelist deleted' });
});

const getPricelistForProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { vendorId, subProductId, sizeId, quantity = 1 } = req.query;

  if (!vendorId || !subProductId) {
    return res.status(400).json({ success: false, message: 'Vendor ID and Product ID required' });
  }

  const pricelists = await VendorPricelist.find({
    tenant: tenantId,
    vendor: vendorId,
    isActive: true,
    ...activeWindowFilter(),
  }).sort({ createdAt: -1 });

  for (const pricelist of pricelists) {
    const price = pricelist.getPriceForProduct(subProductId, sizeId, parseInt(quantity));
    if (price !== null) {
      return res.json({
        success: true,
        data: {
          pricelistId: pricelist._id,
          pricelistName: pricelist.name,
          currency: pricelist.currency,
          unitPrice: price,
          discountPercent: pricelist.discountPercent,
        },
      });
    }
  }

  res.json({ success: true, data: null });
});

const getVendorPriceListsByProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { subProductId, sizeId } = req.query;

  if (!subProductId) {
    return res.status(400).json({ success: false, message: 'Product ID required' });
  }

  const pricelists = await VendorPricelist.find({
    tenant: tenantId,
    isActive: true,
    ...activeWindowFilter(),
  }).populate('vendor', 'name email phone');

  const results = pricelists.map(pricelist => {
    const item = pricelist.items.find(i => {
      const productMatch = i.subProductId.toString() === subProductId.toString();
      const sizeMatch = sizeId ? i.sizeId && i.sizeId.toString() === sizeId.toString() : true;
      return productMatch && sizeMatch;
    });

    return {
      pricelistId: pricelist._id,
      pricelistName: pricelist.name,
      vendor: pricelist.vendor,
      currency: pricelist.currency,
      unitPrice: item?.unitPrice || null,
      discountPercent: item?.discountPercent || pricelist.discountPercent,
      leadTimeDays: item?.leadTimeDays,
      vendorProductCode: item?.vendorProductCode,
    };
  }).filter(r => r.unitPrice !== null);

  res.json({ success: true, data: results });
});

const syncNow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;
  const userId = req.user._id;

  const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId });
  if (!pricelist) {
    return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
  }

  const lastPO = await PurchaseOrder.findOne({
    tenant: tenantId,
    vendor: pricelist.vendor,
    status: 'validated',
  }).sort({ updatedAt: -1 });

  if (!lastPO) {
    return res.json({
      success: false,
      message: 'No validated purchase order found for this vendor yet',
    });
  }

  const result = await syncVendorPricelistFromPO(lastPO, tenantId, userId);
  const updated = await VendorPricelist.findById(result.pricelistId)
    .populate('vendor', 'name email');

  res.json({
    success: true,
    data: updated,
    result: { ...result, poNumber: lastPO.poNumber },
  });
});

const getPriceMatrix = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { search } = req.query;

  const pricelists = await VendorPricelist.find({
    tenant: tenantId,
    isActive: true,
    ...activeWindowFilter(),
  }).populate('vendor', 'name email');

  const q = (search || '').trim().toLowerCase();
  const groups = new Map();

  for (const pl of pricelists) {
    for (const it of pl.items) {
      if (!it.subProductId || !(Number(it.unitPrice) > 0)) continue;
      const name = it.subProductName || it.productName || '';
      const sku = it.sku || '';
      if (q && !name.toLowerCase().includes(q) && !sku.toLowerCase().includes(q)) continue;

      const key = `${it.subProductId}::${it.sizeId || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          subProductId: it.subProductId,
          sizeId: it.sizeId || null,
          subProductName: name,
          sizeName: it.sizeName || null,
          sku,
          vendors: [],
        });
      }
      groups.get(key).vendors.push({
        vendorId: pl.vendor?._id || pl.vendor,
        vendorName: pl.vendor?.name || pl.vendorName,
        pricelistId: pl._id,
        pricelistName: pl.name,
        currency: pl.currency,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent || 0,
        leadTimeDays: it.leadTimeDays,
        vendorProductCode: it.vendorProductCode,
      });
    }
  }

  res.json({ success: true, data: Array.from(groups.values()) });
});

module.exports = {
  createVendorPricelist,
  getVendorPricelist,
  getVendorPricelists,
  updateVendorPricelist,
  deleteVendorPricelist,
  getPricelistForProduct,
  getVendorPriceListsByProduct,
  syncNow,
  getPriceMatrix,
};
