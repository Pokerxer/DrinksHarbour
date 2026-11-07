'use strict';
const asyncHandler = require('../utils/asyncHandler');
const capacity = require('../services/venue/capacity');
const { enabled } = require('../services/venue/capacity-bookings');
const { id } = require('../services/venue/eligibility');
const { validateKey } = require('../services/venue/operations');
function staffRoutes(router, args, send) {
  router.get('/staff/locations/:locationId/capacity',asyncHandler(async(req,res)=>{enabled();const context=args(req);await require('../services/venue/context').loadVenueContext({...context,action:'experience.manage'});const row=await require('../models/VenueCapacityPolicy').findOne({tenant:context.tenantId,location:context.locationId}).select('version enabled timezone resources combinations windows durationMinutes bufferBeforeMinutes bufferAfterMinutes holdSeconds financialPolicyVersion').lean();send(res,row||null);}));
  router.put('/staff/locations/:locationId/capacity', require('../middleware/venue-rate-limit.middleware').staffConfigurations, asyncHandler(async (req, res) => {
    enabled();
    send(res, await capacity.savePolicy({ ...args(req), input: req.body.input, expectedVersion: req.body.expectedVersion, idempotencyKey: validateKey(req.get('Idempotency-Key')) }));
  }));
  router.get('/staff/locations/:locationId/capacity/availability', asyncHandler(async (req, res) => {
    enabled(); send(res, await capacity.availability({ ...args(req), bookingAt: req.query.bookingAt, partySize: Number(req.query.partySize) }));
  }));
}
function publicRoutes(router, send) {
  router.get('/public/:slug/:locationSlug/availability', asyncHandler(async (req, res) => {
    enabled();
    const context = await require('../services/venue/public-experience').publicLocation({ ...req.params, request: true });
    const result = await capacity.readAvailability({ tenantId: id(context.tenant), locationId: id(context.location), bookingAt: req.query.bookingAt, partySize: Number(req.query.partySize) });
    send(res, { policyVersion: result.policyVersion, timezone: result.timezone, durationMinutes: result.durationMinutes, asOf: result.asOf, available: result.options.length > 0, bookingMode: 'request', message: 'Availability may change. A request requires staff acceptance.' });
  }));
}
module.exports = { staffRoutes, publicRoutes };
