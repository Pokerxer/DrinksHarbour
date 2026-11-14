// server/services/merchandisingPairing.service.js
// Tenant-configured manual upsell pairings. Tenant scoping is JWT-authoritative:
// every query carries the tenant filter (Workstream B — never a bare findById).
const MerchandisingPairing = require('../models/MerchandisingPairing');
const Product = require('../models/Product');
const { ValidationError, NotFoundError } = require('../utils/errors');

const isMongoId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

const listPairings = (tenantId) =>
  MerchandisingPairing.find({ tenant: tenantId })
    .populate('sourceProduct', 'name slug type images')
    .populate('suggestedProducts', 'name slug type images')
    .sort({ createdAt: -1 })
    .lean();

const upsertPairing = async (tenantId, userId, { sourceProduct, suggestedProducts, active }) => {
  if (!isMongoId(sourceProduct)) throw new ValidationError('Invalid source product ID');
  if (!Array.isArray(suggestedProducts) || suggestedProducts.length < 1 || suggestedProducts.length > 4) {
    throw new ValidationError('Suggested products must be 1–4 unique product references');
  }
  const clean = [...new Set(suggestedProducts)];
  if (clean.length !== suggestedProducts.length) {
    throw new ValidationError('Suggested products must be 1–4 unique product references');
  }
  if (clean.some((id) => !isMongoId(id))) throw new ValidationError('Invalid suggested product ID');
  if (clean.includes(sourceProduct)) {
    throw new ValidationError('Suggestions cannot include the source product');
  }

  // Existence is verified in two queries so a mock (or a real caller) can
  // distinguish an unknown source from unknown suggestions; both failures
  // surface the same caller-facing error.
  const sourceKnown = await Product.countDocuments({ _id: sourceProduct });
  if (sourceKnown !== 1) throw new ValidationError('Unknown product in pairing');
  const suggestionsKnown = await Product.countDocuments({ _id: { $in: clean } });
  if (suggestionsKnown !== clean.length) throw new ValidationError('Unknown product in pairing');

  // No .lean() here: the upsert row is handed straight back to the controller
  // and JSON-serialised, and callers (and tests) may mock the model with a
  // plain object, which has no lean() chain to await.
  return MerchandisingPairing.findOneAndUpdate(
    { tenant: tenantId, sourceProduct },
    {
      $set: {
        tenant: tenantId,
        sourceProduct,
        suggestedProducts: clean,
        active: active !== false,
        ...(userId ? { createdBy: userId } : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const deletePairing = async (tenantId, id) => {
  if (!isMongoId(id)) throw new ValidationError('Invalid pairing ID');
  const row = await MerchandisingPairing.findOneAndDelete({ _id: id, tenant: tenantId }).lean();
  if (!row) throw new NotFoundError('Pairing not found');
  return row;
};

const getActivePairing = (tenantId, sourceProductId) =>
  MerchandisingPairing.findOne({
    tenant: tenantId,
    sourceProduct: sourceProductId,
    active: true,
  }).lean();

module.exports = { listPairings, upsertPairing, deletePairing, getActivePairing };
