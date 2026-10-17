const Warehouse = require('../../models/Warehouse');
const SubProduct = require('../../models/SubProduct');
const Size = require('../../models/Size');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const { productLines, id, qty } = require('./quantities');
async function resolveWarehouse(tenantId, warehouseId, session) {
  const warehouse = await Warehouse.findOne({tenant:tenantId,isActive:{$ne:false},
    ...(warehouseId ? {_id:warehouseId} : {isDefault:true})}).session(session).lean();
  if (!warehouse) throw new NotFoundError('Select an active warehouse belonging to this tenant.');
  return warehouse._id;
}
async function resolveLines(order, tenantId, session) {
  const lines = productLines(order.items);
  if (!lines.length) throw new ValidationError('Add a product before confirming.');
  for (const line of lines) {
    if (!(qty(line.quantity) > 0)) throw new ValidationError('Product quantity must be greater than zero.');
    const sp = await SubProduct.findOne({_id:line.subproduct,tenant:tenantId}).select('product defaultSize sizes').session(session).lean();
    if (!sp) throw new NotFoundError('Product does not belong to this tenant.');
    const sizeId = line.size || sp.defaultSize;
    if (!sizeId) throw new ValidationError('Select a size or configure the product default size.');
    const size = await Size.findOne({_id:sizeId,tenant:tenantId,subproduct:sp._id}).select('_id').session(session).lean();
    if (!size) throw new ValidationError('Size does not belong to this product and tenant.');
    if (line.product && sp.product && id(line.product) !== id(sp.product))
      throw new ValidationError('Product catalog reference does not match the tenant product.');
    line.size = size._id;
    if (!line.product && sp.product) line.product = sp.product;
  }
  return lines;
}
module.exports = { resolveWarehouse, resolveLines };
