const mongoose = require('mongoose');
const { ValidationError } = require('../utils/errors');
const { escapeRegex } = require('../utils/escapeRegex');
const statuses = {
  purchases: ['draft', 'confirmed', 'partially_received', 'received', 'validated', 'cancelled'],
  transfers: [
    'draft',
    'pending_approval',
    'confirmed',
    'in_transit',
    'partially_received',
    'completed',
    'cancelled',
    'rejected',
  ],
  movements: [
    'received',
    'adjusted',
    'shipped',
    'transfer_in',
    'transfer_out',
    'returned',
    'return_out',
  ],
  transfer_movements: ['transfer_in', 'transfer_out', 'returned', 'return_out'],
};
function productIds(value) {
  if (!value) return [];
  if (typeof value !== 'string' || value.length > 2600)
    throw new ValidationError('Invalid product filter');
  const ids = [
    ...new Set(
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > 100 || ids.some((id) => !mongoose.isValidObjectId(id)))
    throw new ValidationError('Invalid product filter');
  return ids;
}
function productCondition(value) {
  const ids = productIds(value);
  return ids.length > 1 ? { $in: ids } : ids[0];
}
function addHistoryFilters(query, kind, { status, search } = {}) {
  if (status) {
    if (typeof status !== 'string' || !statuses[kind].includes(status))
      throw new ValidationError('Invalid history status');
    query[kind === 'movements' || kind === 'transfer_movements' ? 'type' : 'status'] = status;
  }
  if (search) {
    if (typeof search !== 'string' || search.length > 200)
      throw new ValidationError('Invalid history search');
    const term = search.trim();
    if (term) {
      const regex = new RegExp(escapeRegex(term), 'i');
      if (kind === 'purchases')
        query.$and = [
          { $or: [{ poNumber: regex }, { vendorName: regex }, { vendorReference: regex }] },
        ];
      else query[kind === 'transfers' ? 'transferNumber' : 'reference'] = regex;
    }
  }
  return query;
}
module.exports = { productIds, productCondition, addHistoryFilters };
