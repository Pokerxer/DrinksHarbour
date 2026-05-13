// controllers/order.controller.js

const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const asyncHandler = require('../utils/asyncHandler');
const { generateOrderNumber } = require('../utils/orderUtils');
const { calcPlatformCostPrice, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
const inventoryService = require('../services/inventory.service');
const {
  sendOrderConfirmationToCustomer,
  sendNewOrderNotificationToTenant,
  sendNewOrderNotificationToAdmin,
} = require('../services/email.service');

const {
  sendOrderConfirmationSMS,
  sendOrderStatusSMS,
} = require('../services/sms.service');

const {
  sendOrderConfirmationWhatsApp,
  sendOrderStatusWhatsApp,
  sendNewOrderAlertWhatsApp,
} = require('../services/whatsapp.service');


/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private/Public (Guest checkout supported)
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const { customer, shipping, paymentMethod, paymentDetails, items, subtotal, shippingFee, shippingInfo, total, couponCode, ageVerified, status, paymentStatus } = req.body;

  let appliedCoupon = null;
  let discountTotal = 0;

  if (couponCode) {
    appliedCoupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (!appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon code',
      });
    }
    if (appliedCoupon.expiryDate && new Date() > appliedCoupon.expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired',
      });
    }
    discountTotal = appliedCoupon.discountType === 'percentage'
      ? subtotal * (appliedCoupon.discountValue / 100)
      : appliedCoupon.discountValue;

    appliedCoupon.usedCount += 1;
    await appliedCoupon.save();
  }

  const userId = req.user?._id || null;

  let user = null;
  if (userId) {
    user = await User.findById(userId);
  }

  const orderNumber = await generateOrderNumber();

  // Fetch tenant information for proper revenue calculation
  const tenantIds = [...new Set(items.map(item => item.tenantId).filter(Boolean))];
  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select('_id name revenueModel markupPercentage commissionPercentage platformMarkupPercentage')
    .lean();
  const tenantMap = new Map(tenants.map(t => [t._id.toString(), t]));

  // Bulk-fetch SubProducts and Sizes to get actual cost data
  const subProductIds = [...new Set(items.map(i => i.subProductId).filter(Boolean))];
  const sizeIds       = [...new Set(items.map(i => i.sizeId).filter(Boolean))];

  const [subProducts, sizes] = await Promise.all([
    subProductIds.length
      ? SubProduct.find({ _id: { $in: subProductIds } })
          .select('_id costPrice baseSellingPrice')
          .lean()
      : Promise.resolve([]),
    sizeIds.length
      ? Size.find({ _id: { $in: sizeIds } })
          .select('_id costPrice sellingPrice')
          .lean()
      : Promise.resolve([]),
  ]);

  const subProductMap = new Map(subProducts.map(sp => [sp._id.toString(), sp]));
  const sizeMap       = new Map(sizes.map(s  => [s._id.toString(),  s]));

  // ── Build orderItems ─────────────────────────────────────────────────────
  //
  // Mirrors the server-side pricing pipeline in utils/pricing.js:
  //   Markup model     → platformCostPrice = costPrice × (1 + tenant.markupPercentage%)
  //   Commission model → platformCostPrice = subProduct.baseSellingPrice × (1 − tenant.commissionPercentage%)
  //
  // platformCostPrice = vendorPayout (what platform owes vendor)
  // platformProfit    = itemSubtotal − vendorPayout × qty
  //
  // costPrice/sellingPrice use Size values when present, falling back to SubProduct.
  // Fallback when no cost data: vendorPayout = customerPrice ÷ (1 + DEFAULT_PLATFORM_MARKUP%)
  const orderItems = items.map(item => {
    const tenant        = tenantMap.get(item.tenantId?.toString());
    const sp            = subProductMap.get(item.subProductId?.toString());
    const sz            = sizeMap.get(item.sizeId?.toString());
    const revenueModel  = tenant?.revenueModel ?? 'markup';
    const markupPct     = tenant?.markupPercentage     ?? 25;
    const commissionPct = tenant?.commissionPercentage ?? 12;

    const customerPrice = item.price;  // platform selling price per unit
    const qty           = item.quantity;
    const itemSubtotal  = customerPrice * qty;

    // Size-level values take priority; fall back to SubProduct
    const costPrice         = sz?.costPrice      ?? sp?.costPrice      ?? 0;
    const tenantSellingPrice= sz?.sellingPrice   ?? sp?.baseSellingPrice ?? 0;

    // Use the same calcPlatformCostPrice function used when products are priced
    let vendorCostPerUnit = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, markupPct, commissionPct);

    // Fallback: if no cost data was available (costPrice=0 for markup, tenantSellingPrice=0 for commission)
    if (!vendorCostPerUnit || vendorCostPerUnit <= 0) {
      vendorCostPerUnit = customerPrice / (1 + DEFAULT_PLATFORM_MARKUP / 100);
    }

    const vendorPayout   = vendorCostPerUnit * qty;
    const platformProfit = itemSubtotal - vendorPayout;

    return {
      product:               item.productId,
      subproduct:            item.subProductId || null,
      size:                  item.sizeId || null,
      tenant:                item.tenantId || null,
      quantity:              qty,
      priceAtPurchase:       customerPrice,
      itemSubtotal:          Math.round(itemSubtotal     * 100) / 100,
      discountAmount:        0,
      vendorPriceAtPurchase: Math.round(vendorCostPerUnit * 100) / 100,
      tenantRevenueShare:    Math.round(vendorPayout      * 100) / 100,
      platformCommission:    Math.round(platformProfit    * 100) / 100,
      tenantRevenueModel:    revenueModel,
      revenueRateAtPurchase: revenueModel === 'commission' ? commissionPct : markupPct,
    };
  });

   // Calculate order totals from items
  const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.itemSubtotal, 0);
  const calculatedPlatformCommission = orderItems.reduce((sum, item) => sum + (item.platformCommission || 0), 0);

  // Build order object with payment details if provided
  const orderData = {
    orderNumber,
    user: userId,
    items: orderItems,
    subtotal: calculatedSubtotal,
    discountTotal,
    coupon: appliedCoupon?._id || null,
    shippingFee,
    taxAmount: 0,
    totalAmount: total,
    currency: 'NGN',
    paymentMethod,
    paymentStatus: paymentStatus || (paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending'),
    shippingAddress: {
      fullName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      phone: customer.phone,
      addressLine1: shipping.address,
      city: shipping.city,
      state: shipping.state,
      country: shipping.country,
      postalCode: shipping.zipCode,
      coordinates: shipping.coordinates || undefined,
    },
    shippingInfo: shippingInfo || null,
    shippingMethod: 'standard',
    fulfillmentStatus: new Map(),
    ageVerifiedAtOrderTime: ageVerified || false,
    status: status || 'pending',
    platformCommissionTotal: calculatedPlatformCommission,
  };

  // Add payment details if provided (for orders created after payment)
  if (paymentDetails) {
    orderData.paymentDetails = paymentDetails;
    if (paymentDetails.transactionId) {
      orderData.paymentIntentId = paymentDetails.transactionId;
      // Also store in the dedicated Stripe field for webhook lookups
      if (paymentDetails.method === 'stripe') {
        orderData.stripePaymentIntentId = paymentDetails.transactionId;
      }
    }
    if (paymentDetails.reference) {
      orderData.paymentReference = paymentDetails.reference;
    }
    if (paymentDetails.paidAt) {
      orderData.paidAt = new Date(paymentDetails.paidAt);
    }
  }

  // ── Reserve stock (availableStock--, reservedStock++) ─────────────────────
  // Must happen before order save so a failed reserve aborts the whole request.
  const stockItems = orderItems.filter(i => i.subproduct);
  if (stockItems.length) {
    const { success, failedItem } = await inventoryService.reserve(stockItems, null, userId);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: `"${failedItem?.product || 'An item'}" is out of stock or has insufficient quantity`,
      });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const order = new Order(orderData);

  try {
    await order.save();
  } catch (saveErr) {
    // Order save failed — release the reservation we just made
    if (stockItems.length) {
      await inventoryService.releaseReserve(stockItems, null, userId).catch(() => {});
    }
    throw saveErr;
  }

  // Populate order items for email notifications
  await order.populate([
    { path: 'items.product', select: 'name slug images' },
    { path: 'items.subproduct', select: 'name sku images' },
    { path: 'items.size', select: 'name' },
    { path: 'items.tenant', select: 'name' },
  ]);

  // Log vendor earnings breakdown for debugging
  console.log('\n💰 Order Revenue Breakdown:');
  console.log(`   Order:            ${order.orderNumber}`);
  console.log(`   Customer paid:    ₦${order.totalAmount.toLocaleString()}`);
  console.log(`   Platform profit:  ₦${calculatedPlatformCommission.toLocaleString()}`);

  const tenantBreakdown = {};
  order.items.forEach(item => {
    const tid = item.tenant?.toString() || 'no-tenant';
    if (!tenantBreakdown[tid]) tenantBreakdown[tid] = { qty: 0, revenue: 0, vendorPayout: 0, model: item.tenantRevenueModel };
    tenantBreakdown[tid].qty          += item.quantity;
    tenantBreakdown[tid].revenue      += item.itemSubtotal;
    tenantBreakdown[tid].vendorPayout += item.tenantRevenueShare;
  });

  Object.entries(tenantBreakdown).forEach(([tid, d]) => {
    const t = tenantMap.get(tid);
    console.log(`   ${t?.name || 'Unknown'} [${d.model}]:`);
    console.log(`     qty: ${d.qty} | customer: ₦${d.revenue.toLocaleString()} | vendor payout: ₦${d.vendorPayout.toLocaleString()} | platform: ₦${(d.revenue - d.vendorPayout).toLocaleString()}`);
  });
  console.log('');

  // User order history is tracked via the order collection (user field)
  // No need to maintain a separate array in User model

  // ── Fire-and-forget: email + SMS + WhatsApp (never blocks the order response) ──
  (async () => {
    try {
      // 1. Customer — email + SMS + WhatsApp (in parallel)
      await Promise.allSettled([
        sendOrderConfirmationToCustomer(order, customer)
          .then(() => console.log('✅ Order confirmation email → customer'))
          .catch(e  => console.error('❌ Email to customer failed:', e.message)),

        sendOrderConfirmationSMS(order, customer)
          .then(r  => r?.success && console.log('✅ Order confirmation SMS → customer'))
          .catch(e  => console.error('❌ SMS to customer failed:', e.message)),

        sendOrderConfirmationWhatsApp(order, customer)
          .then(r  => r?.success && console.log('✅ Order confirmation WhatsApp → customer'))
          .catch(e  => console.error('❌ WhatsApp to customer failed:', e.message)),
      ]);

      // 2. Tenants — email + WhatsApp alert
      const tenantIds = [...new Set(items.map(item => item.tenantId).filter(Boolean))];
      for (const tenantId of tenantIds) {
        try {
          const tenant = await Tenant.findById(tenantId);
          if (!tenant) continue;

          await Promise.allSettled([
            tenant.email
              ? sendNewOrderNotificationToTenant(order, tenant, customer)
                  .then(() => console.log(`✅ Order email → tenant: ${tenant.name}`))
                  .catch(e  => console.error(`❌ Email to tenant ${tenant.name} failed:`, e.message))
              : Promise.resolve(),

            (tenant.phone || tenant.whatsapp)
              ? sendNewOrderAlertWhatsApp(order, tenant)
                  .then(r => r?.success && console.log(`✅ Order WhatsApp → tenant: ${tenant.name}`))
                  .catch(e => console.error(`❌ WhatsApp to tenant ${tenant.name} failed:`, e.message))
              : Promise.resolve(),
          ]);
        } catch (tenantError) {
          console.error(`❌ Notifications to tenant ${tenantId} failed:`, tenantError.message);
        }
      }

      // 3. Admin — email only
      await sendNewOrderNotificationToAdmin(order, customer)
        .then(() => console.log('✅ Order notification email → admin'))
        .catch(e  => console.error('❌ Email to admin failed:', e.message));

    } catch (err) {
      console.error('❌ Unexpected error in order notification block:', err.message);
    }
  })();

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: {
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        shippingFee: order.shippingFee,
        totalAmount: order.totalAmount,
        placedAt: order.placedAt,
        coupon: order.coupon,
      },
    },
  });
});

