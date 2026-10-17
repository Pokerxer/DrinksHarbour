const Product = require('../models/Product');
const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const Tenant = require('../models/Tenant');
const Size = require('../models/Size');
const { NotFoundError, AppError } = require('../utils/errors');
const { buildProductSalesReport } = require('./product-sales-report');
const { id } = require('./linkedReturns.helpers');
const CAPACITY = 20000;
async function bounded(query) {
  const rows = await query.limit(CAPACITY + 1).lean();
  if (rows.length > CAPACITY)
    throw new AppError(
      'Sales history exceeds report capacity. Contact support to export the full history.',
      422
    );
  return rows;
}
async function getProductSalesHistory(productId, tenantId) {
  if (!(await Product.exists({ _id: productId })))
    throw new NotFoundError('Product not found');
  const orderScope = tenantId
    ? {
        $or: [
          { items: { $elemMatch: { product: productId, tenant: tenantId } } },
          {
            source: 'pos',
            tenant: tenantId,
            items: { $elemMatch: { product: productId, tenant: null } },
          },
        ],
      }
    : { 'items.product': productId };
  const [orders, sales] = await Promise.all([
    bounded(
      Order.find({
        ...orderScope,
        paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] },
        isVoided: { $ne: true },
        status: { $nin: ['hold', 'cancelled', 'voided'] },
      })
        .select(
          '_id tenant user source status fulfillmentStatus paymentStatus isVoided paidAt deliveredAt createdAt items.product items.subproduct items.tenant items.size items.quantity refunds.items refunds.source salesReturns linkedSalesOrder receiptNumber orderNumber paymentDetails.customer.firstName paymentDetails.customer.lastName paymentDetails.customer.customerId'
        )
        .populate({ path: 'user', select: '_id firstName lastName displayName' })
        .populate({
          path: 'paymentDetails.customer.customerId',
          select: '_id tenant firstName lastName',
        })
    ),
    bounded(
      SalesOrder.find({
        docType: 'order',
        paymentStatus: 'paid',
        orderStatus: { $in: ['fulfilled', 'partially_fulfilled'] },
        'items.product': productId,
        ...(tenantId ? { tenant: tenantId } : {}),
      })
        .select(
          '_id tenant docType orderStatus paymentStatus items fulfillments convertedFrom soNumber customerSnapshot.name customerSnapshot.customerId customer'
        )
        .populate({ path: 'customer', select: '_id tenant firstName lastName' })
    ),
  ]);
  const tenantIds = [
    ...new Set(
      [
        ...sales.map((s) => id(s.tenant)),
        ...orders.flatMap((o) => [
          id(o.tenant),
          ...(o.items || []).map((i) => id(i.tenant)),
        ]),
      ].filter((t) => t && (!tenantId || t === id(tenantId)))
    ),
  ];
  const sizeOwners = [
    ...sales.flatMap((s) =>
      (s.items || [])
        .filter((i) => id(i.product) === id(productId))
        .map((i) => ({ _id: i.size, subproduct: i.subproduct, tenant: s.tenant }))
    ),
    ...orders.flatMap((o) =>
      (o.items || [])
        .filter((i) => id(i.product) === id(productId))
        .map((i) => ({
          _id: i.size,
          subproduct: i.subproduct,
          tenant: i.tenant || (o.source === 'pos' ? o.tenant : null),
        }))
    ),
  ].filter(
    (s) =>
      s._id &&
      s.subproduct &&
      s.tenant &&
      (!tenantId || id(s.tenant) === id(tenantId))
  );
  const [tenants, sizes] = await Promise.all([
    tenantIds.length
      ? Tenant.find({ _id: { $in: tenantIds } })
          .select('_id name')
          .lean()
      : [],
    sizeOwners.length
      ? Size.find({
          $or: [
            ...new Map(
              sizeOwners.map((s) => [
                [id(s._id), id(s.subproduct), id(s.tenant)].join(':'),
                s,
              ])
            ).values(),
          ],
        })
          .select('_id subproduct tenant size displayName')
          .lean()
      : [],
  ]);
  return buildProductSalesReport({
    productId,
    tenantId,
    orders,
    sales,
    tenants,
    sizes,
  });
}
module.exports = { getProductSalesHistory };
