// server/services/adCampaign.service.js
// Self-serve sponsored-placement campaigns (phase 2 merchandising, Part B).
// Tenant scoping is JWT-authoritative: every query carries the tenant filter
// (Workstream B — never a bare findById). Activation is gated on the prepaid
// ad wallet by agreement (docs/memory/selling-price-markup.md): a campaign
// can never spend money the tenant has not loaded.
//
// Mock-friendliness note (same reasoning as merchandisingPairing.service.js):
// queries avoid .lean()/.populate() chains and pass sort via the options
// object, so tests can mock the model methods with plain objects/arrays.
// The wallet seam is reached through module.exports.getWalletSafe — a thin
// wrapper over the adWallet SERVICE — so callers mock the service, not the
// models underneath it (same interception pattern as merchandising.service.js).
const AdCampaign = require('../models/AdCampaign');
const Product = require('../models/Product');
const { CPC_TARIFF_NGN } = require('../config/ads');
const { ValidationError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const adWalletService = require('./adWallet.service');

const VALID_SURFACES = ['pdp', 'cart'];
const isMongoId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
const todayKey = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' (UTC)

// ─── create ──────────────────────────────────────────────────────────────────

const createCampaign = async (tenantId, userId, payload = {}) => {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) throw new ValidationError('Campaign name is required');
  if (name.length > 120) throw new ValidationError('Campaign name must be 120 characters or fewer');
  if (!isMongoId(payload.product)) throw new ValidationError('A valid product is required');

  const surfaces = payload.surfaces;
  if (
    !Array.isArray(surfaces) || surfaces.length < 1 ||
    surfaces.some((s) => !VALID_SURFACES.includes(s)) ||
    new Set(surfaces).size !== surfaces.length
  ) {
    throw new ValidationError(`Surfaces must be a non-empty subset of: ${VALID_SURFACES.join(', ')}`);
  }

  const { dailyBudget } = payload;
  if (!Number.isInteger(dailyBudget) || dailyBudget < CPC_TARIFF_NGN) {
    throw new ValidationError(`Daily budget must be a positive integer of at least the CPC tariff (NGN ${CPC_TARIFF_NGN})`);
  }

  const startsAt = payload.startsAt ? new Date(payload.startsAt) : new Date();
  if (Number.isNaN(startsAt.getTime())) throw new ValidationError('Invalid start date');
  let endsAt;
  if (payload.endsAt) {
    endsAt = new Date(payload.endsAt);
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
      throw new ValidationError('End date must be in the future');
    }
  }

  // Existence is re-verified server-side — the central Product catalog is the
  // single source of truth; a campaign points at a real product.
  const productKnown = await Product.countDocuments({ _id: payload.product });
  if (productKnown !== 1) throw new ValidationError('Unknown product in campaign');

  return AdCampaign.create({
    tenant: tenantId,
    name,
    product: payload.product,
    surfaces,
    status: 'draft',
    dailyBudget,
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    createdBy: userId || undefined,
  });
};

// ─── on-read sweep (expiry / daily cap / daily rollover) ─────────────────────

// Sweeps one campaign row and PERSISTS any stale state with a single
// updateOne (tenant-scoped). Returns the swept view of the row whether or
// not a write was needed. Order of precedence:
//   1. endsAt past          → 'expired' (terminal, wins over everything)
//   2. daily cap reached    → 'budget_exhausted' (only while active AND the
//                             counter belongs to TODAY — a stale counter
//                             means today's spend is zero, not exhausted)
//   3. stale spentDay       → reset spentToday=0, spentDay=today
const sweepCampaignRow = async (tenantId, row) => {
  if (!row) return row;
  const today = todayKey();
  const $set = {};

  if (row.endsAt && new Date(row.endsAt).getTime() <= Date.now() && row.status !== 'expired') {
    $set.status = 'expired';
  } else if (
    row.status === 'active' &&
    row.spentDay === today &&
    row.spentToday >= row.dailyBudget
  ) {
    $set.status = 'budget_exhausted';
  }

  if (row.spentDay !== today) {
    $set.spentToday = 0;
    $set.spentDay = today;
  }

  if (!Object.keys($set).length) return row;

  await AdCampaign.updateOne({ _id: row._id, tenant: tenantId }, { $set });
  return { ...row, ...$set };
};

