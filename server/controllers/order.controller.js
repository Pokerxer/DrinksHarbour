// controllers/order.controller.js

const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const InventoryMovement = require('../models/InventoryMovement');
const asyncHandler = require('../utils/asyncHandler');
const { generateOrderNumber } = require('../utils/orderUtils');
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
 * Atomically decrement stock for a single item.
 * Returns the updated SubProduct document, or null if insufficient stock.
 */
async function decrementStock(subProductId, sizeId, quantity, session) {
  const opts = session ? { session, new: true } : { new: true };

  const updated = await SubProduct.findOneAndUpdate(
    {
      _id: subProductId,
      $or: [
        { availableStock: { $gte: quantity } },
        // fallback for items where availableStock was never initialised
        { availableStock: { $exists: false }, totalStock: { $gte: quantity } },
      ],
    },
    { $inc: { availableStock: -quantity, totalStock: -quantity } },
    opts
  );

  if (!updated) return null;

  // updated already reflects the post-decrement values (new: true)
  // Update stockStatus accordingly (best-effort, non-blocking)
  const newAvailable = updated.availableStock ?? updated.totalStock ?? 0;
  const threshold = updated.lowStockThreshold || 10;
  const newStatus =
    newAvailable <= 0
      ? 'out_of_stock'
      : newAvailable <= threshold
      ? 'low_stock'
      : 'in_stock';
  SubProduct.findByIdAndUpdate(subProductId, { stockStatus: newStatus }).catch(() => {});

  // Decrement size-level stock if a size is linked
  if (sizeId) {
    Size.findOneAndUpdate(
      { _id: sizeId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity, availableStock: -quantity } },
      session ? { session } : {}
    ).catch(() => {});
  }

  return updated;
}

/**
 * Roll back all stock decrements that succeeded before a failure.
 */
async function rollbackStockDecrements(decrements) {
  await Promise.all(
    decrements.map(({ subProductId, sizeId, quantity }) =>
      Promise.all([
        SubProduct.findByIdAndUpdate(subProductId, {
          $inc: { availableStock: quantity, totalStock: quantity },
        }).catch(() => {}),
        sizeId
          ? Size.findByIdAndUpdate(sizeId, {
              $inc: { stock: quantity, availableStock: quantity },
            }).catch(() => {})
          : Promise.resolve(),
      ])
    )
  );
}

/**
 * Record InventoryMovement documents for audit (fire-and-forget).
 * Does NOT touch stock quantities — stock was already updated atomically.
 */