/**
 * @desc    Get all orders (admin)
 * @route   GET /api/orders
 * @access  Private (admin/super_admin)
 */
exports.getAllOrders = asyncHandler(async (req, res) => {
  const {
    page     = '1',
    limit    = '20',
    search   = '',
    status   = '',
    payment  = '',
    from,
    to,
    sort     = 'placedAt',
    order: sortDir = 'desc',
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const skip     = (pageNum - 1) * pageSize;

  const filter = {};

  if (status)  filter.status        = status;
  if (payment) filter.paymentStatus = payment;

  if (from || to) {
    filter.placedAt = {};
    if (from) filter.placedAt.$gte = new Date(from);
    if (to)   filter.placedAt.$lte = new Date(to);
  }

  if (search.trim()) {
    const re = new RegExp(search.trim(), 'i');
    filter.$or = [
      { orderNumber:                re },
      { 'customer.firstName':       re },
      { 'customer.lastName':        re },
      { 'customer.email':           re },
      { 'shippingAddress.fullName': re },
    ];
  }

  const sortObj = { [sort === 'total' ? 'totalAmount' : sort === 'status' ? 'status' : 'placedAt']: sortDir === 'asc' ? 1 : -1 };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(pageSize)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .populate('items.tenant', 'name')
      .lean(),
    Order.countDocuments(filter),
  ]);

  // Status summary counts
  const [statusCounts] = await Promise.all([
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = { all: total, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0 };
  statusCounts.forEach(({ _id, count }) => {
    if (_id in counts) counts[_id] = count;
  });

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
      counts,
    },
  });
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private/Public (with verification)
 */
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('items.product', 'name slug images')
    .populate('items.subproduct', 'name sku images')
    .populate('items.size', 'name')
    .populate('items.tenant', 'name')
    .populate('coupon', 'code discountType discountValue');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  let canAccess = false;

  if (req.user) {
    // Logged-in user: check if they own the order or are admin
    canAccess = order.user?.toString() === req.user._id.toString() ||
      ['admin', 'super_admin'].includes(req.user.role);
  } else {
    // Guest user: require email verification
    const { email } = req.query;
    if (!email) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required for guest access',
      });
    }
    canAccess = order.shippingAddress?.email?.toLowerCase() === email.toLowerCase() ||
      order.customer?.email?.toLowerCase() === email.toLowerCase();
  }

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this order',
    });
  }

  res.status(200).json({
    success: true,
    data: { order },
  });
});

