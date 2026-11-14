const { calculateSubProductPricing } = require('../utils/pricing');
// controllers/order.controller.js

const mongoose = require('mongoose');
const orderAccess = require('../services/orderAccess');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Size = require('../models/Size');
const asyncHandler = require('../utils/asyncHandler');
const { generateOrderNumber, resolveOrderRecipient } = require('../utils/orderUtils');
const { resolveRevenueRates, resolveLineRates, resolveEffectiveUnitPrice, calculateSizePricing, applySubProductSale } = require('../utils/pricing');
const inventoryService = require('../services/inventory.service');
const { applyOrderStatus, APPLICABLE_STATUSES } = require('../services/orderStatus.service');
const { getTenantId, normalizeTenantId } = require('../utils/tenantContext');
const { calculateShipping, DISTANCE_MIN_FEE } = require('../data/shipping-zones');
const { resolveFirstOrderPerk, recordPerkUsage } = require('../services/firstOrderPerk.service');
const { normalizePaymentMethod, buildOrderPaymentFields } = require('../utils/paymentMethods');
const { getGiftPackagingSku, normalizeGiftSubdoc } = require('../config/giftPackaging');
const { resolveGatewayPaymentMethod } = require('../services/payment.service');
const { ForbiddenError, ValidationError, ConflictError } = require('../utils/errors');
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

const { emitToTenantOrders } = require('../services/pos.realtime');

const { mutatePlatformLoyalty } = require('../services/platformLoyalty.service');
const { earnMultiplierForTier, pointsForSpend } = require('../services/platformLoyalty.helpers');

