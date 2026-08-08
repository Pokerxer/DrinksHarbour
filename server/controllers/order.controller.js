// controllers/order.controller.js

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Size = require('../models/Size');
const asyncHandler = require('../utils/asyncHandler');
const { generateOrderNumber, resolveOrderRecipient } = require('../utils/orderUtils');
const { calcPlatformCostPrice, resolveRevenueRates, resolveLineRates, resolveEffectiveUnitPrice, calculateSizePricing, roundUpTo100, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
const inventoryService = require('../services/inventory.service');
const { applyOrderStatus, APPLICABLE_STATUSES } = require('../services/orderStatus.service');
const { getTenantId, normalizeTenantId } = require('../utils/tenantContext');
const { calculateShipping, DISTANCE_MIN_FEE } = require('../data/shipping-zones');
const { resolveFirstOrderPerk, recordPerkUsage } = require('../services/firstOrderPerk.service');
const { normalizePaymentMethod, buildOrderPaymentFields } = require('../utils/paymentMethods');
const { resolveGatewayPaymentMethod } = require('../services/payment.service');
const { ForbiddenError } = require('../utils/errors');
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

const { mutatePlatformLoyalty } = require('../services/platformLoyalty.service');
const { earnMultiplierForTier, pointsForSpend } = require('../services/platformLoyalty.helpers');

const LOYALTY_POINTS_PER_NGN = 1 / 100; // 1 pt per ₦100 base rate

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private/Public (Guest checkout supported)
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const { customer, shipping, paymentMethod, paymentDetails, items, subtotal, shippingFee, shippingInfo, total, couponCode, ageVerified, status, paymentStatus, utmSource, utmMedium, utmCampaign } = req.body;

  // Fold accepted aliases ('bank', 'cod', …) into a storable enum value. The
  // route validator has already rejected anything unrecognisable, so a null here
  // would only come from a caller that bypassed it.
  const canonicalPaymentMethod = normalizePaymentMethod(paymentMethod);
  if (!canonicalPaymentMethod) {
    return res.status(400).json({ success: false, message: 'Invalid payment method' });
  }

  // For hosted-gateway payments the browser only knows which button was pressed
  // before hand-off — Korapay's checkout offers card, bank transfer and USSD
  // behind one button — so ask the gateway what actually settled.
  const resolvedPaymentMethod = await resolveGatewayPaymentMethod(canonicalPaymentMethod, paymentDetails);

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

  // Bulk-fetch SubProducts and Sizes to get actual cost data
  // IMPORTANT: tenantId is derived from SubProduct.tenant (server-authoritative),
  // never trusted from client-supplied item.tenantId.
  const subProductIds = [...new Set(items.map(i => i.subProductId).filter(Boolean))];
  const sizeIds       = [...new Set(items.map(i => i.sizeId).filter(Boolean))];

  const [subProducts, sizes] = await Promise.all([
    subProductIds.length
      ? SubProduct.find({ _id: { $in: subProductIds }, isPublished: true, status: 'active' })
          .select('_id costPrice baseSellingPrice tenant product isOnSale saleDiscountValue saleType saleStartDate saleEndDate')
          .lean()
      : Promise.resolve([]),
    sizeIds.length
      ? Size.find({ _id: { $in: sizeIds } })
          .select('_id costPrice sellingPrice tenant unitsPerPack maxOrderQuantity platformMarkupOverridePct discountValue discountType discountStart discountEnd')
          .lean()
      : Promise.resolve([]),
  ]);

  const subProductMap = new Map(subProducts.map(sp => [sp._id.toString(), sp]));
  const sizeMap       = new Map(sizes.map(s  => [s._id.toString(),  s]));

  // Validate: every item's subProductId must resolve to a published, active SubProduct
  const invalidItems = items.filter(item => {
    if (!item.subProductId) return false;
    return !subProductMap.has(item.subProductId.toString());
  });
  if (invalidItems.length) {
    return res.status(400).json({
      success: false,
      message: 'One or more items are unavailable or no longer in stock',
    });
  }

  // Build tenant map from the SubProducts' actual tenant field (server-authoritative)
  const resolvedTenantIds = [...new Set(
    subProducts.map(sp => sp.tenant?.toString()).filter(Boolean)
  )];
  const tenants = await Tenant.find({ _id: { $in: resolvedTenantIds } })
    .select('_id name revenueModel markupPercentage commissionPercentage platformMarkupPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits')
    .lean();
  const tenantMap = new Map(tenants.map(t => [t._id.toString(), t]));

  // Product docs are needed to recompute the authoritative platform price
  const orderProductIds = [...new Set(subProducts.map(sp => sp.product?.toString()).filter(Boolean))];
  const orderProducts = orderProductIds.length
    ? await Product.find({ _id: { $in: orderProductIds } }).select('_id platformMarkup platformDiscount').lean()
    : [];
  const productMap = new Map(orderProducts.map(p => [p._id.toString(), p]));

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
    const sp            = subProductMap.get(item.subProductId?.toString());
    const sz            = sizeMap.get(item.sizeId?.toString());
    // Derive tenant from the SubProduct (server-authoritative), NOT from client body
    const tenantId      = sp?.tenant?.toString() || item.tenantId || null;
    const tenant        = tenantMap.get(tenantId);
    const revenueModel  = tenant?.revenueModel ?? 'markup';
    const qty = item.quantity;
    // Server-authoritative unit price — same authority as cart validateCartItems
    // (calculateSizePricing), plus the SubProduct sale discount the product page applies.
    const productDoc = productMap.get(sp?.product?.toString());
    const sizePricing = (sz && tenant)
      ? calculateSizePricing(sz, productDoc, tenant, sp?.costPrice ?? 0, sp?.baseSellingPrice ?? 0)
      : null;
    // Pack pricing applies only when the size actually publishes a cheaper pack
    // price AND the line quantity reached the threshold — payout rates and the
    // packRateApplied flag must track the price the customer actually pays.
    const packApplied = sizePricing?.packUnitPrice != null &&
      sizePricing?.packThreshold != null && qty >= sizePricing.packThreshold;
    const { markupPct, commissionPct } = packApplied
      ? resolveLineRates(tenant, sz, qty)
      : resolveRevenueRates(tenant, 1);

    let serverUnitPrice = 0;
    if (sizePricing) {
      serverUnitPrice = resolveEffectiveUnitPrice(sizePricing, qty);
      if (serverUnitPrice > 0 && sp) {
        const now = new Date();
        const saleStart = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
        const saleEnd   = sp.saleEndDate   ? new Date(sp.saleEndDate)   : null;
        const saleActive = sp.isOnSale && (sp.saleDiscountValue ?? 0) > 0 &&
          (!saleStart || now >= saleStart) && (!saleEnd || now <= saleEnd);
        if (saleActive) {
          serverUnitPrice = (sp.saleType || 'percentage') === 'fixed'
            ? roundUpTo100(Math.max(0, serverUnitPrice - sp.saleDiscountValue))
            : roundUpTo100(serverUnitPrice * (1 - sp.saleDiscountValue / 100));
        }
      }
    }
    // Fall back to the client price only when the line can't be priced (no size data)
    const customerPrice = serverUnitPrice > 0 ? serverUnitPrice : item.price;
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
      tenant:                tenantId,
      quantity:              qty,
      priceAtPurchase:       customerPrice,
      itemSubtotal:          Math.round(itemSubtotal     * 100) / 100,
      discountAmount:        0,
      vendorPriceAtPurchase: Math.round(vendorCostPerUnit * 100) / 100,
      tenantRevenueShare:    Math.round(vendorPayout      * 100) / 100,
      platformCommission:    Math.round(platformProfit    * 100) / 100,
      tenantRevenueModel:    revenueModel,
      revenueRateAtPurchase: revenueModel === 'commission' ? commissionPct : markupPct,
      packRateApplied:       packApplied,
    };
  });

   // Calculate order totals from items
  const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.itemSubtotal, 0);
  const calculatedPlatformCommission = orderItems.reduce((sum, item) => sum + (item.platformCommission || 0), 0);

  // ── Delivery fee: server-authoritative ────────────────────────────────────
  //
  // The browser sends the fee it displayed, which for an eligible first order is
  // already net of the waiver. Recomputing against that discounted number would
  // let the waiver compound, so the pre-waiver figure travels separately as
  // shippingInfo.baseFee and everything below is derived from it.
  const deliveryState = shipping?.state || '';
  const deliveryLga   = shipping?.lga || shipping?.city || '';
  const clientShippingFee = Math.max(0, Math.round(Number(shippingFee) || 0));
  const quotedBaseFee     = Math.max(0, Math.round(
    Number(shippingInfo?.baseFee ?? shippingFee) || 0,
  ));

  // Floor guard: nothing else validated the client's delivery fee, so a crafted
  // request could post shippingFee: 0 on any order. The zone table prices every
  // Nigerian state without needing coordinates, and no genuine quote lands below
  // the distance-pricing minimum, so the lower of the two is a floor that cannot
  // reject an honest quote. Orders over the free-delivery threshold floor at 0.
  const zoneQuote = calculateShipping(deliveryState, deliveryLga, calculatedSubtotal);
  const feeFloor  = zoneQuote.isFree ? 0 : Math.min(zoneQuote.fee, DISTANCE_MIN_FEE);
  if (quotedBaseFee < feeFloor) {
    return res.status(400).json({
      success: false,
      message: 'Delivery fee could not be verified. Please refresh your delivery address and try again.',
    });
  }

  const perk = await resolveFirstOrderPerk({
    user:     req.user,
    subtotal: calculatedSubtotal,
    state:    deliveryState,
    baseFee:  quotedBaseFee,
  });

  // Did the browser already charge the customer a discounted delivery fee?
  const clientClaimedWaiver = quotedBaseFee - clientShippingFee > 0;

  let resolvedShippingFee;
  let deliveryWaiver;
  if (perk.eligible) {
    resolvedShippingFee = perk.payableFee;
    deliveryWaiver = { applied: true, amount: perk.waivedAmount, reason: 'ok' };
  } else if (clientClaimedWaiver) {
    // The customer qualified when the quote was drawn but no longer does — the
    // usual cause is a second order placed from another tab a moment earlier.
    // Payment has already been captured at the lower figure, so honour it and
    // flag the order rather than silently billing a difference we cannot collect.
    resolvedShippingFee = clientShippingFee;
    deliveryWaiver = {
      applied: true,
      amount:  quotedBaseFee - clientShippingFee,
      reason:  `race_lost:${perk.reason}`,
    };
  } else {
    resolvedShippingFee = quotedBaseFee;
    deliveryWaiver = { applied: false, amount: 0, reason: perk.reason };
  }

  // Correct only the delivery component of the client's total. Recomputing the
  // whole total from calculatedSubtotal would change the charge on every order
  // where server and client subtotals legitimately differ (pack pricing), so the
  // delta approach leaves the untouched path exactly as it was.
  const resolvedTotal = Math.max(0, (Number(total) || 0) + (resolvedShippingFee - clientShippingFee));

  // Build order object with payment details if provided
  const orderData = {
    orderNumber,
    user: userId,
    items: orderItems,
    subtotal: calculatedSubtotal,
    discountTotal,
    coupon: appliedCoupon?._id || null,
    shippingFee: resolvedShippingFee,
    deliveryWaiver,
    taxAmount: 0,
    totalAmount: resolvedTotal,
    currency: 'NGN',
    paymentMethod: resolvedPaymentMethod,
    paymentStatus: paymentStatus || 'pending',
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
    utmSource: utmSource || '',
    utmMedium: utmMedium || '',
    utmCampaign: utmCampaign || '',
    status: status || 'pending',
    platformCommissionTotal: calculatedPlatformCommission,
  };

  // Add payment details if provided (for orders created after payment)
  if (paymentDetails) {
    orderData.paymentDetails = paymentDetails;
    Object.assign(orderData, buildOrderPaymentFields(paymentDetails));
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

  // Attribute the waiver to the FIRSTDELIVERY coupon when one exists, so uptake
  // shows in the analytics the admin coupon UI already renders. Best-effort —
  // the order is saved and paid for either way.
  if (deliveryWaiver.applied && userId) {
    await recordPerkUsage({
      userId,
      orderId:      order._id,
      orderAmount:  order.totalAmount,
      waivedAmount: deliveryWaiver.amount,
    });
  }

  // Populate order items for email notifications
  await order.populate([
    { path: 'items.product', select: 'name slug images' },
    { path: 'items.subproduct', select: 'name sku imagesOverride' },
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
        // Check the result, don't just check that the promise resolved:
        // sendEmail resolves with { success:false } when the transport is down.
        sendOrderConfirmationToCustomer(order, customer)
          .then(r  => r?.success
            ? console.log('✅ Order confirmation email → customer')
            : console.error('❌ Order confirmation email NOT sent → customer:', r?.error || 'unknown error'))
          .catch(e  => console.error('❌ Email to customer failed:', e.message)),

        sendOrderConfirmationSMS(order, customer)
          .then(r  => r?.success && console.log('✅ Order confirmation SMS → customer'))
          .catch(e  => console.error('❌ SMS to customer failed:', e.message)),

        sendOrderConfirmationWhatsApp(order, customer)
          .then(r  => r?.success && console.log('✅ Order confirmation WhatsApp → customer'))
          .catch(e  => console.error('❌ WhatsApp to customer failed:', e.message)),
      ]);

      // 2. Tenants — email + WhatsApp alert (use server-resolved tenant IDs, not client-supplied)
      for (const tenantId of resolvedTenantIds) {
        try {
          const tenant = await Tenant.findById(tenantId);
          if (!tenant) continue;

          await Promise.allSettled([
            tenant.email
              ? sendNewOrderNotificationToTenant(order, tenant, customer)
                  .then(r => r?.success
                    ? console.log(`✅ Order email → tenant: ${tenant.name}`)
                    : console.error(`❌ Order email NOT sent → tenant ${tenant.name}:`, r?.error || 'unknown error'))
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
        .then(r => r?.success
          ? console.log('✅ Order notification email → admin')
          : console.error('❌ Order notification email NOT sent → admin:', r?.error || 'unknown error'))
        .catch(e  => console.error('❌ Email to admin failed:', e.message));

      // 4. Loyalty points — 1 pt per ₦100 spent (paid orders only, logged-in users)
      if (userId && order.paymentStatus === 'paid') {
        try {
          const loyaltyUser = await User.findById(userId).select('loyaltyTier').lean();
          const multiplier = earnMultiplierForTier(loyaltyUser?.loyaltyTier || 'cork');
          const earnedPoints = Math.floor((order.totalAmount || 0) * LOYALTY_POINTS_PER_NGN * multiplier);
          if (earnedPoints > 0) {
            const loyaltyResult = await mutatePlatformLoyalty({
              userId,
              value: { type: 'earn', points: earnedPoints, reason: `Order ${order.orderNumber} — ₦${order.totalAmount.toLocaleString()} spent` },
              relatedOrder: order._id,
              createdBy: userId,
            });
            if (loyaltyResult.ok) {
              console.log(`✅ Loyalty: +${earnedPoints} pts → user ${userId} (balance: ${loyaltyResult.balance})`);
            } else {
              console.error('❌ Loyalty credit failed:', loyaltyResult.message);
            }
          }
        } catch (loyaltyErr) {
          console.error('❌ Loyalty credit error:', loyaltyErr.message);
        }
      }

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
    payment  = '',        // payment STATUS (paid/pending/…) — kept for API compat
    paymentMethod = '',   // how it was paid (card/bank_transfer/…)
    from,
    to,
    source   = '',
    sort       = 'placedAt',
    order: sortDir = 'desc',
    subProductId,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const skip     = (pageNum - 1) * pageSize;

  // Everything except `status` — the status cards need counts that respond to
  // the other filters but not to the status filter itself (otherwise selecting
  // "Delivered" would zero out every other card).
  const baseFilter = {};

  // ObjectId fields must be cast explicitly: this filter is reused by the
  // aggregation below, and unlike Order.find(), $match does NOT cast strings
  // to ObjectIds — a string tenant id there silently matches zero documents.
  const toObjectId = (v) => {
    if (!v) return null;
    return mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(String(v)) : null;
  };

  // Tenant admins can only see orders containing items from their own tenant
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    const tenantId = toObjectId(getTenantId(req));
    // A tenant id that won't cast must match nothing, never everything.
    baseFilter['items.tenant'] = tenantId ?? new mongoose.Types.ObjectId();
  }

  if (payment)       baseFilter.paymentStatus       = payment;
  if (source)        baseFilter.source              = source;

  // An unrecognised method must match nothing, never everything.
  if (paymentMethod) {
    baseFilter.paymentMethod = normalizePaymentMethod(paymentMethod) ?? '__no_such_method__';
  }

  if (subProductId)  baseFilter['items.subproduct'] = toObjectId(subProductId) ?? new mongoose.Types.ObjectId();

  if (from || to) {
    baseFilter.placedAt = {};
    if (from) baseFilter.placedAt.$gte = new Date(from);
    if (to)   baseFilter.placedAt.$lte = new Date(to);
  }

  if (search.trim()) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    baseFilter.$or = [
      { orderNumber:                re },
      { receiptNumber:              re },
      { paymentReference:           re },
      { 'shippingAddress.fullName': re },
      { 'shippingAddress.email':    re },
      { 'shippingAddress.phone':    re },
      // POS orders carry no shippingAddress — the buyer lives here instead
      { 'paymentDetails.customer.firstName': re },
      { 'paymentDetails.customer.lastName':  re },
      { 'paymentDetails.customer.phone':     re },
    ];
  }

  const filter = status ? { ...baseFilter, status } : baseFilter;

  const SORTABLE = {
    orderNumber:   'orderNumber',
    total:         'totalAmount',
    totalAmount:   'totalAmount',
    status:        'status',
    paymentStatus: 'paymentStatus',
    createdAt:     'createdAt',
    placedAt:      'placedAt',
  };
  const sortObj = { [SORTABLE[sort] || 'placedAt']: sortDir === 'asc' ? 1 : -1 };

  const [orders, total, statusCounts] = await Promise.all([
    Order.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(pageSize)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .populate('items.tenant', 'name')
      .lean(),
    Order.countDocuments(filter),
    // Status summary counts over the *unfiltered-by-status* result set
    Order.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = {
    all: 0, pending: 0, confirmed: 0, hold: 0, processing: 0,
    partially_shipped: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0,
  };
  statusCounts.forEach(({ _id, count }) => {
    counts.all += count;
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
    .populate('items.product', 'name slug images type')
    .populate('items.subproduct', 'name sku imagesOverride baseSellingPrice')
    .populate('items.size', 'displayName size sellingPrice')
    .populate('items.tenant', 'name')
    .populate('posStaff', 'firstName lastName posName email')
    .populate('coupon', 'code discountType discountValue');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  let canAccess = false;

  if (req.user) {
    // Logged-in user: order owner, platform admin, or tenant staff whose tenant
    // has items on this order (mirrors the scoping in getAllOrders — without
    // this, tenant admins can list an order but get 403 opening its detail page)
    const callerTenantId  = normalizeTenantId(req.user.tenant);
    const isOwner         = normalizeTenantId(order.user) === req.user._id.toString();
    const isPlatformAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const isTenantStaff =
      ['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(req.user.role) &&
      !!callerTenantId &&
      order.items.some((i) => normalizeTenantId(i.tenant) === callerTenantId);

    canAccess = isOwner || isPlatformAdmin || isTenantStaff;
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
    // Size has no `name` field — it exposes `size` ("75cl") and `displayName`
    .populate('items.size', 'displayName size')
    .populate('items.tenant', 'name');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Access control: authenticated user can view if they own the order,
  // are an admin, or verify via email match
  let canAccess = false;
  if (req.user) {
    canAccess = order.user?.toString() === req.user._id.toString() ||
      ['admin', 'super_admin'].includes(req.user.role);
  }
  if (!canAccess && email) {
    const emailLower = email.toLowerCase();
    canAccess = order.shippingAddress?.email?.toLowerCase() === emailLower ||
      order.customer?.email?.toLowerCase() === emailLower;
  }

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required to view this order',
    });
  }

  res.status(200).json({
    success: true,
    data: { order },
  });
});

/**
 * @desc    Get order by receipt number (POS lookup)
 * @route   GET /api/orders/receipt/:receiptNumber
 * @access  Private (admin)
 */
exports.getOrderByReceipt = asyncHandler(async (req, res) => {
  const { receiptNumber } = req.params;

  const filter = { receiptNumber };

  // Tenant admins can only look up receipts for orders containing their tenant's items
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    filter['items.tenant'] = getTenantId(req);
  }

  const order = await Order.findOne(filter)
    .populate('items.product', 'name slug images type')
    .populate('items.subproduct', 'name sku imagesOverride baseSellingPrice')
    .populate('items.size', 'displayName size sellingPrice')
    .populate('items.tenant', 'name')
    .populate('posStaff', 'firstName lastName posName email');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.status(200).json({ success: true, data: { order } });
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
    // paymentMethod was missing here, so a customer's own order list could never
    // show how they paid no matter what the UI did with it.
    .select('orderNumber status paymentStatus paymentMethod totalAmount subtotal shippingFee placedAt createdAt items');

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

  // Access control: order owner, platform admin, or tenant staff for orders containing their tenant's items
  const isOwner = order.user?.toString() === req.user._id.toString();
  const isPlatformAdmin = ['admin', 'super_admin'].includes(req.user.role);
  const isTenantStaff = ['tenant_admin', 'tenant_owner', 'tenant_staff'].includes(req.user.role) &&
    order.items.some(i => i.tenant?.toString() === req.user.tenant?.toString());

  if (!isOwner && !isPlatformAdmin && !isTenantStaff) {
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

  const previousStatus = order.status;  // BUGFIX: was undefined before
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
  const cancelCustomer = await resolveOrderRecipient(order);
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

  if (!APPLICABLE_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${APPLICABLE_STATUSES.join(', ')}`,
    });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Tenant scoping: non-platform-admins can only update orders containing their tenant's items
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    const callerTenantId = req.user.tenant?.toString();
    const orderHasTenantItem = order.items.some(i => i.tenant?.toString() === callerTenantId);
    if (!orderHasTenantItem) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
  }

  // Timestamps, save, and the inventory side effects all live in
  // orderStatus.service so the logistics dispatch module moves orders through
  // exactly the same path.
  const { previousStatus } = await applyOrderStatus(order, status, {
    actorId: req.user?._id,
    cancelReason: req.body.reason,
  });

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    data: { order },
  });

  // Notify customer via SMS + WhatsApp (fire-and-forget)
  if (previousStatus !== status) {
    const customer = await resolveOrderRecipient(order);
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

  // Tenant scoping: non-platform-admins can only update payment for orders containing their tenant's items
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    const callerTenantId = req.user.tenant?.toString();
    const orderHasTenantItem = order.items.some(i => i.tenant?.toString() === callerTenantId);
    if (!orderHasTenantItem) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
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