/**
 * @desc    Get order by order number
 * @route   GET /api/orders/number/:orderNumber
 * @access  Public (with email verification)
 */
exports.getOrderByNumber = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const { email } = req.query;

  const order = await Order.findOne({ orderNumber })
    .populate('items.product', 'name slug images')
    .populate('items.subproduct', 'name sku images')
    .populate('items.size', 'name')
    .populate('items.tenant', 'name');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  res.status(200).json({
    success: true,
    data: { order },
  });
});

/**
 * @desc    Get user's orders
 * @route   GET /api/orders/my-orders
 * @access  Private
 */
 exports.getMyOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get user email for guest order lookup
  const userEmail = req.user?.email?.toLowerCase();

  // Find orders where:
  // 1. User is logged in (user field matches)
  // 2. OR shipping email matches user's email (guest orders)
  const query = {
    $or: [
      { user: req.user._id },
      { 'shippingAddress.email': userEmail }
    ]
  };

  const orders = await Order.find(query)
    .sort({ placedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('items.product', 'name slug images')
    .select('orderNumber status paymentStatus totalAmount subtotal shippingFee placedAt items');

  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * @desc    Cancel order
 * @route   POST /api/orders/:id/cancel
 * @access  Private
 */
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.user?.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this order',
    });
  }

  if (!['pending', 'processing'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: 'Order cannot be cancelled at this stage',
    });
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelReason = req.body.reason || 'Cancelled by customer';

  await order.save();

  // Release reservation (pre-ship) or restore physical stock (post-ship)
  const stockItems = order.items.filter(i => i.subproduct);
  if (stockItems.length) {
    if (inventoryService.isShipped(previousStatus)) {
      // Item physically left the warehouse — restore both availableStock and totalStock
      await inventoryService.restoreStock(stockItems, order._id, req.user?._id).catch(() => {});
    } else {
      // Item never shipped — just release the reservation
      await inventoryService.releaseReserve(stockItems, order._id, req.user?._id).catch(() => {});
    }
  }

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order },
  });

  // Notify customer about cancellation (fire-and-forget)
  const cancelCustomer = order.customer || (order.user ? await User.findById(order.user).lean().catch(() => null) : null);
  if (cancelCustomer) {
    (async () => {
      await Promise.allSettled([
        sendOrderStatusSMS(order, cancelCustomer, 'cancelled').catch(() => {}),
        sendOrderStatusWhatsApp(order, cancelCustomer, 'cancelled').catch(() => {}),
      ]);
    })();
  }
});

