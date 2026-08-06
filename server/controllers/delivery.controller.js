// controllers/delivery.controller.js
//
// Thin HTTP layer. All lifecycle rules live in services/delivery.service.

const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenantContext');
const { NotFoundError } = require('../utils/errors');
const deliveryService = require('../services/delivery.service');

/**
 * @desc    Dispatch-board KPIs in a single call
 * @route   GET /api/deliveries/dashboard
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const orderScope = { 'items.tenant': tenantId };

  const [
    awaitingDispatch,
    outForDelivery,
    deliveredToday,
    lateOrders,
    deliveryTimeAgg,
    zoneBreakdown,
    methodMix,
    activeTrips,
    driverCounts,
    codOutstandingAgg,
  ] = await Promise.all([
    // Ready to go out and not yet on a trip.
    Order.countDocuments({
      ...orderScope,
      status: { $in: deliveryService.DISPATCHABLE_ORDER_STATUSES },
      shippingMethod: { $ne: 'pickup' },
    }),

    Order.countDocuments({ ...orderScope, status: 'shipped' }),

    Order.countDocuments({
      ...orderScope,
      status: 'delivered',
      deliveredAt: { $gte: startOfToday, $lt: endOfToday },
    }),

    // Shipped, and past the promised window. daysMax is stored per order at
    // checkout; orders without one cannot be judged late, so they are excluded.
    Order.countDocuments({
      ...orderScope,
      status: 'shipped',
      shippedAt: { $ne: null },
      'shippingInfo.daysMax': { $gt: 0 },
      $expr: {
        $lt: [
          {
            $add: [
              '$shippedAt',
              { $multiply: ['$shippingInfo.daysMax', 24 * 60 * 60 * 1000] },
            ],
          },
          now,
        ],
      },
    }),

    // Mean shipped→delivered time over the last 30 days, in hours.
    Order.aggregate([
      {
        $match: {
          ...orderScope,
          status: 'delivered',
          shippedAt: { $ne: null },
          deliveredAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: null,
          avgHours: {
            $avg: {
              $divide: [{ $subtract: ['$deliveredAt', '$shippedAt'] }, 1000 * 60 * 60],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    Order.aggregate([
      {
        $match: {
          ...orderScope,
          status: { $in: ['confirmed', 'processing', 'shipped'] },
        },
      },
      {
        $group: {
          _id: { zone: '$shippingInfo.zone', label: '$shippingInfo.zoneLabel' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),

    Order.aggregate([
      {
        $match: {
          ...orderScope,
          placedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      { $group: { _id: '$shippingMethod', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Delivery.countDocuments({
      tenant: tenantId,
      status: { $in: ['assigned', 'dispatched', 'in_progress'] },
    }),

    Driver.aggregate([
      { $match: { tenant: toObjectId(tenantId), isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Cash sitting with riders: collected on completed trips, not yet settled.
    Delivery.aggregate([
      {
        $match: {
          tenant: toObjectId(tenantId),
          'codSettlement.status': 'pending',
          status: { $in: ['dispatched', 'in_progress', 'completed'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$totals.codCollectedTotal' } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      kpis: {
        awaitingDispatch,
        outForDelivery,
        deliveredToday,
        late: lateOrders,
        avgDeliveryHours: round1(deliveryTimeAgg[0]?.avgHours ?? null),
        avgDeliverySampleSize: deliveryTimeAgg[0]?.count ?? 0,
        activeTrips,
        codOutstanding: codOutstandingAgg[0]?.total ?? 0,
      },
      drivers: driverCounts.reduce(
        (acc, d) => ({ ...acc, [d._id]: d.count }),
        { available: 0, on_trip: 0, off_duty: 0, suspended: 0 }
      ),
      zones: zoneBreakdown.map((z) => ({
        zone: z._id.zone || 'unzoned',
        label: z._id.label || 'Unzoned',
        count: z.count,
      })),
      methodMix: methodMix.map((m) => ({ method: m._id || 'unspecified', count: m.count })),
    },
  });
});

/**
 * @desc    Orders ready to dispatch and not already on a trip
 * @route   GET /api/deliveries/unassigned
 */
