const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const { ValidationError } = require('../utils/errors');

// A listing references a shared location; it never owns the location document.
async function resolveWarehouseReference(value, current, tenantId, session = null) {
  if (value === undefined) return current;
  if (value === null || value === '') return null;
  const id = value?._id || (typeof value === 'string' || value instanceof mongoose.Types.ObjectId ? value : null);
  if (!id) {
    // Older forms always send an empty storage-address object. Ignore it.
    if (typeof value === 'object' && !Array.isArray(value) &&
        Object.values(value).every(v => v === '' || v == null)) return current;
    throw new ValidationError('Select an existing warehouse. Manage locations and storage bins separately.');
  }
  if (!mongoose.isObjectIdOrHexString(id)) throw new ValidationError('Invalid warehouse ID');
  const query = Warehouse.findOne({ _id: id, tenant: tenantId, isActive: true });
  if (session) query.session(session);
  const warehouse = await query;
  if (!warehouse) throw new ValidationError('Warehouse is not active or does not belong to this tenant');
  return warehouse._id;
}

module.exports = { resolveWarehouseReference };