/**
 * @desc    Update order status (admin/vendor)
 * @route   PUT /api/orders/:id/status
 * @access  Private (admin or tenant)
 */
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const previousStatus = order.status;
  order.status = status;

  const now = new Date();
  if (status === 'confirmed'  && !order.confirmedAt)  order.confirmedAt  = now;
  if (status === 'processing' && !order.processingAt) order.processingAt = now;
  if (status === 'shipped'    && !order.shippedAt)    order.shippedAt    = now;
  if (status === 'delivered'  && !order.deliveredAt)  order.deliveredAt  = now;
  if (status === 'cancelled') {
    order.cancelledAt  = now;
    order.cancelReason = req.body.reason || 'Cancelled by admin';
  }

  await order.save();

  // ── Inventory adjustments on status change ───────────────────────────────
  const stockItems = order.items.filter(i => i.subproduct);
  if (stockItems.length) {
    if (status === 'shipped' && previousStatus !== 'shipped') {
      // Item is leaving the warehouse: decrement totalStock + reservedStock
      inventoryService.commitShipment(stockItems, order._id, req.user?._id).catch(() => {});
    } else if (status === 'cancelled' && previousStatus !== 'cancelled') {
      if (inventoryService.isShipped(previousStatus)) {
        // Already shipped: restore physical stock (item returned)
        inventoryService.restoreStock(stockItems, order._id, req.user?._id).catch(() => {});
      } else {
        // Not yet shipped: release reservation only
        inventoryService.releaseReserve(stockItems, order._id, req.user?._id).catch(() => {});
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    data: { order },
  });

  // Notify customer via SMS + WhatsApp (fire-and-forget)
  if (previousStatus !== status) {
    const customer = order.customer || (order.user ? await User.findById(order.user).lean().catch(() => null) : null);
    if (customer) {
      (async () => {
        await Promise.allSettled([
          sendOrderStatusSMS(order, customer, status).catch(() => {}),
          sendOrderStatusWhatsApp(order, customer, status).catch(() => {}),
        ]);
        console.log(`✅ Status update notifications sent: ${previousStatus} → ${status}`);
      })();
    }
  }
});

