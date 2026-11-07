'use strict';
const access = require('../../merchantFulfillment/access'),
  { hash } = require('../scope');
const { ConflictError, ValidationError } = require('../../../utils/errors');
const sid = (v) => String(v?._id || v || '');
function enabled() {
  if (process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED !== 'true')
    throw new ConflictError('External carrier creation is disabled');
}
function exact(input, keys) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k))
  )
    throw new ValidationError('Unsupported carrier input');
}
function key(v) {
  if (typeof v !== 'string' || !v.trim() || v.length > 128)
    throw new ValidationError('Stable carrier operation key required');
}
function address(a, origin = false) {
  const contact = origin ? a.contact : a;
  const fields = {
    name: origin ? contact?.name : a?.fullName,
    email: contact?.email,
    phone: contact?.phone,
    address: [
      origin ? a.address?.line1 : a?.addressLine1,
      origin ? a.address?.line2 : a?.addressLine2,
      origin ? a.address?.city : a?.city,
      origin ? a.address?.state : a?.state,
      origin ? a.address?.country : a?.country,
    ]
      .filter(Boolean)
      .join(', '),
  };
  if (
    Object.values(fields).some((v) => typeof v !== 'string' || !v.trim() || v.length > 600) ||
    !['NG', 'Nigeria'].includes(origin ? a.address?.country : a?.country)
  )
    throw new ConflictError('Saved Nigerian origin and recipient contacts/address required');
  return fields;
}
async function load(childId, allocationId, actor, session) {
  const child = access.assertOwned(
    await require('../../../models/MerchantOrder')
      .findOne({ _id: childId, ...access.scope(actor, true) })
      .session(session || null)
      .lean(),
    actor,
    true,
  );
  const allocation = await require('../../../models/MerchantShipmentAllocation')
    .findOne({
      _id: allocationId,
      merchantOrder: childId,
      order: child.order,
      tenant: child.tenant,
      location: child.location,
      state: 'shipped',
    })
    .session(session || null)
    .lean();
  const parent = await require('../../../models/Order')
    .findOne({
      _id: child.order,
      merchantFulfillmentVersion: 2,
      settlementOwner: 'platform',
      currency: 'NGN',
      paymentStatus: { $in: ['paid', 'partially_refunded'] },
    })
    .session(session || null)
    .lean();
  if (
    !allocation ||
    allocation.dispatchBooking ||
    child.fulfillmentVersion !== 2 ||
    child.currency !== 'NGN' ||
    !parent?.user ||
    parent.integrationCheckout ||
    parent.source === 'pos' ||
    parent.venueIdentityVersion === 1 ||
    parent.tableServiceBooking ||
    !['standard', 'express', 'partner_delivery'].includes(parent.shippingMethod) ||
    (parent.channelSnapshot &&
      (parent.channelSnapshot.kind !== 'marketplace' ||
        parent.channelSnapshot.apiKey ||
        parent.channelSnapshot.storefrontChannel)) ||
    (!parent.channelSnapshot && parent.salesChannel && parent.salesChannel !== 'DRINKSHARBOUR_NG')
  )
    throw new ConflictError('Original shipped manual marketplace allocation required');
  await require('./authority').assertOriginal(child, parent, allocation, session);
  const origin = await require('../../../models/Warehouse')
    .findOne({ _id: child.location, tenant: child.tenant, isActive: true })
    .session(session || null)
    .lean();
  if (!origin) throw new ConflictError('Saved origin ownership required');
  const selected = allocation.lines.map((r) => ({ line: sid(r.line), quantity: r.quantity }));
  // Shipment already consumed these quantities. Validate product facts without applying unshipped availability checks.
  const requirements = await require('../localDispatch/quote').requirements(
    { ...child, quantityProgress: undefined },
    selected,
    session,
  );
  const items = selected.map((r) => {
    const line = child.lines.find((l) => sid(l.line) === r.line);
    return {
      line: r.line,
      product: sid(line.product),
      size: sid(line.size),
      quantity: r.quantity,
      amountMinor: line.merchandiseMinor / line.quantity,
    };
  });
  const snapshot = {
    merchantOrder: childId,
    allocationId,
    order: sid(child.order),
    tenant: sid(child.tenant),
    location: sid(child.location),
    customer: sid(parent.user),
    shippingMinor: child.shippingMinor,
    currency: 'NGN',
    allocation: allocation.lines,
    requirements,
    items,
    sender: address(origin, true),
    receiver: address(parent.shippingAddress),
    basketHash: hash(child.lines),
  };
  return { child, parent, allocation, snapshot, scopeHash: hash(snapshot) };
}
module.exports = { enabled, exact, key, load, hash, sid };
