'use strict';
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');
const args = (req) => ({
  tenantId: id(req.user.tenant),
  locationId: req.params.locationId,
  actor: venueActor(req),
});
const listArgs = (req) => ({ ...args(req), cursor: req.query.cursor, limit: req.query.limit });
const command = (req) => ({
  ...args(req),
  expectedVersion: req.body.expectedVersion,
  idempotencyKey: validateKey(req.get('Idempotency-Key')),
});
const send = (res, data, status = 200) =>
  res
    .set('Cache-Control', 'private, no-store')
    .status(status)
    .json({ success: true, data });
exports.readiness = async (req, res) => {
  const context =
    await require('../../services/venue/context').loadVenueContext({
      ...args(req),
      action: 'experience.manage',
    });
  const config = context.location.venueServices?.catalogCosting;
  send(res, {
    servingsEnabled:
      process.env.VENUE_SERVINGS_V2_ENABLED === 'true' &&
      config?.servingsV2Enabled === true,
    actualCostingEnabled:
      process.env.VENUE_ACTUAL_COSTING_ENABLED === 'true' &&
      config?.actualCostingEnabled === true,
    policyStatus: config?.policy?.state || 'not_configured',
    grants: context.actor.permissions.filter((value) =>
      value.startsWith('venue:'),
    ),
    supportedModes: ['made_to_order', 'prepared_batch'],
    packageStatus: 'awaiting_phase4_e4_e5',
  });
};
exports.servings = async (req, res) => send(res, await require('../../services/venue/catalog-costing-lists').listServings(listArgs(req)));
exports.saveServing = async (req, res) =>
  send(
    res,
    await require('../../services/venue/servings').saveServing({
      ...command(req),
      subProductId: req.body.subProductId,
      sizeId: req.params.sizeId,
      input: req.body.input,
    }),
    req.params.sizeId ? 200 : 201,
  );
exports.production = async (req, res) => send(res, await require('../../services/venue/catalog-costing-lists').listProduction(listArgs(req)));
exports.createProduction = async (req, res) =>
  send(
    res,
    await require('../../services/venue/production').createProduction({
      ...command(req),
      input: req.body.input,
    }),
    201,
  );
exports.reserveProduction = async (req, res) =>
  send(
    res,
    await require('../../services/venue/production').reserveProduction({
      ...command(req),
      batchId: req.params.id,
    }),
  );
exports.completeProduction = async (req, res) =>
  send(
    res,
    await require('../../services/venue/production').completeProduction({
      ...command(req),
      batchId: req.params.id,
      actualOutput: req.body.actualOutput,
      waste: req.body.waste,
    }),
  );
exports.cancelProduction = async (req, res) =>
  send(
    res,
    await require('../../services/venue/production').cancelProduction({
      ...command(req),
      batchId: req.params.id,
      reason: req.body.reason,
    }),
  );
exports.createCount = async (req, res) =>
  send(
    res,
    await require('../../services/venue/inventory-counts').createCount({
      ...command(req),
      input: req.body.input,
    }),
    201,
  );
exports.completeCount = async (req, res) =>
  send(
    res,
    await require('../../services/venue/inventory-counts').completeCount({
      ...command(req),
      countId: req.params.id,
    }),
  );
exports.margins = async (req, res) =>
  send(
    res,
    await require('../../services/venue/profitability').getMarginReport({
      ...args(req),
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      basis: req.query.basis,
      currency: req.query.currency,
      cursor: req.query.cursor,
      ...(req.query.limit !== undefined
        ? { limit: Number(req.query.limit) }
        : {}),
    }),
  );
exports.variance = async (req, res) =>
  send(
    res,
    await require('../../services/venue/usage-variance').getUsageVariance({
      ...args(req),
      openingCountId: req.query.openingCountId,
      closingCountId: req.query.closingCountId,
    }),
  );

exports.menu = async (req, res) => {
  const context =
    await require('../../services/venue/context').loadVenueContext({
      ...args(req),
      action: 'experience.read',
    });
  const config = await require('../../models/VenueLocationProfile')
    .findOne({ tenant: args(req).tenantId, location: req.params.locationId })
    .lean();
  send(
    res,
    await require('../../services/venue/experience').projectMenu(
      { ...context, config },
      config?.menu,
    ),
  );
};

exports.costCases = async (req, res) =>
  send(
    res,
    await require('../../services/venue/cost-review').listCostCases({
      ...args(req),
      cursor: req.query.cursor,
      ...(req.query.limit ? { limit: Number(req.query.limit) } : {}),
    }),
  );
exports.resolveCostCase = async (req, res) =>
  send(
    res,
    await require('../../services/venue/cost-review').resolveCostCase({
      ...command(req),
      caseId: req.params.id,
      evidence: req.body.evidence,
      reason: req.body.reason,
    }),
  );

exports.ingredientProfiles = async (req, res) =>
  send(
    res,
    await require('../../services/venue/ingredient-profiles').listProfiles(
      listArgs(req),
    ),
  );
exports.ingredientCandidates = async (req, res) =>
  send(
    res,
    await require('../../services/venue/ingredient-profiles').sourceCandidates(
      listArgs(req),
    ),
  );
exports.createIngredientProfile = async (req, res) =>
  send(
    res,
    await require('../../services/venue/ingredient-profiles').createProfile({
      ...command(req),
      input: req.body.input,
    }),
    201,
  );

exports.receiptSources = async (req, res) =>
  send(
    res,
    await require('../../services/venue/receipt-valuation').listReceiptSources(
      { ...args(req), lotsCursor: req.query.lotsCursor, receiptsCursor: req.query.receiptsCursor, limit: req.query.limit },
    ),
  );
exports.linkReceiptValue = async (req, res) =>
  send(
    res,
    await require('../../services/venue/receipt-valuation').linkReceiptValue({
      ...command(req),
      batchId: req.params.id,
      input: req.body.input,
    }),
  );
