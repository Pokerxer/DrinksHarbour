'use strict';
const Review = require('../../../models/MerchantCarrierReview');
const { platform } = require('../localDispatch/review'),
  { hash, exact } = require('./scope');
const { ValidationError, ConflictError } = require('../../../utils/errors');
async function reviewCarrier(input, actor) {
  platform(actor);
  exact(input, [
    'tenant',
    'location',
    'version',
    'account',
    'categoryId',
    'allowedServices',
    'capabilities',
    'maxWeightGrams',
    'maxUnits',
    'reviewReference',
    'validUntil',
  ]);
  if (
    !['tenant', 'location'].every((k) => /^[a-f0-9]{24}$/i.test(input[k] || '')) ||
    !['version', 'categoryId', 'maxWeightGrams', 'maxUnits'].every(
      (k) => Number.isSafeInteger(input[k]) && input[k] > 0,
    ) ||
    !/^[A-Z][A-Z0-9_]{0,59}$/.test(input.account || '') ||
    typeof input.reviewReference !== 'string' ||
    input.reviewReference.trim().length < 5 ||
    input.reviewReference.length > 500 ||
    !Number.isFinite(Date.parse(input.validUntil)) ||
    new Date(input.validUntil) <= new Date()
  )
    throw new ValidationError('Complete explicit carrier capability review required');
  exact(input.capabilities, ['alcohol', 'ageVerification', 'fragile']);
  if (
    ['alcohol', 'ageVerification', 'fragile'].some(
      (k) => typeof input.capabilities[k] !== 'boolean',
    ) ||
    (input.capabilities.alcohol && !input.capabilities.ageVerification)
  )
    throw new ValidationError(
      'Explicit alcohol, age verification and fragile capability evidence required',
    );
  if (
    !Array.isArray(input.allowedServices) ||
    !input.allowedServices.length ||
    input.allowedServices.length > 30
  )
    throw new ValidationError('Explicit courier and service review required');
  for (const pair of input.allowedServices) {
    exact(pair, ['courierId', 'serviceCode']);
    if (
      typeof pair.courierId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(pair.courierId) ||
      typeof pair.serviceCode !== 'string' ||
      !pair.serviceCode ||
      pair.serviceCode.length > 100
    )
      throw new ValidationError('Explicit courier/service identity required');
  }
  const session = await require('mongoose').startSession();
  let row;
  try {
    await session.withTransaction(async () => {
      const origin = await require('../../../models/Warehouse').updateOne(
        { _id: input.location, tenant: input.tenant, isActive: true },
        { $inc: { __v: 1 } },
        { session },
      );
      if (origin.matchedCount !== 1)
        throw new ConflictError('Reviewed origin ownership unavailable');
      const latest = await Review.findOne({ tenant: input.tenant, location: input.location })
        .sort({ version: -1 })
        .session(session)
        .lean();
      if (latest && latest.version >= input.version)
        throw new ConflictError('Newer immutable carrier review version required');
      [row] = await Review.create(
        [
          {
            _id: hash([input.tenant, input.location, input.version]),
            ...input,
            status: 'reviewed',
            reviewedBy: actor._id,
          },
        ],
        { session },
      );
      await require('../../merchantFulfillment/access').audit(
        row,
        actor,
        'CARRIER_CAPABILITY_REVIEWED',
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return reviewDTO(row);
}
const reviewDTO = (r) => ({
  _id: String(r._id),
  version: Number.isSafeInteger(r.version) ? r.version : null,
  status: ['reviewed', 'revoked'].includes(r.status) ? r.status : 'unavailable',
  validUntil: r.validUntil instanceof Date ? r.validUntil : null,
  capabilities: Object.fromEntries(
    ['alcohol', 'ageVerification', 'fragile'].map((k) => [k, r.capabilities?.[k] === true]),
  ),
  allowedServices: (Array.isArray(r.allowedServices) ? r.allowedServices : [])
    .filter((p) => typeof p?.courierId === 'string' && typeof p?.serviceCode === 'string')
    .map((p) => ({ courierId: p.courierId, serviceCode: p.serviceCode })),
});
async function current(child, session) {
  const r = await Review.findOne({ tenant: child.tenant, location: child.location })
    .sort({ version: -1 })
    .session(session || null)
    .lean();
  if (!r || r.status !== 'reviewed' || r.validUntil <= new Date())
    throw new ConflictError('Current reviewed carrier account and capability required');
  return r;
}
async function revokeReview(id, actor) {
  platform(actor);
  const session = await require('mongoose').startSession();
  let row;
  try {
    await session.withTransaction(async () => {
      row = await Review.findOne({ _id: id }).session(session);
      if (!row) throw new ConflictError('Carrier review unavailable');
      if (row.status === 'revoked') return;
      await require('../../../models/Warehouse').updateOne(
        { _id: row.location, tenant: row.tenant },
        { $inc: { __v: 1 } },
        { session },
      );
      row.status = 'revoked';
      row.revokedBy = actor._id;
      row.revokedAt = new Date();
      await row.save({ session });
      await require('../../merchantFulfillment/access').audit(
        row,
        actor,
        'CARRIER_CAPABILITY_REVOKED',
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return reviewDTO(row);
}
module.exports = { reviewCarrier, current, reviewDTO, revokeReview };
