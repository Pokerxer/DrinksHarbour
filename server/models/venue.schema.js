'use strict';
const { Schema } = require('mongoose');
const terms = new Schema({ version: { type: Number, default: 1 }, platformRateBps: { type: Number, default: 900, enum: [900] }, directRateBps: { type: Number, default: 0, enum: [0] }, effectiveAt: { type: Date, default: null } }, { _id: false });
const settings = new Schema({ accountingClosedThrough: { type: Date, default: null }, legacyPublicGrantedAt: { type: Date, default: null }, publicListed: { type: Boolean, default: false }, requestBookingsEnabled: { type: Boolean, default: false }, identityVersion: { type: Number, enum: [0, 1], default: 0 }, commercialTerms: { type: terms, default: () => ({}) } }, { _id: false });
const services = new Schema({
  catalogCosting: { type: require('./venue-costing.schema').catalogCosting, default: () => ({}) },
  enabled: { type: Boolean, default: false }, canonicalCheckoutEnabled: { type: Boolean, default: false },
  capabilities: [{ type: String, enum: ['tables', 'tabs', 'preparation', 'request_bookings', 'events'] }],
  timezone: { type: String, default: 'Africa/Lagos', validate: v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } } },
  businessDayStartMinutes: { type: Number, min: 0, max: 1439, default: 240, validate: Number.isInteger },
  // Phase-4 E3: the waitlist offer's acceptance deadline in minutes (bounded
  // hold: the offer claims real capacity until this deadline). Default 15; the
  // service re-bounds any stored value to 1..240 and falls back to 15.
  waitlistOfferMinutes: { type: Number, min: 1, max: 240, default: 15, validate: Number.isInteger },
  reviewedAt: { type: Date, default: null },
}, { _id: false });
module.exports = { settings, services, terms };
