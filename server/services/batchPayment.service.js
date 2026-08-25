// services/batchPayment.service.js
//
// Batch payments: group posted customer/vendor payments into a deposit /
// reconciliation run. Organisational only — the batch itself posts no journal
// (each payment already posted); documented in the RESUME doc.

const mongoose = require('mongoose');
const BatchPayment = require('../models/BatchPayment');
const CustomerPayment = require('../models/CustomerPayment');
const VendorPayment = require('../models/VendorPayment');
const { nextDocNumber } = require('./accounting.helpers');

function bad(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const Model = (direction) =>
  direction === 'customer' ? CustomerPayment : VendorPayment;

async function nextNumber(tenantId) {
  const count = await BatchPayment.countDocuments({ tenant: tenantId });
  for (let i = 0; i < 3; i++) {
    const candidate = nextDocNumber('BATCH', count + i);
    // eslint-disable-next-line no-await-in-loop
    if (!(await BatchPayment.exists({ tenant: tenantId, number: candidate }))) return candidate;
  }
  return `BATCH-${Date.now()}`;
}

/** Create an open batch from active, unbatched payments of one direction. */
async function createBatch({ tenantId, direction, paymentIds, account, userId }) {
  if (!['customer', 'vendor'].includes(direction)) throw bad('direction must be customer|vendor');
  if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
    throw bad('paymentIds must be a non-empty array');
  }
  const PM = Model(direction);
  const payments = await PM.find({
    _id: { $in: paymentIds },
    tenant: tenantId,
    status: 'active',
    batch: null,
  });
  if (payments.length === 0) {
    throw bad('No eligible open payments found (already batched or cancelled)');
  }
  const total = round2(payments.reduce((s, p) => s + (p.amount || 0), 0));
  const batch = await BatchPayment.create({
    tenant: tenantId,
    number: await nextNumber(tenantId),
    direction,
    account: account === '1000' ? '1000' : '1100',
    total,
    status: 'open',
    createdBy: userId,
  });
  await PM.updateMany(
    { _id: { $in: payments.map((p) => p._id) }, tenant: tenantId },
    { $set: { batch: batch._id } }
  );
  return batch;
}

/** Mark an open batch deposited (bank run complete). */
async function depositBatch({ tenantId, id }) {
  const batch = await BatchPayment.findOne({ _id: id, tenant: tenantId });
  if (!batch) throw bad('Batch not found', 404);
  if (batch.status !== 'open') throw bad(`Only open batches can be deposited (${batch.status})`, 409);
  batch.status = 'deposited';
  batch.depositedAt = new Date();
  await batch.save();
  return batch;
}

/** Cancel an open batch — unlink its payments (they stay posted and reusable). */
async function cancelBatch({ tenantId, id }) {
  const batch = await BatchPayment.findOne({ _id: id, tenant: tenantId });
  if (!batch) throw bad('Batch not found', 404);
  if (batch.status !== 'open') {
    throw bad(`Only open batches can be cancelled (${batch.status})`, 409);
  }
  await Model(batch.direction).updateMany(
    { batch: batch._id, tenant: tenantId },
    { $set: { batch: null } }
  );
  batch.status = 'cancelled';
  await batch.save();
  return batch;
}

async function listBatches(tenantId, { direction, status, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId };
  if (direction) filter.direction = direction;
  if (status) filter.status = status;
  const [data, total] = await Promise.all([
    BatchPayment.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name')
      .lean(),
    BatchPayment.countDocuments(filter),
  ]);
  // Attach the batched payment summaries.
  const withPayments = await Promise.all(
    data.map(async (b) => ({
      ...b,
      payments: await Model(b.direction)
        .find({ batch: b._id })
        .select('number customerName vendorName amount date method status')
        .lean(),
    }))
  );
  return { data: withPayments, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** Unbatched active payments available for a new batch. */
async function listUnbatched(tenantId, direction, { page = 1, limit = 100 } = {}) {
  const PM = Model(direction);
  const filter = { tenant: tenantId, status: 'active', batch: null };
  const [data, total] = await Promise.all([
    PM.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PM.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

module.exports = { createBatch, depositBatch, cancelBatch, listBatches, listUnbatched };