exports.getUnassigned = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const orders = await deliveryService.getUnassignedOrders(tenantId, {
    zone: req.query.zone,
    limit: req.query.limit,
  });
  res.status(200).json({ success: true, data: { orders } });
});

/**
 * @desc    List trips
 * @route   GET /api/deliveries
 */
exports.listDeliveries = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { status, driver, zone, active, limit = 50 } = req.query;

  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (driver) filter.driver = driver;
  if (zone) filter.zone = zone;
  if (active === 'true') {
    filter.status = { $in: deliveryService.ACTIVE_DELIVERY_STATUSES };
  }

  const deliveries = await Delivery.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('driver', 'name phone vehicle status')
    .populate('stops.order', 'orderNumber totalAmount paymentMethod paymentStatus status')
    .lean({ virtuals: true });

  res.status(200).json({ success: true, data: { deliveries } });
});

/**
 * @desc    Single trip
 * @route   GET /api/deliveries/:id
 */
exports.getDelivery = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const delivery = await Delivery.findOne({ _id: req.params.id, tenant: tenantId })
    .populate('driver', 'name phone vehicle status')
    .populate('stops.order', 'orderNumber totalAmount paymentMethod paymentStatus status placedAt')
    .lean({ virtuals: true });

  if (!delivery) throw new NotFoundError('Trip not found.');

  res.status(200).json({ success: true, data: { delivery } });
});

/**
 * @desc    Create a trip from selected orders
 * @route   POST /api/deliveries
 */
exports.createDelivery = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.createDelivery(tenantId, req.body, req.user?._id);
  res.status(201).json({ success: true, message: 'Trip created', data: { delivery } });
});

/**
 * @desc    Edit an undispatched trip
 * @route   PATCH /api/deliveries/:id
 */
exports.updateDelivery = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.updateDelivery(tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Trip updated', data: { delivery } });
});

/**
 * @desc    Dispatch a trip — orders become 'shipped'
 * @route   POST /api/deliveries/:id/dispatch
 */
exports.dispatchDelivery = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.dispatchDelivery(tenantId, req.params.id, req.user?._id);
  res.status(200).json({ success: true, message: 'Trip dispatched', data: { delivery } });
});

/**
 * @desc    Mark a stop delivered or failed
 * @route   PATCH /api/deliveries/:id/stops/:stopId
 */
exports.resolveStop = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.resolveStop(
    tenantId,
    req.params.id,
    req.params.stopId,
    req.body,
    req.user?._id
  );
  res.status(200).json({ success: true, message: 'Stop updated', data: { delivery } });
});

/**
 * @desc    Close a trip
 * @route   POST /api/deliveries/:id/complete
 */
exports.completeDelivery = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.completeDelivery(tenantId, req.params.id);
  res.status(200).json({ success: true, message: 'Trip completed', data: { delivery } });
});

/**
 * @desc    Reconcile rider cash
 * @route   POST /api/deliveries/:id/settle-cod
 */
exports.settleCod = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.settleCod(tenantId, req.params.id, req.body, req.user?._id);
  res.status(200).json({ success: true, message: 'Cash settled', data: { delivery } });
});

/**
 * @desc    Cancel an undispatched trip
 * @route   POST /api/deliveries/:id/cancel
 */
exports.cancelDelivery = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const delivery = await deliveryService.cancelDelivery(tenantId, req.params.id, req.body?.reason);
  res.status(200).json({ success: true, message: 'Trip cancelled', data: { delivery } });
});

function round1(value) {
  return value === null || value === undefined ? null : Math.round(value * 10) / 10;
}

function toObjectId(id) {
  const mongoose = require('mongoose');
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}
