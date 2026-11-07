'use strict';
const Quote = require('../../../models/MerchantCarrierQuote'),
  transport = require('./transport'),
  protocol = require('./protocol');
const { load, enabled, exact, hash } = require('./scope'),
  { current } = require('./review'),
  { ConflictError, ValidationError } = require('../../../utils/errors');
const quoteDTO = (r) => ({
  _id: String(r._id),
  allocationId: r.allocationId,
  rates: r.rates.map((x) => ({
    courierId: x.courierId,
    serviceCode: x.serviceCode,
    name: x.name,
    amountMinor: x.amountMinor,
    displayMinor: x.displayMinor,
  })),
  currency: 'NGN',
  expiresAt: r.expiresAt,
});
async function quoteCarrier(childId, input, actor) {
  enabled();
  exact(input, ['allocationId', 'dimensions', 'pickupDate']);
  exact(input.dimensions, ['length', 'width', 'height']);
  if (
    ['length', 'width', 'height'].some(
      (k) =>
        !Number.isFinite(input.dimensions[k]) ||
        input.dimensions[k] <= 0 ||
        input.dimensions[k] > 300,
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate || '') ||
    !Number.isFinite(Date.parse(input.pickupDate)) ||
    new Date(input.pickupDate) <= new Date() ||
    new Date(input.pickupDate) > new Date(Date.now() + 6 * 86400000)
  )
    throw new ValidationError(
      'Measured package centimetres and future pickup date within six days required',
    );
  const loaded = await load(childId, input.allocationId, actor),
    review = await current(loaded.child),
    req = loaded.snapshot.requirements;
  if (
    req.weightGrams > review.maxWeightGrams ||
    req.units > review.maxUnits ||
    ['alcohol', 'ageVerification', 'fragile'].some((k) => req[k] && !review.capabilities[k])
  )
    throw new ConflictError('Basket exceeds reviewed carrier capability');
  const budget = await require('../../../models/MerchantDispatchBudget').findById(childId).lean(),
    remaining =
      loaded.child.shippingMinor - (budget?.reservedMinor || 0) - (budget?.committedMinor || 0);
  const codes = [];
  for (const address of [loaded.snapshot.sender, loaded.snapshot.receiver]) {
    const result = await transport.request(review.account, '/shipping/address/validate', address);
    if (
      result?.country_code !== 'NG' ||
      !Number.isSafeInteger(result.address_code) ||
      result.address_code < 1 ||
      typeof result.formatted_address !== 'string' ||
      !result.formatted_address
    )
      throw new ConflictError('Carrier validated Nigerian address evidence required');
    codes.push({ code: result.address_code, address: result.formatted_address });
  }
  const items = [];
  for (const item of loaded.snapshot.items) {
    const product = await require('../../../models/Product').findById(item.product).lean(),
      size = await require('../../../models/Size').findById(item.size).lean();
    if (!Number.isSafeInteger(item.amountMinor))
      throw new ConflictError('Exact package item minor amount unavailable');
    items.push({
      name: product.name,
      description: product.name,
      unit_weight: size.shippingWeight / 1000,
      unit_amount: item.amountMinor / 100,
      quantity: item.quantity,
    });
  }
  const raw = await transport.request(review.account, '/shipping/fetch_rates', {
    sender_address_code: codes[0].code,
    reciever_address_code: codes[1].code,
    pickup_date: input.pickupDate,
    category_id: review.categoryId,
    package_items: items,
    package_dimension: input.dimensions,
    service_type: 'pickup',
  });
  const parsed = protocol.rates(raw, review.allowedServices, remaining);
  if (!parsed.rates.length)
    throw new ConflictError('No reviewed carrier rate within accepted shipping budget');
  const snapshot = {
    ...loaded.snapshot,
    codes,
    dimensions: input.dimensions,
    pickupDate: input.pickupDate,
  };
  const row = await Quote.create({
    merchantOrder: childId,
    order: loaded.child.order,
    tenant: loaded.child.tenant,
    location: loaded.child.location,
    allocationId: input.allocationId,
    review: review._id,
    account: review.account,
    scopeHash: loaded.scopeHash,
    snapshot,
    requestToken: parsed.requestToken,
    rates: parsed.rates,
    expiresAt: new Date(Math.min(Date.now() + 900000, review.validUntil.getTime())),
    createdBy: actor._id,
  });
  await require('../../merchantFulfillment/access').audit(row, actor, 'CARRIER_QUOTE_CREATED');
  return quoteDTO(row);
}
module.exports = { quoteCarrier, quoteDTO };