function recordInventoryMovements(orderItems, orderId, type, quantityMultiplier = 1) {
  setImmediate(async () => {
    for (const item of orderItems) {
      if (!item.subproduct || !item.tenant) continue;
      try {
        await InventoryMovement.create({
          subProduct: item.subproduct,
          tenant: item.tenant,
          product: item.product,
          size: item.size || undefined,
          type,
          category: type === 'return' ? 'in' : 'out',
          quantity: item.quantity * quantityMultiplier,
          quantityBefore: 0, // approximation — exact value not tracked here
          quantityAfter: 0,
          relatedOrder: orderId,
          sellingPrice: item.priceAtPurchase,
          referenceType: 'order',
          source: 'order',
          performedAt: new Date(),
          status: 'confirmed',
          isVerified: true,
          verifiedAt: new Date(),
        });
      } catch (err) {
        console.error(`[Inventory] Failed to record movement for subproduct ${item.subproduct}:`, err.message);
      }
    }
  });
}

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private/Public (Guest checkout supported)
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const { customer, shipping, paymentMethod, paymentDetails, items, subtotal, shippingFee, total, couponCode, ageVerified, status, paymentStatus } = req.body;

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
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('_id name revenueModel markupPercentage commissionPercentage').lean();
  const tenantMap = new Map(tenants.map(t => [t._id.toString(), t]));

  // ─── STOCK VALIDATION & ATOMIC DECREMENT ─────────────────────────────────
  // Decrement stock for each item that has a subProductId, one at a time so
  // we can cleanly roll back on the first insufficiency.
  const itemsRequiringStock = items.filter(item => item.subProductId);
  const successfulDecrements = [];

  for (const item of itemsRequiringStock) {
    const updated = await decrementStock(
      item.subProductId,
      item.sizeId || null,
      item.quantity,
      null // no session needed — atomic findOneAndUpdate is safe on standalone
    );

    if (!updated) {
      // Roll back all decrements that already succeeded
      await rollbackStockDecrements(successfulDecrements);
      return res.status(400).json({
        success: false,
        message: 'One or more items are out of stock or do not have sufficient quantity',
      });
    }

    successfulDecrements.push({
      subProductId: item.subProductId,
      sizeId: item.sizeId || null,
      quantity: item.quantity,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const orderItems = items.map(item => {
    const tenant = tenantMap.get(item.tenantId?.toString());
    const customerPrice = item.price; // This is the website price (platform price)

    // Calculate revenue share based on new pricing model
    // Formula: tenantPrice = customerPrice / (1 + platformMarkupPercentage/100)
    // platformCommission = customerPrice - tenantPrice
    const platformMarkupPercentage = 15; // Platform markup percentage
    const platformMultiplier = 1 + (platformMarkupPercentage / 100);
    const tenantRevenueShare = customerPrice / platformMultiplier;
    const platformCommission = customerPrice - tenantRevenueShare;

    return {
      product: item.productId,
      subproduct: item.subProductId || null,
      size: item.sizeId || null,
      tenant: item.tenantId || null,
      quantity: item.quantity,
      priceAtPurchase: customerPrice,
      itemSubtotal: customerPrice * item.quantity,
      discountAmount: 0,
      tenantRevenueShare: Math.round(tenantRevenueShare * 100) / 100,
      platformCommission: Math.round(platformCommission * 100) / 100,
      // Store revenue model info for reporting
      tenantRevenueModel: 'platform_markup',
      tenantCommissionPercentage: 0,
      tenantMarkupPercentage: tenant?.markupPercentage || 20,
      platformMarkupPercentage: platformMarkupPercentage,
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
    }
    if (paymentDetails.reference) {
      orderData.paymentReference = paymentDetails.reference;
    }
    if (paymentDetails.paidAt) {
      orderData.paidAt = new Date(paymentDetails.paidAt);
    }
  }

  const order = new Order(orderData);

  try {
    await order.save();
  } catch (saveErr) {
    // Order save failed — restore all stock that was decremented
    await rollbackStockDecrements(successfulDecrements);
    throw saveErr;
  }

  // Audit trail — create InventoryMovement records (fire-and-forget, does not affect stock)
  recordInventoryMovements(order.items, order._id, 'sold');

  // Populate order items for email notifications
  await order.populate([
    { path: 'items.product', select: 'name slug images' },
    { path: 'items.subproduct', select: 'name sku images' },
    { path: 'items.size', select: 'name' },
    { path: 'items.tenant', select: 'name' },
  ]);

   // Log vendor earnings breakdown for debugging
  console.log('\n💰 Order Revenue Breakdown:');
  console.log(`   Order: ${order.orderNumber}`);
  console.log(`   Total Customer Paid: ₦${order.totalAmount.toLocaleString()}`);
  console.log(`   Platform Commission: ₦${calculatedPlatformCommission.toLocaleString()}`);
  
  // Group by tenant
  const tenantBreakdown = {};
  order.items.forEach(item => {
    const tenantId = item.tenant?.toString() || 'no-tenant';
    if (!tenantBreakdown[tenantId]) {
      tenantBreakdown[tenantId] = {
        items: 0,
        customerTotal: 0,
        vendorEarnings: 0,
      };
    }
    tenantBreakdown[tenantId].items += item.quantity;
    tenantBreakdown[tenantId].customerTotal += item.itemSubtotal;
    tenantBreakdown[tenantId].vendorEarnings += item.tenantRevenueShare;
  });
  
  Object.entries(tenantBreakdown).forEach(([tenantId, data]) => {
    const tenant = tenantMap.get(tenantId);
    console.log(`   ${tenant?.name || 'Unknown'}:`);
    console.log(`     - Items: ${data.items}`);
    console.log(`     - Customer Paid: ₦${data.customerTotal.toLocaleString()}`);
    console.log(`     - Vendor Earnings: ₦${data.vendorEarnings.toLocaleString()}`);
    console.log(`     - Model: ${tenant?.revenueModel || 'markup'}`);
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

  // Restore stock for all items that had a subproduct
  const restoreDecrements = order.items
    .filter(item => item.subproduct)
    .map(item => ({
      subProductId: item.subproduct,
      sizeId: item.size || null,
      quantity: item.quantity,
    }));

  if (restoreDecrements.length > 0) {
    // Increment stock back (inverse of the decrement on order creation)
    await Promise.all(
      restoreDecrements.map(({ subProductId, sizeId, quantity }) =>
        Promise.all([
          SubProduct.findByIdAndUpdate(subProductId, {
            $inc: { availableStock: quantity, totalStock: quantity },
          }).then(updated => {
            if (updated) {
              const newAvailable = (updated.availableStock || 0) + quantity;
              const threshold = updated.lowStockThreshold || 10;
              const newStatus =
                newAvailable <= 0
                  ? 'out_of_stock'
                  : newAvailable <= threshold
                  ? 'low_stock'
                  : 'in_stock';
              return SubProduct.findByIdAndUpdate(subProductId, { stockStatus: newStatus });
            }
          }).catch(() => {}),
          sizeId
            ? Size.findByIdAndUpdate(sizeId, {
                $inc: { stock: quantity, availableStock: quantity },
              }).catch(() => {})
            : Promise.resolve(),
        ])
      )
    );

    // Audit trail for stock restoration
    recordInventoryMovements(order.items, order._id, 'return');
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

  if (status === 'delivered') order.deliveredAt   = new Date();
  if (status === 'shipped')   order.shippedAt     = new Date();
  if (status === 'cancelled') {
    order.cancelledAt  = new Date();
    order.cancelReason = req.body.reason || 'Cancelled by admin';
  }

  await order.save();

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

module.exports = exports;