// ─── reads ───────────────────────────────────────────────────────────────────

const listCampaigns = async (tenantId) => {
  const rows = await AdCampaign.find({ tenant: tenantId }, null, { sort: { createdAt: -1 } });
  const swept = [];
  for (const row of rows) swept.push(await module.exports.sweepCampaignRow(tenantId, row));
  return swept;
};

// ─── status transitions ──────────────────────────────────────────────────────

const activateCampaign = async (tenantId, id) => {
  if (!isMongoId(id)) throw new ValidationError('Invalid campaign ID');
  const row = await AdCampaign.findOne({ _id: id, tenant: tenantId });
  if (!row) throw new NotFoundError('Campaign not found');

  const swept = await module.exports.sweepCampaignRow(tenantId, row);
  if (swept.status === 'expired') {
    throw new ConflictError('Campaign has expired and cannot be activated');
  }
  if (swept.status === 'suspended') {
    throw new ForbiddenError('Campaign is suspended by the platform');
  }

  // Prepaid-only: no wallet money, no campaign. The wallet balance is read
  // through the service wrapper so callers can mock the service seam.
  const wallet = await module.exports.getWalletSafe(tenantId);
  if ((wallet?.balance ?? 0) < CPC_TARIFF_NGN) {
    throw new ConflictError('Load your ad wallet to activate');
  }

  // A fresh day resets the cap, so yesterday's 'budget_exhausted' is
  // re-activatable; today's is not until the budget is raised or the day
  // rolls over (the click pipeline re-checks both gates per click anyway).
  const stillExhausted =
    swept.status === 'budget_exhausted' &&
    swept.spentDay === todayKey() &&
    swept.spentToday >= swept.dailyBudget;
  if (stillExhausted) {
    throw new ConflictError('Daily budget is exhausted for today — raise the daily budget to reactivate');
  }

  return AdCampaign.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: { status: 'active' } },
    { new: true }
  );
};

const pauseCampaign = async (tenantId, id) => {
  if (!isMongoId(id)) throw new ValidationError('Invalid campaign ID');
  const row = await AdCampaign.findOne({ _id: id, tenant: tenantId });
  if (!row) throw new NotFoundError('Campaign not found');
  if (row.status !== 'active') {
    throw new ValidationError('Only an active campaign can be paused');
  }
  return AdCampaign.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: { status: 'paused' } },
    { new: true }
  );
};

const updateCampaignStatus = async (tenantId, id, status) => {
  if (status === 'active') return module.exports.activateCampaign(tenantId, id);
  if (status === 'paused') return module.exports.pauseCampaign(tenantId, id);
  throw new ValidationError("Status must be 'active' or 'paused'");
};

const deleteCampaign = async (tenantId, id) => {
  if (!isMongoId(id)) throw new ValidationError('Invalid campaign ID');
  const row = await AdCampaign.findOne({ _id: id, tenant: tenantId });
  if (!row) throw new NotFoundError('Campaign not found');

  // Sweep first: an active campaign whose day ended is expired, not active,
  // and deletable without a pause.
  const swept = await module.exports.sweepCampaignRow(tenantId, row);
  if (swept.status === 'active') {
    throw new ConflictError('Pause the campaign before deleting it');
  }
  return AdCampaign.findOneAndDelete({ _id: id, tenant: tenantId });
};

// ─── summary (dashboard overview) ────────────────────────────────────────────

const getCampaignSummary = async (tenantId) => {
  const campaigns = await module.exports.listCampaigns(tenantId);
  const wallet = await module.exports.getWalletSafe(tenantId);
  return {
    balance: wallet?.balance ?? 0,
    // The client renders budget helper text from the tariff — it is a
    // platform pricing decision surfaced verbatim, never a "market rate".
    cpcTariff: CPC_TARIFF_NGN,
    campaigns,
  };
};

module.exports = {
  createCampaign,
  activateCampaign,
  pauseCampaign,
  updateCampaignStatus,
  deleteCampaign,
  listCampaigns,
  sweepCampaignRow,
  getCampaignSummary,
  // Thin wrapper (see header): kept on module.exports so tests can mock
  // either this wrapper or the adWallet service beneath it.
  getWalletSafe: (tenantId) => adWalletService.getWallet(tenantId),
};
