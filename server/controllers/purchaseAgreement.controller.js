// controllers/purchaseAgreement.controller.js
const PurchaseAgreement = require('../models/PurchaseAgreement');
const PurchaseOrder = require('../models/PurchaseOrder');
const Vendor = require('../models/Vendor');

const generateAgreementNumber = async (tenantId) => {
  const count = await PurchaseAgreement.countDocuments({ tenant: tenantId });
  const prefix = 'PA';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
};

const createPurchaseAgreement = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const { 
      name, agreementType, selectionType, vendor, vendorName, currency,
      startDate, endDate, totalQuantity, totalAmount, termsConditions, notes, items
    } = req.body;

    if (!name || !agreementType || !vendorName || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const agreementNumber = await generateAgreementNumber(tenantId);

    const agreement = await PurchaseAgreement.create({
      tenant: tenantId,
      agreementNumber,
      name,
      agreementType,
      selectionType: selectionType || 'exclusive',
      vendor,
      vendorName,
      currency: currency || 'NGN',
      startDate,
      endDate,
      totalQuantity: totalQuantity || 0,
      totalAmount: totalAmount || 0,
      termsConditions,
      notes,
      items: items || [],
      status: 'draft',
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: agreement });
  } catch (error) {
    console.error('Error creating purchase agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPurchaseAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const agreement = await PurchaseAgreement.findById(id)
      .populate('vendor', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('purchaseOrders', 'poNumber status confirmationDate')
      .populate('rfqs', 'poNumber rfqStatus');

    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    res.json({ success: true, data: agreement });
  } catch (error) {
    console.error('Error getting purchase agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPurchaseAgreements = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { status, type, vendor, page = 1, limit = 20 } = req.query;

    const filter = { tenant: tenantId };
    if (status) filter.status = status;
    if (type) filter.agreementType = type;
    if (vendor) filter.vendor = vendor;

    const agreements = await PurchaseAgreement.find(filter)
      .populate('vendor', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PurchaseAgreement.countDocuments(filter);

    res.json({
      success: true,
      data: agreements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error getting purchase agreements:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePurchaseAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const updates = req.body;

    const agreement = await PurchaseAgreement.findOne({ _id: id, tenant: tenantId });
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    if (agreement.status === 'active') {
      return res.status(400).json({ success: false, message: 'Cannot modify active agreement' });
    }

    Object.keys(updates).forEach(key => {
      if (key !== 'agreementNumber' && key !== 'tenant' && key !== 'createdBy') {
        agreement[key] = updates[key];
      }
    });

    await agreement.save();

    res.json({ success: true, data: agreement });
  } catch (error) {
    console.error('Error updating purchase agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deletePurchaseAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;

    const agreement = await PurchaseAgreement.findOne({ _id: id, tenant: tenantId });
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    if (agreement.status === 'active' && agreement.consumedQuantity > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete active agreement with consumption' 
      });
    }

    await agreement.deleteOne();

    res.json({ success: true, message: 'Purchase agreement deleted' });
  } catch (error) {
    console.error('Error deleting purchase agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const activatePurchaseAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    const agreement = await PurchaseAgreement.findOne({ _id: id, tenant: tenantId });
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    if (agreement.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft agreements can be activated' });
    }

    if (!agreement.items || agreement.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Agreement must have at least one item' });
    }

    agreement.status = 'active';
    agreement.approvedBy = userId;
    agreement.approvedAt = new Date();
    await agreement.save();

    res.json({ success: true, data: agreement });
  } catch (error) {
    console.error('Error activating purchase agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const addTenderResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const { vendorId, vendorName, items, notes, totalAmount, currency, deliveryDate, validityDate } = req.body;

    const agreement = await PurchaseAgreement.findOne({ _id: id, tenant: tenantId });
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    if (agreement.agreementType !== 'call_for_tender') {
      return res.status(400).json({ success: false, message: 'This is not a call for tender' });
    }

    const response = {
      vendorId,
      vendorName,
      submittedAt: new Date(),
      totalAmount,
      currency,
      items,
      notes,
      deliveryDate,
      validityDate,
      status: 'pending',
    };

    agreement.tenderResponses.push(response);
    await agreement.save();

    res.json({ success: true, data: agreement });
  } catch (error) {
    console.error('Error adding tender response:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const selectTenderWinner = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const { vendorIndex, vendorId, notes } = req.body;

    const agreement = await PurchaseAgreement.findOne({ _id: id, tenant: tenantId });
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    if (agreement.agreementType !== 'call_for_tender') {
      return res.status(400).json({ success: false, message: 'This is not a call for tender' });
    }

    agreement.tenderResponses.forEach((response, index) => {
      if (index === vendorIndex) {
        response.status = 'accepted';
      } else if (agreement.selectionType === 'exclusive') {
        response.status = 'rejected';
      }
    });

    if (vendorId) {
      const vendor = await Vendor.findById(vendorId);
      agreement.vendor = vendorId;
      agreement.vendorName = vendor?.name || vendorName;
    }

    await agreement.save();

    res.json({ success: true, data: agreement });
  } catch (error) {
    console.error('Error selecting tender winner:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPOFromAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const { items, vendorReference, expectedArrival, notes } = req.body;

    const agreement = await PurchaseAgreement.findOne({ _id: id, tenant: tenantId });
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Purchase agreement not found' });
    }

    if (agreement.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Agreement must be active to create PO' });
    }

    const poNumber = await generatePONumber(tenantId);

    const poItems = items.map(item => {
      const agreementItem = agreement.items.find(i => 
        i.subProductId.toString() === item.subProductId.toString()
      );
      return {
        subProductId: item.subProductId,
        subProductName: item.subProductName || agreementItem?.subProductName,
        sku: item.sku || agreementItem?.sku,
        sizeId: item.sizeId || agreementItem?.sizeId,
        sizeName: item.sizeName || agreementItem?.sizeName,
        quantity: item.quantity,
        uom: item.uom || 'Units',
        packagingQty: item.packagingQty || agreementItem?.packagingQty || 1,
        packaging: item.packaging || agreementItem?.packaging || 'unit',
        unitCost: item.unitCost || agreementItem?.unitPrice,
        taxRate: item.taxRate || 0,
        totalCost: (item.quantity || 0) * (item.unitCost || agreementItem?.unitPrice || 0),
      };
    });

    const purchaseOrder = await PurchaseOrder.create({
      tenant: tenantId,
      poNumber,
      vendor: agreement.vendor,
      vendorName: agreement.vendorName,
      vendorReference,
      currency: agreement.currency,
      confirmationDate: new Date(),
      expectedArrival,
      items: poItems,
      notes,
      status: 'draft',
      type: 'po',
      purchaseAgreement: agreement._id,
      agreementType: agreement.agreementType,
      createdBy: userId,
    });

    agreement.purchaseOrders.push(purchaseOrder._id);
    agreement.consumedQuantity += poItems.reduce((sum, item) => sum + item.quantity, 0);
    agreement.consumedAmount += poItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    if (agreement.totalQuantity > 0 && agreement.consumedQuantity >= agreement.totalQuantity) {
      agreement.status = 'exhausted';
    }

    await agreement.save();

    res.status(201).json({ success: true, data: purchaseOrder });
  } catch (error) {
    console.error('Error creating PO from agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const generatePONumber = async (tenantId) => {
  const count = await PurchaseOrder.countDocuments({ tenant: tenantId });
  const prefix = 'PO';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
};

module.exports = {
  createPurchaseAgreement,
  getPurchaseAgreement,
  getPurchaseAgreements,
  updatePurchaseAgreement,
  deletePurchaseAgreement,
  activatePurchaseAgreement,
  addTenderResponse,
  selectTenderWinner,
  createPOFromAgreement,
};
