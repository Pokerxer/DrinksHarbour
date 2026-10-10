'use strict';
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const { ConflictError } = require('../utils/errors');
async function changeStock(items, session, release = false) {
  for (const item of items) {
    const filter = { _id: item.subproduct, tenant: item.tenant };
    const sizeFilter = { _id: item.size, tenant: item.tenant, subproduct: item.subproduct };
    if (release) {
      filter.reservedStock = { $gte: item.quantity };
      sizeFilter.reservedStock = { $gte: item.quantity };
    } else {
      Object.assign(filter, { isPublished: true, status: 'active', availableStock: { $gte: item.quantity }, totalStock: { $gte: item.quantity } });
      Object.assign(sizeFilter, { status: 'active', availability: { $in: ['available', 'low_stock', 'limited_stock'] },
        availableStock: { $gte: item.quantity }, stock: { $gte: item.quantity } });
    }
    const direction = release ? 1 : -1;
    const parent = await SubProduct.updateOne(filter, { $inc: { totalStock: direction * item.quantity,
      availableStock: direction * item.quantity, reservedStock: -direction * item.quantity } }, { session });
    if (!parent.modifiedCount) throw new ConflictError('Product stock changed; refresh your cart');
    if (item.size) {
      const size = await Size.updateOne(sizeFilter, { $inc: { stock: direction * item.quantity,
        availableStock: direction * item.quantity, reservedStock: -direction * item.quantity } }, { session });
      if (!size.modifiedCount) throw new ConflictError('Variant stock changed; refresh your cart');
    }
  }
}
module.exports = {
  reserveStock: (items, session) => changeStock(items, session),
  releaseStock: (items, session) => changeStock(items, session, true),
};
