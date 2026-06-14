// controllers/vendorPricelist.controller.js
const VendorPricelist = require('../models/VendorPricelist');
const PurchaseOrder = require('../models/PurchaseOrder');
const { syncVendorPricelistFromPO } = require('../services/vendorPricelistSync.service');
const { pushHistory, changePercent, findLine } = require('../utils/pricelistHistory');

const createVendorPricelist = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const { 
      name, vendor, vendorName, currency, startDate, endDate, 
      isActive, discountPercent, notes, items 
    } = req.body;

    if (!name || !vendorName) {
      return res.status(400).json({ success: false, message: 'Name and vendor are required' });
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
  } catch (error) {
    console.error('Error creating vendor pricelist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVendorPricelist = async (req, res) => {
  try {
    const { id } = req.params;
    const pricelist = await VendorPricelist.findById(id)
      .populate('vendor', 'name email phone')
      .populate('createdBy', 'name email');

    if (!pricelist) {
      return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
    }

    res.json({ success: true, data: pricelist });
  } catch (error) {
    console.error('Error getting vendor pricelist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVendorPricelists = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error getting vendor pricelists:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateVendorPricelist = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const updates = req.body;

    const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId });
    if (!pricelist) {
      return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
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

    Object.keys(updates).forEach((key) => {
      if (key !== 'tenant' && key !== 'createdBy') {
        pricelist[key] = updates[key];
      }
    });
    pricelist.updatedBy = userId;

    await pricelist.save();

    res.json({ success: true, data: pricelist });
  } catch (error) {
    console.error('Error updating vendor pricelist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteVendorPricelist = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;

    const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId });
    if (!pricelist) {
      return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
    }

    await pricelist.deleteOne();

    res.json({ success: true, message: 'Vendor pricelist deleted' });
  } catch (error) {
    console.error('Error deleting vendor pricelist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPricelistForProduct = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { vendorId, subProductId, sizeId, quantity = 1 } = req.query;

    if (!vendorId || !subProductId) {
      return res.status(400).json({ success: false, message: 'Vendor ID and Product ID required' });
    }

    const pricelists = await VendorPricelist.find({
      tenant: tenantId,
      vendor: vendorId,
      isActive: true,
      $or: [
        { startDate: { $lte: new Date() }, endDate: { $gte: new Date() } },
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: { $lte: new Date() }, endDate: { $exists: false } },
      ],
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
  } catch (error) {
    console.error('Error getting pricelist for product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVendorPriceListsByProduct = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { subProductId, sizeId } = req.query;

    if (!subProductId) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }

    const pricelists = await VendorPricelist.find({
      tenant: tenantId,
      isActive: true,
      $or: [
        { startDate: { $lte: new Date() }, endDate: { $gte: new Date() } },
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: { $lte: new Date() }, endDate: { $exists: false } },
      ],
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
  } catch (error) {
    console.error('Error getting vendor pricelists by product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const syncNow = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error syncing vendor pricelist now:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPriceMatrix = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { search } = req.query;
    const now = new Date();

    const pricelists = await VendorPricelist.find({
      tenant: tenantId,
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: { $lte: now }, endDate: { $exists: false } },
      ],
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
  } catch (error) {
    console.error('Error building price matrix:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

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
