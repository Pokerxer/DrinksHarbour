// server/services/adClick.service.js
// The public CPC click pipeline (phase 2 merchandising, Part B). This is a
// MONEY PATH — prepaid-only by agreement (docs/memory/selling-price-markup.md):
// a click is charged exactly once, exactly the configured tariff, and never
// out of money the tenant has not loaded. The WALLET owns the money: the
// debit goes through module.exports.debitForClickSafe →
// adWallet.service.debitForClick, whose atomic filter-guard on
// Tenant.adWalletBalance IS the concurrency control (no re-implemented
// balance check here); this pipeline only refuses or bills.
//
// Ordered refusal/bill matrix implemented by recordClick:
//   1. unknown campaign (or unresolvable product slug) → 'not_found'
//   2. endsAt past            → persist 'expired',      refuse 'expired'
//      stored status ≠ active → refuse with that status (paused, draft,
//                                budget_exhausted, suspended, expired)
//   3. stale spentDay         → persist spentToday=0, spentDay=today
//   4. dailyBudget - spentToday < tariff
//                             → persist 'budget_exhausted', refuse it
//   5. AdClickDedupe E11000   → refuse 'duplicate' (NOT billed)
//   6. wallet debit refused   → persist 'paused', refuse 'insufficient_balance'
//   7. success                → $inc clicksTotal/spentToday/spentTotal,
//                                $set spentDay, return redirect target
//
// Mock-friendliness (same reasoning as adCampaign.service.js): the campaign
// load is a plain findById().populate().lean() chain tests can stub, and the
// wallet seam is reached only through the module.exports wrapper.
const crypto = require('node:crypto');
const AdCampaign = require('../models/AdCampaign');
const AdClickDedupe = require('../models/AdClickDedupe');
const { CPC_TARIFF_NGN } = require('../config/ads');
const adWalletService = require('./adWallet.service');

const isMongoId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
const todayKey = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' (UTC)

// Stable fallback visitor key: a sha256 hex slice of the caller IP — not
// identity, just dedupe. No new dependencies.
const hashVisitorKey = (ip) =>
  crypto.createHash('sha256').update(String(ip || 'anonymous')).digest('hex').slice(0, 32);

const refuse = (reason) => ({ ok: false, reason });

// ─── clicks: dedupe → debit → counters ───────────────────────────────────────

const recordClick = async (campaignId, visitorKey, ip) => {
  if (!isMongoId(campaignId)) return refuse('not_found');

  // 1. Load the campaign with the product slug — the redirect target. A
  //    campaign whose product cannot resolve is unusable; refuse before any
  //    dedupe row or money moves.
  const campaign = await AdCampaign.findById(campaignId)
    .populate('product', 'slug')
    .lean();
  if (!campaign || !campaign.product?.slug) return refuse('not_found');

  const today = todayKey();

  // 2. Sweep. Expiry wins (an ended campaign is expired even if the row
  //    still says 'active'); any other non-active status refuses as-is.
  if (campaign.endsAt && new Date(campaign.endsAt).getTime() <= Date.now()) {
    if (campaign.status !== 'expired') {
      await AdCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'expired' } });
    }
    return refuse('expired');
  }
  if (campaign.status !== 'active') return refuse(campaign.status);

  // 3. Daily rollover: a stale counter belongs to yesterday — today's spend
  //    is zero, so reset it (persisted) before any budget judgement.
  let spentToday = campaign.spentToday ?? 0;
  if (campaign.spentDay !== today) {
    spentToday = 0;
    await AdCampaign.updateOne(
      { _id: campaign._id },
      { $set: { spentToday: 0, spentDay: today } }
    );
  }

  // 4. Daily cap: refuse BEFORE dedupe/billing — no spend beyond the cap,
  //    and persist the exhaustion so the dashboard reflects it.
  if ((campaign.dailyBudget ?? 0) - spentToday < CPC_TARIFF_NGN) {
    await AdCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: 'budget_exhausted' } }
    );
    return refuse('budget_exhausted');
  }

  // 5. Dedupe BEFORE billing: one charge per visitor per campaign per day.
  //    The unique index { campaign, visitorKey, day } is the gate — an
  //    E11000 on insert means "already clicked today", which is a refusal,
  //    not a bill.
  try {
    await AdClickDedupe.create({
      campaign: campaign._id,
      visitorKey: visitorKey || hashVisitorKey(ip),
      day: today,
    });
  } catch (err) {
    if (err?.code === 11000 || String(err?.message || '').includes('E11000')) {
      return refuse('duplicate');
    }
    throw err;
  }

  // 6. Money: the wallet service owns the balance (atomic filter-guard
  //    debit + ledger append). Wallet-empty is NOT budget exhaustion — the
  //    campaign pauses so the tenant reactivates it after a top-up.
  const debit = await module.exports.debitForClickSafe(campaign.tenant, campaign._id, CPC_TARIFF_NGN);
  if (!debit?.ok) {
    await AdCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: 'paused' } }
    );
    return refuse(debit?.reason || 'insufficient_balance');
  }

  // 7. Bill the campaign counters and hand back the redirect target.
  await AdCampaign.updateOne(
    { _id: campaign._id },
    {
      $inc: { clicksTotal: 1, spentToday: CPC_TARIFF_NGN, spentTotal: CPC_TARIFF_NGN },
      $set: { spentDay: today },
    }
  );
  return {
    ok: true,
    redirect: `/product/${campaign.product.slug}`,
    campaignId: campaign._id.toString(),
  };
};

// ─── impressions: fire-and-forget counter, never rejects ─────────────────────

const recordImpression = (campaignId) =>
  Promise.resolve(
    AdCampaign.updateOne({ _id: campaignId }, { $inc: { impressionsTotal: 1 } })
  ).catch(() => {}); // counting must never take down the request path

module.exports = {
  recordClick,
  recordImpression,
  hashVisitorKey,
  // Thin wrapper (see header): kept on module.exports so tests can mock
  // either this wrapper or the adWallet service beneath it — the wallet
  // service owns the money; callers must not re-implement balance checks.
  debitForClickSafe: (tenantId, campaignId, tariff) =>
    adWalletService.debitForClick(tenantId, campaignId, tariff),
};
