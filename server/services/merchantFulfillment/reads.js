'use strict';
const Order = require('../../models/Order'),
  mongoose = require('mongoose'),
  { id } = require('./allocation'),
  { dto } = require('./access');
const recipientFields = [
  'fullName',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'country',
  'postalCode',
  'landmark',
  'additionalInstructions',
];
const pick = (value, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => value?.[key] !== undefined)
      .map((key) => [key, value[key]])
  );
const ids = (rows, key) => [
  ...new Set(
    rows
      .flatMap((row) => row.lines || [])
      .map((line) => id(line[key]))
      .filter((value) => mongoose.isValidObjectId(value))
  ),
];
const indexed = (rows) => new Map(rows.map((row) => [id(row), row]));
async function views(rows) {
  const [parents, products, offers, sizes] = await Promise.all([
    Order.find({ _id: { $in: [...new Set(rows.map((row) => id(row.order)))] } })
      .select(
        'orderNumber shippingAddress.fullName shippingAddress.phone shippingAddress.addressLine1 shippingAddress.addressLine2 shippingAddress.city shippingAddress.state shippingAddress.country shippingAddress.postalCode shippingAddress.landmark shippingAddress.additionalInstructions items.fulfillmentLineId items.tenant items.warehouse items.product items.subproduct items.size'
      )
      .lean(),
    require('../../models/Product')
      .find({ _id: { $in: ids(rows, 'product') } })
      .select('name')
      .lean(),
    require('../../models/SubProduct')
      .find({
        _id: { $in: ids(rows, 'subproduct') },
        tenant: { $in: rows.map((row) => row.tenant) },
      })
      .select('tenant product sku')
      .lean(),
    require('../../models/Size')
      .find({
        _id: { $in: ids(rows, 'size') },
        tenant: { $in: rows.map((row) => row.tenant) },
      })
      .select('tenant subproduct displayName sku')
      .lean(),
  ]);
  const byId = indexed(parents),
    productById = indexed(products),
    offerById = indexed(offers),
    sizeById = indexed(sizes);
  return rows.map((row) => {
    const view = dto(row),
      parent = byId.get(id(row.order));
    if (!parent) return view;
    view.orderNumber = parent.orderNumber;
    view.recipient = pick(parent.shippingAddress, recipientFields);
    const ownLines = new Map(
      (parent.items || [])
        .filter(
          (line) =>
            id(line.tenant) === id(row.tenant) &&
            id(line.warehouse) === id(row.location)
        )
        .map((line) => [id(line.fulfillmentLineId), line])
    );
    view.lines = view.lines.map((line) => {
      const saved = ownLines.get(id(line.line));
      if (
        !saved ||
        ['product', 'subproduct', 'size'].some(
          (key) => id(line[key]) !== id(saved[key])
        )
      )
        return line;
      const product = productById.get(id(line.product)),
        offer = offerById.get(id(line.subproduct)),
        size = sizeById.get(id(line.size));
      const ownOffer =
        offer &&
        id(offer.tenant) === id(row.tenant) &&
        id(offer.product) === id(line.product);
      const ownSize =
        ownOffer &&
        size &&
        id(size.tenant) === id(row.tenant) &&
        id(size.subproduct) === id(line.subproduct);
      return {
        ...line,
        ...(product?.name ? { productName: product.name } : {}),
        ...(ownSize && size.displayName ? { sizeName: size.displayName } : {}),
        ...(ownOffer && ((ownSize && size.sku) || offer.sku)
          ? { sku: (ownSize && size.sku) || offer.sku }
          : {}),
      };
    });
    return view;
  });
}
module.exports = { views };