const LOYALTY_POINTS_PER_NGN = 1 / 100; // 1 pt per ₦100 base rate

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private/Public (Guest checkout supported)
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const recovery = require('../services/marketCheckoutRecovery');
  const accepted = await recovery.recover(req);
  if (accepted) return res.status(200).json(recovery.response(accepted));
  const marketContext = require('../services/marketContext');
  if (marketContext.enabled()) await require('../services/country').resolveCountry(marketContext.currentMarket());
  const { customer, shipping, paymentMethod, paymentDetails, items, shippingFee, shippingInfo, total, couponCode, ageVerified, status, paymentStatus, utmSource, utmMedium, utmCampaign, bannerId, gift } = req.body;

  // Fold accepted aliases ('bank', 'cod', …) into a storable enum value. The
  // route validator has already rejected anything unrecognisable, so a null here
  // would only come from a caller that bypassed it.
  const canonicalPaymentMethod = normalizePaymentMethod(paymentMethod);
  if (!canonicalPaymentMethod) {
    return res.status(400).json({ success: false, message: 'Invalid payment method' });
  }

  // ── Manual intake mode (WhatsApp orders created by platform staff) ────────
  // The admin's JWT is on the request, but the ORDER belongs to the customer.
  // Everything downstream (pricing, tenant derivation, idempotency) is the
  // normal checkout path — only ownership/provenance/notifications differ.
  const manualOrder = req.body.manualOrder || null;
  // Platform staff is a ROLE test, mirroring orderAccess.platform — a platform
  // admin's JWT may legitimately carry a tenant snapshot (e.g. the seeded
  // super_admin also belongs to Wyn City); tenant staff roles never match.
  const isPlatformStaff = Boolean(
    req.user && ['super_admin', 'admin'].includes(req.user.role)
  );
  if (manualOrder && !isPlatformStaff) {
    throw new ForbiddenError('Only platform admins can create manual orders');
  }
  const isManual = Boolean(manualOrder);
  if (isManual) {
    if (manualOrder.originChannel !== 'whatsapp') throw new ValidationError('Unsupported manual order channel');
    if (canonicalPaymentMethod !== 'bank_transfer') throw new ValidationError('Manual orders are invoiced for bank transfer / card payment');
    if (couponCode) throw new ValidationError('Coupons are not supported on manual orders');
  }

  // For hosted-gateway payments the browser only knows which button was pressed
  // before hand-off — Korapay's checkout offers card, bank transfer and USSD
  // behind one button — so ask the gateway what actually settled.
  const resolvedPaymentMethod = canonicalPaymentMethod;
  if (!paymentDetails && (paymentStatus && paymentStatus !== 'pending' || status && status !== 'pending')) throw new ValidationError('Settlement and lifecycle require server evidence');
  if (!paymentDetails && !['cash_on_delivery', 'bank_transfer'].includes(canonicalPaymentMethod)) throw new ValidationError('Verified payment receipt required');

  let appliedCoupon = null;
  let discountTotal = 0;

  const userId = req.user?._id || null;

  let user = null;
  if (isManual) {
    // Match the customer by email first, then phone. No match → guest order;
    // the shippingAddress snapshot below keeps the customer's details either way.
    const email = String(customer?.email || '').trim().toLowerCase();
    const phone = String(customer?.phone || '').trim();
    if (email) user = await User.findOne({ email });
    if (!user && phone) user = await User.findOne({ phone });
  } else if (userId) {
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
      ? SubProduct.find({ _id: { $in: subProductIds }, isPublished: true, status: { $in: ['active', 'low_stock', 'out_of_stock'] }, visibleInOnlineStore: { $ne: false } })
          .select('_id status costPrice baseSellingPrice sellingPriceMarkupOverridePct commissionPriceOverride platformMarkupOverridePct tenant product sellWithoutSizeVariants isOnSale saleDiscountValue saleType saleStartDate saleEndDate')
          .lean()
      : Promise.resolve([]),
    sizeIds.length
      ? Size.find({ ...require('../constants/sizeChannels').retailSizeWhereClause(), _id: { $in: sizeIds } })
          .select('_id subproduct status costPrice sellingPrice wholesalePrice packPlatformMarkupOverridePct tenant unitsPerPack maxOrderQuantity sellingPriceMarkupOverridePct commissionPriceOverride packCommissionPriceOverride platformMarkupOverridePct discountValue discountType discountStart discountEnd')
          .lean()
      : Promise.resolve([]),
  ]);

  const subProductMap = new Map(subProducts.map(sp => [sp._id.toString(), sp]));
  const sizeMap       = new Map(sizes.map(s  => [s._id.toString(),  s]));

  // Validate: every item's subProductId must resolve to a published, active SubProduct
  const invalidItems = items.filter(item => {
    const listing = subProductMap.get(item.subProductId?.toString());
    if (!listing) return true;
    if (!item.sizeId) return false;
    const size = sizeMap.get(item.sizeId.toString());
    return !size || (size.status && size.status !== 'active') || String(size.subproduct) !== String(listing._id) || String(size.tenant) !== String(listing.tenant);
  });
  if (invalidItems.length) {
    return res.status(400).json({
      success: false,
      message: 'One or more items are unavailable or no longer in stock',
    });
  }
  if (items.some(item => !item.sizeId && subProductMap.get(item.subProductId.toString()).sellWithoutSizeVariants !== true)) {
    return res.status(400).json({ success: false, message: 'Select a product variant before checking out' });
  }

  // Build tenant map from the SubProducts' actual tenant field (server-authoritative)
  const resolvedTenantIds = [...new Set(
    subProducts.map(sp => sp.tenant?.toString()).filter(Boolean)
  )];
  const tenants = await Tenant.find({ _id: { $in: resolvedTenantIds } })
    .select('_id name revenueModel sellingPriceMarkupPercentage markupPercentage commissionPercentage platformMarkupPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits storefrontIntegrationEnabled warehouseSettings.marketplaceWarehouses warehouseSettings.marketplaceWarehouse')
    .lean();
  const tenantMap = new Map(tenants.map(t => [t._id.toString(), t]));

  // Product docs are needed to recompute the authoritative platform price
  const orderProductIds = [...new Set(subProducts.map(sp => sp.product?.toString()).filter(Boolean))];
  const orderProducts = orderProductIds.length
    ? await Product.find({ _id: { $in: orderProductIds } }).select('_id type platformMarkup platformDiscount').lean()
    : [];
  const productMap = new Map(orderProducts.map(p => [p._id.toString(), p]));

  // ── Build orderItems ─────────────────────────────────────────────────────
  //
  // Mirrors the server-side pricing pipeline in utils/pricing.js:
  //   Markup model     → platformCostPrice = costPrice × (1 + tenant.markupPercentage%)
  //   Commission model → final merchandise × (1 − agreed commission rate)
  //
  // platformCostPrice = vendorPayout (what platform owes vendor)
  // platformProfit    = itemSubtotal − vendorPayout × qty
  //
  // costPrice/sellingPrice use Size values when present, falling back to SubProduct.
  let orderItems = items.map(item => {
    const sp            = subProductMap.get(item.subProductId?.toString());
    const sz            = sizeMap.get(item.sizeId?.toString());
    // Derive tenant from the SubProduct (server-authoritative), NOT from client body
    const tenantId      = sp?.tenant?.toString() || item.tenantId || null;
    const tenant        = tenantMap.get(tenantId);
    if (!tenant) throw new ValidationError('Tenant revenue agreement is unavailable');
    if (sp.status && sp.status !== 'active' && !require('../services/marketplaceWarehouseStock').selection(tenant).length) {
      throw new ValidationError('One or more items are unavailable or no longer in stock');
    }
    const revenueModel  = tenant.revenueModel ?? 'markup';
    const qty = item.quantity;
    // Server-authoritative unit price — the SAME two steps, in the same order,
    // that cart validateCartItems runs: calculateSizePricing, then the
    // sub-product sale. It used to apply the sale inline here instead, which
    // left two copies of the arithmetic free to diverge — and they had: the
    // inline copy discounted an unrecognised saleType as a percentage, and it
    // ran AFTER resolveEffectiveUnitPrice had already picked the pack rate, so
    // a sale item bought by the pack was charged pack × sale. Stacking the two
    // is what pricing.js and product.service.js both say must never happen.
    const productDoc = productMap.get(sp?.product?.toString());
    const sizePricing = (sp && tenant)
      ? applySubProductSale(
          sz ? calculateSizePricing(sz, productDoc, tenant, sp?.costPrice ?? 0, sp?.baseSellingPrice ?? 0) : calculateSubProductPricing(sp, productDoc, tenant),
          sp,
        )
      : null;
    // Pack pricing applies only when the size actually publishes a cheaper pack
    // price AND the line quantity reached the threshold — payout rates and the
    // packRateApplied flag must track the price the customer actually pays.
    const packApplied = sizePricing?.packUnitPrice != null &&
      sizePricing?.packThreshold != null && qty >= sizePricing.packThreshold;
    const { markupPct, commissionPct } = packApplied
      ? resolveLineRates(tenant, sz, qty)
      : resolveRevenueRates(tenant, 1);

    // sizePricing already carries the sale (and has withdrawn the pack rate for
    // its duration), so this is just the quantity choice.
    const serverUnitPrice = sizePricing ? resolveEffectiveUnitPrice(sizePricing, qty) : 0;
    if (!(serverUnitPrice > 0)) throw new ValidationError('Product has no valid marketplace price');
    const customerPrice = serverUnitPrice;
    const itemSubtotal  = customerPrice * qty;

    const split = require('../utils/revenueAgreement').splitMerchandise({
      amount: itemSubtotal, quantity: qty, model: revenueModel,
      rate: revenueModel === 'selling_price_markup' ? sizePricing.sellingPriceMarkupPct : revenueModel === 'commission' ? commissionPct : markupPct,
      payout: packApplied ? sizePricing.packPlatformCostPrice : sizePricing?.platformCostPrice,
    });

    return {
      product:               sp.product,
      subproduct:            item.subProductId || null,
      size:                  item.sizeId || null,
      tenant:                tenantId,
      quantity:              qty,
      priceAtPurchase:       customerPrice,
      itemSubtotal:          Math.round(itemSubtotal     * 100) / 100,
      discountAmount:        0,
      ...split,
      tenantRevenueModel:    revenueModel,
      revenueRateAtPurchase: revenueModel === 'selling_price_markup' ? sizePricing.sellingPriceMarkupPct : revenueModel === 'commission' ? commissionPct : markupPct,
      packRateApplied:       packApplied,
    };
  });

  // ── Gift checkout (order-level) ───────────────────────────────────────────
  //
  // The client adds the configured gift-packaging SKU to the cart as a normal
  // line, so this cross-check is the last server-side gate before money moves:
  // packagingRequested without that line is rejected rather than accepted as an
  // unfulfillable promise, and an unconfigured SKU is rejected outright. See
  // docs/superpowers/specs/2026-10-27-gift-checkout-design.md.
  let giftSubdoc;
  if (gift && typeof gift === 'object') {
    if (gift.packagingRequested === true) {
      const sku = await getGiftPackagingSku();
      if (!sku) {
        return res.status(422).json({ success: false, message: 'Gift packaging is not available yet.' });
      }
      const packagingLines = orderItems.filter(item =>
        String(item.product) === sku.productId &&
        String(item.subproduct) === sku.subProductId
      );
      if (packagingLines.length !== 1) {
        return res.status(422).json({ success: false, message: 'Add the gift packaging item to your cart, or untick gift packaging.' });
      }
    }
    giftSubdoc = normalizeGiftSubdoc(gift);
  }

   // Calculate order totals from items
  const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.itemSubtotal, 0);
  let calculatedPlatformCommission = orderItems.reduce((sum, item) => sum + (item.platformCommission || 0), 0);

  // ── Coupon: server-authoritative ────────────────────────────────────────
  //
  // Runs against calculatedSubtotal (the sum of server-priced order items),
  // never the client-supplied req.body.subtotal — a crafted request could
  // otherwise post an inflated subtotal to clear a coupon's minimum spend,
  // or a deflated one to under-charge a percentage discount.
  if (couponCode) {
    appliedCoupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!appliedCoupon) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    // A coupon restricted to specific users, or to first purchases, cannot be
    // validated for a guest. Reject rather than silently granting the discount.
    const couponUserId = req.user?._id || null;
    if (!couponUserId && (appliedCoupon.allowedUsers.length > 0 || appliedCoupon.firstPurchaseOnly)) {
      return res.status(400).json({ success: false, message: 'Please sign in to use this coupon' });
    }

    // canBeUsedBy owns the whole rule set: the isValid virtual (isActive,
    // status, startDate, endDate, usageLimit), allowedUsers, excludedUsers,
    // usageLimitPerUser, firstPurchaseOnly, minimumAccountAge, and the
    // minimum/maximum spend added in this task.
    const eligibility = couponUserId
      ? await appliedCoupon.canBeUsedBy(couponUserId, { subtotal: calculatedSubtotal })
      : (appliedCoupon.isValid
          ? { canUse: true }
          : { canUse: false, reason: 'Invalid or expired coupon code' });

    if (!eligibility.canUse) {
      return res.status(400).json({ success: false, message: eligibility.reason });
    }

    discountTotal = appliedCoupon.calculateDiscount(calculatedSubtotal);
  }
  // ──────────────────────────────────────────────────────────────────────────

  orderItems = require('../utils/revenueAgreement').allocateOrderDiscount(orderItems, discountTotal);
  calculatedPlatformCommission = Math.round(orderItems.reduce((sum, item) => sum + item.platformCommission, 0) * 100) / 100;

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
    user:     isManual ? (user || null) : req.user,
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

  // The customer total and the split share the same server-priced merchandise basis.
  const resolvedTotal = Math.round((calculatedSubtotal - discountTotal + resolvedShippingFee) * 100) / 100;

  // Build order object with payment details if provided
  const orderData = {
    orderNumber,
    user: isManual ? (user?._id || null) : userId,
    ...(isManual ? {
      source: 'manual',
      originChannel: manualOrder.originChannel,
      placedBy: req.user._id,
    } : {}),
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
    paymentStatus: 'pending',
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
    bannerId: bannerId || null,
    status: canonicalPaymentMethod === 'cash_on_delivery' ? 'confirmed' : 'pending',
    platformCommissionTotal: calculatedPlatformCommission,
    ...(giftSubdoc ? { gift: giftSubdoc } : {}),
  };

  const marketIngress = require('../services/marketIngress');
  await marketIngress.assertLines(orderItems, orderProducts, tenants);
  if (marketContext.enabled()) orderData.channelSnapshot = await marketIngress.snapshot({
    kind: 'marketplace', currency: orderData.currency,
    provider: paymentDetails?.method || canonicalPaymentMethod, account: 'platform',
  });
  const order = await require('../services/marketplacePaymentTrust').createOrder(orderData, tenants, paymentDetails, req.user, req.get('Idempotency-Key'), recovery.requestFingerprint(req.body), { requireDefaultWarehouse: !isManual });

  if (order.$locals.checkoutReplayed) return res.status(200).json({ success: true, data: { guestAccessToken: require('../services/guestOrderProof').issue(order), order: {
    _id: order._id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus,
    subtotal: order.subtotal, discountTotal: order.discountTotal, shippingFee: order.shippingFee, totalAmount: order.totalAmount,
  } } });

  // Record coupon usage only once the order actually exists, so usedBy[] carries
  // a real orderId. recordUsage increments timesUsed, accumulates the analytics
  // the admin coupon UI renders, and flips status to 'depleted' at the limit.
  if (appliedCoupon) {
    try {
      await appliedCoupon.recordUsage(
        userId, order.totalAmount || 0, discountTotal, order._id
      );
    } catch (couponErr) {
      console.error('❌ Coupon usage record failed:', couponErr.message);
    }
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
      // Manual orders: the customer has not paid yet — the "order confirmed"
      // receipt fires when the invoice settles (whatsappOrderInvoice.notifyPaid).
      // Tenant + admin alerts still fire now.
      if (!isManual) {
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
      }

      // 2. Tenants — email + WhatsApp alert (use server-resolved tenant IDs, not client-supplied)
      for (const tenantId of resolvedTenantIds) {
        try {
          const tenant = await Tenant.findById(tenantId);
          if (!tenant) continue;

          // orderAccess.project whitelists fields for the tenant scope and
          // strips order.gift; the gift block is customer content (not
          // tenant-sensitive), so it is re-attached here so staff alerts can
          // surface it (see the gift section in email/whatsapp services).
          const tenantView = orderAccess.project(order, { _id: tenant._id, tenant: tenant._id, role: 'tenant_admin' });
          if (order.gift) tenantView.gift = order.gift;

          // Realtime — push this tenant's slice of the order into their POS
          // order room (terminals + KDS auto-join at connection). Same
          // fire-and-forget contract as the email/WhatsApp above: a socket
          // miss (serverless deploy, no io) is normal — the POS bell's 30s
          // poll is the fallback that still delivers. Payload shape mirrors
          // getPOSNotifications rows so the client feeds its store directly.
          try {
            const ownItems = tenantView.items || [];
            emitToTenantOrders(req, String(tenant._id), 'marketplace:new_order', {
              orderId: String(order._id),
              orderNumber: order.orderNumber,
              placedAt: order.placedAt
                ? new Date(order.placedAt).toISOString()
                : new Date().toISOString(),
              total: order.totalAmount,
              source: order.source || 'web',
              status: order.status,
              customer:
                `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
                customer?.email ||
                'Customer',
              itemCount: ownItems.reduce((s, i) => s + (i.quantity || 1), 0),
              items: ownItems.slice(0, 5).map((i) => ({
                name: i.name || i.productName || 'Item',
                qty: i.quantity || 1,
                subtotal: i.itemSubtotal ?? 0,
              })),
            });
          } catch (pushErr) {
            console.error(`❌ Realtime order push → tenant ${tenant.name} failed:`, pushErr.message);
          }

          await Promise.allSettled([
            tenant.email
              ? sendNewOrderNotificationToTenant(tenantView, tenant, customer)
                  .then(r => r?.success
                    ? console.log(`✅ Order email → tenant: ${tenant.name}`)
                    : console.error(`❌ Order email NOT sent → tenant ${tenant.name}:`, r?.error || 'unknown error'))
                  .catch(e  => console.error(`❌ Email to tenant ${tenant.name} failed:`, e.message))
              : Promise.resolve(),

            (tenant.phone || tenant.whatsapp)
              ? sendNewOrderAlertWhatsApp(tenantView, tenant)
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

      // 4b. Referral payout — the referee's first PAID order credits the referrer.
      // Wrapped: a referral failure must never fail an order already paid for.
      try {
        const { settleReferralOnPaidOrder } = require('../services/referral.service');
        const settled = await settleReferralOnPaidOrder(order);
        if (settled.ok) console.log(`✅ Referral paid out for order ${order.orderNumber}`);
      } catch (refErr) {
        console.error('❌ Referral settle error:', refErr.message);
      }

      // 5. Banner conversion — fire-and-forget when the order came via a banner link.
      if (bannerId) {
        const { trackConversion } = require('../services/banner.service');
        trackConversion(bannerId)
          .then(() => console.log(`✅ Banner conversion tracked for ${bannerId}`))
          .catch((e) => console.error('❌ Banner conversion tracking failed:', e.message));
      }

    } catch (err) {
      console.error('❌ Unexpected error in order notification block:', err.message);
    }
  })();

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: {
      guestAccessToken: require('../services/guestOrderProof').issue(order),
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
        originChannel: order.originChannel || undefined,
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
  orderAccess.permit(req.user, 'orders:read');
  await orderAccess.audit(null, req.user, 'order_list');
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
  if (subProductId && !orderAccess.platform(req.user)) baseFilter.items = { $elemMatch: { tenant: baseFilter['items.tenant'], subproduct: baseFilter['items.subproduct'] } };

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
      orders: orders.map(order => orderAccess.project(order, req.user)),
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

  const actor = require('../services/guestOrderProof').actor(req, order);
  orderAccess.access(order, actor);
  await orderAccess.audit(order, req.user, 'order_read');

  res.status(200).json({
    success: true,
    data: { order: orderAccess.project(order, actor) },
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

  orderAccess.access(order, req.user);
  await orderAccess.audit(order, req.user, 'order_read');

  res.status(200).json({
    success: true,
    data: { order: orderAccess.project(order, req.user) },
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

  await orderAccess.audit(order, req.user, 'order_read');
  res.status(200).json({ success: true, data: { order: orderAccess.project(order, req.user) } });
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

  const query = { user: req.user._id };

  const orders = await Order.find(query)
    .sort({ placedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('items.product', 'name slug images')
    // paymentMethod was missing here, so a customer's own order list could never
    // show how they paid no matter what the UI did with it.
    .select('user orderNumber status paymentStatus paymentMethod totalAmount subtotal shippingFee placedAt createdAt items');

  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      orders: orders.map(order => orderAccess.project(order, req.user)),
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

  require('../services/venue/legacy-guards').rejectCanonicalOrder(order);
  const scope = orderAccess.assertMutation(order, req.user, { customer: true });
  const isPlatformAdmin = scope === 'platform';
  const isTenantStaff = scope === 'tenant';
  await orderAccess.audit(order, req.user, 'order_cancel');
  if (order.paymentStatus === 'paid') throw new ConflictError('Paid order requires refund review before cancellation');

  require('../services/venue/legacy-guards').rejectCanonicalOrder(order);
  if (order.integrationCheckout) throw new ConflictError('Use the website checkout cancellation API');
  if (order.onlineStockVersion === 1) {
    await require('../services/storefrontLocationOrders').applyStatus(order, 'cancelled', { actorId: req.user._id, cancelReason: req.body.reason,
      ...(!isPlatformAdmin && isTenantStaff ? { tenantId: req.user.tenant } : {}) });
    return res.json({ success: true, data: { order: orderAccess.project(order, req.user) } });
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
    data: { order: orderAccess.project(order, req.user) },
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

  require('../services/venue/legacy-guards').rejectCanonicalOrder(order);
  orderAccess.assertMutation(order, req.user);
  await orderAccess.audit(order, req.user, 'order_updateOrderStatus');

  // Timestamps, save, and the inventory side effects all live in
  // orderStatus.service so the logistics dispatch module moves orders through
  // exactly the same path.
  const { previousStatus } = await applyOrderStatus(order, status, {
    actorId: req.user?._id,
    cancelReason: req.body.reason,
    ...(!['admin', 'super_admin'].includes(req.user.role) ? { tenantId: req.user.tenant } : {}),
  });

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    data: { order: orderAccess.project(order, req.user) },
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

  require('../services/venue/legacy-guards').rejectCanonicalOrder(order);
  orderAccess.assertMutation(order, req.user);
  require('../services/merchantFulfillment/identity').assertLegacy(order, 'Use owned merchant collection or refund reconciliation');
  await orderAccess.audit(order, req.user, 'order_updatePaymentStatus');

  require('../services/venue/legacy-guards').rejectCanonicalOrder(order);
  if (order.integrationCheckout) {
    return res.status(409).json({ success: false, message: 'Use verified website collection and refund reconciliation' });
  }
  if (order.tableServiceBooking) {
    return res.status(409).json({ success: false, message: 'Table-service payment state must be reconciled with the provider from the booking screen' });
  }
  const now = new Date();

  if (action === 'mark_refunded') throw new ConflictError('Execute a verified provider refund or use channel refund review');
  const eligibleCollectionState = ['pending', 'confirmed', 'processing'].includes(order.status) ||
    (['cash', 'cash_on_delivery'].includes(order.paymentMethod) && ['shipped', 'delivered'].includes(order.status));
  if (order.paymentStatus !== 'pending' || !eligibleCollectionState) throw new ConflictError('Payment state requires reconciliation');
  if (action === 'mark_paid' && !['cash', 'cash_on_delivery'].includes(order.paymentMethod)) throw new ConflictError('Attach a verified receipt for electronic payments');
  if (action === 'mark_failed') throw new ConflictError('Use order cancellation to release unpaid stock safely');

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

    default:
      return res.status(400).json({ success: false, message: 'Invalid action. Use: mark_paid, mark_failed, mark_refunded' });
  }

  await order.save();

  // Referral payout — admin marked the order PAID, so the referrer is paid.
  // Wrapped: a referral failure must never fail an admin payment update.
  if (action === 'mark_paid') {
    try {
      const { settleReferralOnPaidOrder } = require('../services/referral.service');
      await settleReferralOnPaidOrder(order);
    } catch (refErr) {
      console.error('❌ Referral settle (admin mark_paid) error:', refErr.message);
    }
  }

  res.json({
    success: true,
    message: 'Payment updated successfully',
    data: { order: orderAccess.project(order, req.user) },
  });
});

module.exports = exports;