/**
 * @desc    Admin: update payment status for an order
 * @route   PUT /api/orders/:id/payment
 * @access  Private (admin)
 */
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { action, reference, notes, amount } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const now = new Date();

  switch (action) {
    case 'mark_paid': {
      order.paymentStatus = 'paid';
      order.paidAt = now;
      if (reference) order.paymentReference = reference;
      order.paymentDetails = {
        ...(order.paymentDetails || {}),
        method: order.paymentMethod,
        paidAt: now,
        ...(reference ? { reference } : {}),
        ...(notes    ? { notes }     : {}),
        markedPaidBy: req.user._id,
      };
      // Auto-advance COD/bank_transfer orders that are still pending
      if (['cash_on_delivery', 'bank_transfer', 'mobile_money'].includes(order.paymentMethod)) {
        if (order.status === 'pending') {
          order.status = 'confirmed';
          order.confirmedAt = now;
        }
      }
      break;
    }

    case 'mark_failed': {
      order.paymentStatus = 'failed';
      if (notes) {
        order.paymentDetails = { ...(order.paymentDetails || {}), failureReason: notes };
      }
      break;
    }

    case 'mark_refunded': {
      order.paymentStatus = amount && amount < order.totalAmount ? 'partially_refunded' : 'refunded';
      order.status = 'refunded';
      order.refundDetails = {
        amount: amount || order.totalAmount,
        reason: notes || 'Refunded by admin',
        createdAt: now,
        processedBy: req.user._id,
      };
      break;
    }

    default:
      return res.status(400).json({ success: false, message: 'Invalid action. Use: mark_paid, mark_failed, mark_refunded' });
  }

  await order.save();

  // ── Inventory adjustments for payment actions ────────────────────────────
  const stockItems = order.items.filter(i => i.subproduct);
  if (stockItems.length) {
    if (action === 'mark_failed') {
      // Payment failed: release the stock reservation (order won't be fulfilled)
      inventoryService.releaseReserve(stockItems, order._id, req.user?._id).catch(() => {});
    } else if (action === 'mark_refunded') {
      // Refund: restore physical stock (item returned to warehouse)
      inventoryService.restoreStock(stockItems, order._id, req.user?._id).catch(() => {});
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  res.json({
    success: true,
    message: 'Payment updated successfully',
    data: { order },
  });
});

module.exports = exports;
