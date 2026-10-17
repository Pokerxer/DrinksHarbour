const asyncHandler = require('express-async-handler');
const SalesOrder = require('../models/SalesOrder');
const salesLog = require('../services/salesActivity.service');

function changeLock(locked) {
  return asyncHandler(async (req, res) => {
    const tenant = req.tenant?._id;
    if (!tenant)
      return res
        .status(401)
        .json({ success: false, message: 'Tenant not resolved' });
    const doc = await SalesOrder.findOne({ _id: req.params.id, tenant });
    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: 'Sales order not found' });
    if (Boolean(doc.locked) === locked)
      return res.json({ success: true, data: doc });
    const closed =
      doc.docType === 'quotation'
        ? ['converted', 'rejected', 'expired'].includes(doc.quoteStatus)
        : doc.orderStatus === 'cancelled';
    if (locked && closed)
      return res
        .status(409)
        .json({
          success: false,
          message: 'A closed document cannot be locked.',
        });
    doc.locked = locked;
    doc.lockedAt = locked ? new Date() : undefined;
    doc.lockedBy = locked ? req.user?._id : undefined;
    await doc.save();
    await salesLog.logActivity(tenant, doc._id, {
      subject: locked ? 'Document locked' : 'Document unlocked',
      userId: req.user?._id,
    });
    res.json({ success: true, data: doc });
  });
}

module.exports = {
  lockSalesOrder: changeLock(true),
  unlockSalesOrder: changeLock(false),
};
