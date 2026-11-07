'use strict';
const crypto = require('node:crypto');
const Order = require('../../models/Order'); const Session = require('../../models/VenueServiceSession');
const { visitContext } = require('./lines'); const { runVenueOperation } = require('./operations');
const { reserveBillStock } = require('./inventory'); const { id } = require('./eligibility'); const { fail } = require('./errors');
function billTotals(lines, rateBps) {
  if (![0, 900].includes(rateBps) || !lines.length || lines.some(l => !Number.isSafeInteger(l.netMinor) || l.netMinor <= 0 || !Number.isSafeInteger(l.taxMinor) || l.taxMinor < 0)) fail('INVALID_MONEY', 'Invalid bill amount', 400);
  const netMinor = lines.reduce((sum, l) => sum + l.netMinor, 0), taxMinor = lines.reduce((sum, l) => sum + l.taxMinor, 0);
  const totalMinor = netMinor + taxMinor;
  if (![netMinor, taxMinor, totalMinor].every(Number.isSafeInteger)) fail('INVALID_MONEY', 'Bill total overflow', 400);
  const commissionMinor = Number((BigInt(netMinor) * BigInt(rateBps) + 5000n) / 10000n);
  return { netMinor, taxMinor, totalMinor, commissionMinor, tenantShareMinor: totalMinor - commissionMinor };
}
function billDTO(order, visit) {
  const snapshot = order.venueBillSnapshot;
  const allocatedMinor = order.venueMoneyVersion === 2 ? order.venueAppliedMinor || 0 : order.paymentStatus === 'paid' ? snapshot.totalMinor : 0;
  return { locationId:id(visit.location),moneyEnabled:process.env.VENUE_MONEY_ENABLED==='true',financialPolicyVersion:order.venueFinancialPolicy?.version,sessionId: id(visit), orderId: id(order), identityVersion: 1, quoteId: snapshot.quoteId, version: visit.version,
    lineVersion: snapshot.lineVersion, currency: 'NGN', lines: snapshot.acceptedLines.map(l => ({ lineId: l.lineId, revision: l.revision, subProductId: id(l.subproduct), sizeId: id(l.size), name: l.name, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, netMinor: l.netMinor, taxMinor: l.taxMinor })),
    ...Object.fromEntries(['netMinor', 'taxMinor', 'totalMinor', 'commissionMinor', 'tenantShareMinor'].map(k => [k, snapshot[k]])),
    financialLines: (snapshot.financialLines || []).map(l => ({kind:l.kind,description:l.description,amountMinor:l.amountMinor,taxMinor:l.taxMinor})),
    refundedMinor: order.venueRefundedMinor || 0, moneyVersion: order.venueMoneyVersion || 1, allocatedMinor, outstandingMinor: snapshot.totalMinor - allocatedMinor, state: order.venueSettlementState,
    supportedTenders: visit.acquisition.kind === 'direct' && visit.posSessionId ? ['cash', 'paystack'] : ['paystack'], accountingState: order.accountingStatus, stockState: order.venueStockState };
}
async function ensureBillOrder(args) {
  const { tenantId, sessionId, actor, expectedVersion, lineVersion, ageVerified, idempotencyKey } = args;
  const context = await visitContext({ ...args, action: 'bill.freeze' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'bill.freeze', key: idempotencyKey,
    payload: { sessionId, expectedVersion, lineVersion, ageVerified }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ ...args, action: 'bill.freeze', mongoSession });
      if (visit.billOrder) {
        const bill = await Order.findOne({ _id: visit.billOrder, tenant: tenantId, venueBillForSession: visit._id }).session(mongoSession);
        if (!bill) fail('BILL_LINK_CONFLICT'); return billDTO(bill, visit);
      }
      if (visit.state !== 'open' || visit.version !== expectedVersion || visit.lineVersion !== lineVersion) fail('STATE_CHANGED', 'Visit changed; refresh the bill');
      if (ageVerified !== true) fail('AGE_VERIFICATION_REQUIRED', 'Confirm the guest meets the drinking age', 400);
      const terms = visit.termsAtOpen;
      if (!terms?.effectiveAt || terms.platformRateBps !== 900 || terms.directRateBps !== 0) fail('COMMERCIAL_REVIEW_REQUIRED', 'Review venue commercial terms');
      const rateBps = visit.acquisition.kind === 'platform' ? terms.platformRateBps : terms.directRateBps;
      const acceptedLines = visit.acceptedLines.map(l => l.toObject()); const totals = billTotals(acceptedLines, rateBps);
      const bookingPolicy = visit.booking && await require('../../models/Booking').findOne({ _id: visit.booking, tenant: tenantId, location: visit.location, serviceSession: visit._id }).session(mongoSession).lean();
      const financial = bookingPolicy?.financialPolicy || null;
      // S5 derivation order (no circularity): the eligible merchandise net comes
      // ONLY from the frozen accepted lines. (1) the service-charge line derives
      // from that net (appliesTo/exclusions in service-charge.js) with the SAME
      // consent version as the minimum; (2) the minimum then derives from the
      // same accepted lines — the service-charge amount joins the minimum's
      // eligible net ONLY when the approved policy sets countsTowardMinimum
      // (default false: ineligible charges never falsely meet the minimum).
      const serviceRateBps = (() => { if (!financial?.serviceCharge?.enabled) return 0;
        const rates = [...new Set(acceptedLines.map(l => l.taxRate))];
        if (rates.length !== 1) fail('COMMERCIAL_REVIEW_REQUIRED', 'Service charge requires a single line tax rate');
        return Math.round(rates[0] * 100); })();
      const serviceCharge = require('./service-charge');
      const serviceLines = serviceCharge.serviceChargeLines(serviceCharge.eligibleServiceChargeNet(acceptedLines, financial), financial, bookingPolicy?.financialTermsVersion, serviceRateBps);
      const minimum = require('./minimum-spend').financialLines(financial?.serviceCharge?.enabled && financial.serviceCharge.countsTowardMinimum && serviceLines[0]
        ? acceptedLines.concat({ subproduct: 'venue:service_charge', netMinor: serviceLines[0].amountMinor })
        : acceptedLines, financial, bookingPolicy?.financialTermsVersion);
      const adjustmentMinor = require('./money-rules').sum(...minimum.lines.map(l => l.amountMinor), ...serviceLines.map(l => l.amountMinor));
      totals.totalMinor = require('./money-rules').sum(totals.totalMinor, adjustmentMinor); totals.tenantShareMinor = totals.totalMinor - totals.commissionMinor;
      if (visit.booking && await Order.exists({ tenant: tenantId, tableServiceBooking: visit.booking }).session(mongoSession)) fail('BILL_ALREADY_BOUND', 'Legacy booking checkout must be reconciled first');
      let commissionRemainder = totals.commissionMinor;
      const items = acceptedLines.map((line, i) => {
        const fee = i === acceptedLines.length - 1 ? commissionRemainder : Number(BigInt(totals.commissionMinor) * BigInt(line.netMinor) / BigInt(totals.netMinor)); commissionRemainder -= fee;
        return { venueLineId: line.lineId, venueLineRevision: line.revision, product: line.product, subproduct: line.subproduct, size: line.size, tenant: tenantId, warehouse: visit.location, quantity: line.quantity,
          priceAtPurchase: line.unitPriceMinor / 100, itemSubtotal: line.netMinor / 100, taxRate: line.taxRate, taxAmount: line.taxMinor / 100,
          vendorPriceAtPurchase: line.costMinor / 100, tenantRevenueShare: (line.netMinor - fee) / 100, platformCommission: fee / 100, tenantRevenueModel: 'commission', revenueRateAtPurchase: rateBps / 100 };
      });
      const snapshot = { ...(acceptedLines.some(line => line.servingSnapshot) ? { costMode: 'actual' } : {}), quoteId: crypto.randomUUID(), lineVersion, acceptedLines, ...totals, termsVersion: terms.version, rateBps,
        financialLines: [...minimum.lines, ...serviceLines], eligibleNetMinor: minimum.eligibleNetMinor, minimumPolicyVersion: financial?.version, acquisition: visit.acquisition, locationId: id(visit.location), posSessionId: id(visit.posSessionId) || null, createdAt: new Date() };
      const bill = new Order({ tenant: tenantId, orderNumber: `DHV-B-${crypto.randomUUID()}`, receiptNumber: `DHV-${crypto.randomUUID()}`,
        source: visit.posSessionId ? 'pos' : 'manual', posWarehouse: visit.location, ...(visit.posSessionId ? { posSessionId: visit.posSessionId, shopId: visit.posShopId, shopName: visit.posShopName, terminalType: visit.terminalType, posStaff: actor.userId } : {}),
        ...(visit.booking ? { tableServiceBooking: visit.booking } : {}), venueServiceSession: visit._id, venueBillForSession: visit._id, venueIdentityVersion: 1,
        venueBillSnapshot: snapshot, ...(financial?.minimumMinor || serviceLines.length ? {venueMoneyVersion: 2, venueFinancialPolicy: financial} : {}), venueStockState: 'reserved', venueSettlementState: 'unpaid', items, subtotal: totals.netMinor / 100, taxAmount: totals.taxMinor / 100,
        totalAmount: totals.totalMinor / 100, platformCommissionTotal: totals.commissionMinor / 100, shippingFee: 0, paymentMethod: 'card', paymentStatus: 'pending', status: 'pending', currency: 'NGN', ageVerifiedAtOrderTime: true });
      bill.$locals.deferAccounting = true; await bill.save({ session: mongoSession });
      await reserveBillStock({ tenantId, locationId: id(visit.location), billOrder: bill, actor, mongoSession });
      await require('./advance-credit').applyAtFreeze({ bill, visit, mongoSession });
      visit.billOrder = bill._id; visit.state = 'closing'; visit.version++; await visit.save({ session: mongoSession });
      return billDTO(bill, visit);
    } });
}
async function getBill(args) {
  const { visit } = await visitContext({ ...args, action: 'bill.read' });
  if (!visit.billOrder) {
    // S3: the open-visit snapshot read echoes the course registry additively —
    // the workspace courses panel loads course states + unfired counts from this
    // one read (bill.read) instead of a new route. Closed/frozen bills keep the
    // exact previous DTO shape.
    const snapshot = require('./lines').linesDTO(visit);
    return { locationId: id(visit.location), sessionId: id(visit), state: 'open', version: visit.version, lineVersion: visit.lineVersion, lines: snapshot.lines, ...(snapshot.courses?.length ? { courses: snapshot.courses } : {}) };
  }
  const order = await Order.findOne({ _id: visit.billOrder, tenant: args.tenantId, venueBillForSession: visit._id }).lean();
  if (!order) fail('BILL_LINK_CONFLICT');
  const dto = billDTO(order, visit);
  if (dto.state === 'payment_pending') {
    const attempt = await require('../../models/VenuePaymentAttempt').findOne({ tenant: args.tenantId, session: visit._id, billOrder: order._id, method: 'paystack', state: 'pending' }).select('+authorizationUrl').lean();
    if (attempt?.authorizationUrl?.startsWith('https://')) dto.authorizationUrl = attempt.authorizationUrl;
  }
  return dto;
}
async function ensureIndexes() { await require('../../models/VenueStockEffect').createIndexes(); await Order.createIndexes(); }
module.exports = { ensureBillOrder, getBill, billDTO, billTotals, ensureIndexes };
