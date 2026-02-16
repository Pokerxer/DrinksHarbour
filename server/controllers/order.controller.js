// controllers/order.controller.js

const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Tenant = require('../models/tenant');
const asyncHandler = require('../utils/asyncHandler');
const { generateOrderNumber } = require('../utils/orderUtils');
const {
  sendOrderConfirmationToCustomer,
  sendNewOrderNotificationToTenant,
  sendNewOrderNotificationToAdmin,
} = require('../services/email.service');

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

  await order.save();

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

  // Send email notifications (don't wait for completion)
  (async () => {
    try {
      // 1. Send order confirmation to customer
      await sendOrderConfirmationToCustomer(order, customer);
      console.log('✅ Order confirmation email sent to customer');

      // 2. Send notifications to tenants
      const tenantIds = [...new Set(items.map(item => item.tenantId).filter(Boolean))];
      for (const tenantId of tenantIds) {
        try {
          const tenant = await Tenant.findById(tenantId);
          if (tenant && tenant.email) {
            await sendNewOrderNotificationToTenant(order, tenant, customer);
            console.log(`✅ Order notification sent to tenant: ${tenant.name}`);
          }
        } catch (tenantError) {
          console.error(`❌ Failed to send email to tenant ${tenantId}:`, tenantError.message);
        }
      }

      // 3. Send notification to admin
      await sendNewOrderNotificationToAdmin(order, customer);
      console.log('✅ Order notification sent to admin');
    } catch (emailError) {
      console.error('❌ Error sending order emails:', emailError.message);
      // Don't throw - we don't want to fail the order if emails fail
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
    .populate('items.tenant', 'name');

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

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order },
  });
});

module.exports = exports;
