'use strict';
// services/venue/presets.js — server-owned service presets (S3 Task 2, spec §2/§3).
//
// A preset is a location's service policy: allowed service modes (dine-in |
// counter_pickup ONLY — delivery is forbidden in S3), opening hours in the exact
// profile-hours shape (validated through experience-validation's shared validators —
// this module never re-implements the interval semantics), required guest fields,
// payment timing, and OPAQUE refs (priceListRef/taxContextRef — stored verbatim, there
// is NO price or tax math anywhere in this module). prepSlotPolicy is recorded only;
// slot enforcement is Phase 5.
//
// Fail codes raised here:
// - PRESET_CLOSED (409): the preset publishes no hours for the requested service time
//   (empty hours never open), a closed exception covers the local date, or the local
//   time falls outside every applicable window (overnight rows spill past midnight).
// - INVALID_INPUT (400): bad shape, forbidden mode, missing required guest fields,
//   duplicate preset name at the location.
// - NOT_FOUND (404): preset unknown in the tenant or not at the addressed location.
//
// Sessions snapshot {presetId, version, serviceMode} ONCE at creation (see
// service-sessions.ensureServiceSession); the visit schema marks those paths immutable.
//
// Eligibility: preset config is experience configuration, so CRUD reuses the existing
// ACTIONS — 'experience.manage' for writes, 'experience.read' for the listing. No new
// eligibility ACTIONS were added in Task 2 (courses/stations actions land in Tasks 3–4).

const Preset = require('../../models/VenueServicePreset');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { keys, text, list, validateHours } = require('./experience-validation');

const MODES = ['dine-in', 'counter_pickup'];
const GUEST_FIELDS = ['name', 'phone', 'partySize'];

function presetDTO(input) {
  // Mongoose subdoc arrays (hours/exceptions) must not be spread directly — a Document
  // spread copies internal machinery (and its parent chain). Normalize docs to plains.
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), name: row.name,
    allowedModes: [...(row.allowedModes || [])], hours: (row.hours || []).map(hour => ({ ...hour })),
    exceptions: (row.exceptions || []).map(exception => ({ ...exception })),
    requiredGuestFields: [...(row.requiredGuestFields || [])],
    paymentTiming: row.paymentTiming,
    priceListRef: row.priceListRef == null ? null : row.priceListRef,
    taxContextRef: row.taxContextRef == null ? null : row.taxContextRef,
    prepSlotPolicy: row.prepSlotPolicy ? { maxConcurrent: row.prepSlotPolicy.maxConcurrent, leadMins: row.prepSlotPolicy.leadMins } : null,
    version: row.version, createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

function opaqueRef(value, name) {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 200) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return value.trim();
}

// hours/exceptions ride experience-validation's profile-hours validators verbatim
// (weekday rows {day,opens,closes,overnight?}, date exceptions with closed|window).
function presetInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Preset input is required', 400);
  keys(raw, ['name', 'allowedModes', 'hours', 'exceptions', 'requiredGuestFields', 'paymentTiming', 'priceListRef', 'taxContextRef', 'prepSlotPolicy']);
  const name = text(raw.name, 'preset name', 120);
  const modes = list(raw.allowedModes, 2);
  if (!modes.length || new Set(modes).size !== modes.length || modes.some(mode => !MODES.includes(mode))) {
    fail('INVALID_INPUT', 'allowedModes accepts dine-in or counter_pickup only; delivery is not offered', 400);
  }
  const { hours, exceptions } = validateHours(raw.hours, raw.exceptions || []);
  const guestFields = raw.requiredGuestFields == null ? [] : list(raw.requiredGuestFields, 3);
  if (new Set(guestFields).size !== guestFields.length || guestFields.some(field => !GUEST_FIELDS.includes(field))) {
    fail('INVALID_INPUT', 'requiredGuestFields accepts name, phone or partySize', 400);
  }
  if (!['deferred', 'per_order'].includes(raw.paymentTiming)) fail('INVALID_INPUT', 'paymentTiming is deferred or per_order', 400);
  let prepSlotPolicy = null;
  if (raw.prepSlotPolicy != null) {
    keys(raw.prepSlotPolicy, ['maxConcurrent', 'leadMins']);
    if (!Number.isInteger(raw.prepSlotPolicy.maxConcurrent) || raw.prepSlotPolicy.maxConcurrent < 1) fail('INVALID_INPUT', 'prepSlotPolicy.maxConcurrent is a whole number >= 1', 400);
    if (!Number.isInteger(raw.prepSlotPolicy.leadMins) || raw.prepSlotPolicy.leadMins < 0) fail('INVALID_INPUT', 'prepSlotPolicy.leadMins is a whole number >= 0', 400);
    prepSlotPolicy = { maxConcurrent: raw.prepSlotPolicy.maxConcurrent, leadMins: raw.prepSlotPolicy.leadMins };
  }
  return { name, allowedModes: modes, hours, exceptions, requiredGuestFields: guestFields, paymentTiming: raw.paymentTiming,
    priceListRef: opaqueRef(raw.priceListRef, 'priceListRef'), taxContextRef: opaqueRef(raw.taxContextRef, 'taxContextRef'), prepSlotPolicy };
}

function minutesOfDay(hhmm) { const [hour, minute] = hhmm.split(':').map(Number); return hour * 60 + minute; }
function windowCovers(row, minutes) {
  const opens = minutesOfDay(row.opens), closes = minutesOfDay(row.closes);
  if (row.overnight === true && closes <= opens) return minutes >= opens || minutes < closes;
  return minutes >= opens && minutes < closes;
}
// PRESET_CLOSED semantics: a preset with no published hours never opens; a closed
// exception for the local date closes the day; an open exception replaces the weekday
// rows for that date; otherwise the weekday rows (plus yesterday's midnight-spanning
// overnight rows) decide — same interval semantics experience-validation enforces.
function assertPresetOpen(hours, exceptions, at, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map(part => [part.type, part.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const exception = (exceptions || []).find(row => row.date === date);
  if (exception) {
    if (exception.closed) fail('PRESET_CLOSED', 'This service preset is closed on that date', 409);
    if (windowCovers(exception, minutes)) return;
    fail('PRESET_CLOSED', 'This service preset is closed at that time', 409);
  }
  const rows = hours || [];
  if (rows.length === 0) fail('PRESET_CLOSED', 'This service preset publishes no service hours', 409);
  const yesterday = (weekday + 6) % 7;
  const spansMidnight = rows.some(row => row.day === yesterday && row.overnight === true && minutesOfDay(row.closes) <= minutesOfDay(row.opens));
  if (rows.some(row => row.day === weekday && windowCovers(row, minutes))
    || (spansMidnight && rows.some(row => row.day === yesterday && minutes < minutesOfDay(row.closes)))) return;
  fail('PRESET_CLOSED', 'This service preset is closed at that time', 409);
}

function validateGuest(guest, requiredFields) {
  const provided = guest && typeof guest === 'object' && !Array.isArray(guest) ? guest : null;
  for (const field of requiredFields || []) {
    const value = provided ? provided[field] : undefined;
    if (field === 'partySize') {
      if (!Number.isInteger(value) || value < 1 || value > 100) fail('INVALID_INPUT', 'guest.partySize is required by this service preset', 400);
    } else text(value == null ? '' : value, `guest.${field}`, field === 'phone' ? 40 : 120);
  }
}

async function assertUniqueName(tenantId, locationId, name, excludeId, mongoSession) {
  const query = { tenant: tenantId, location: locationId, name };
  if (excludeId) query._id = { $ne: excludeId };
  const duplicate = await Preset.findOne(query).session(mongoSession).lean();
  if (duplicate) fail('INVALID_INPUT', 'A service preset with this name already exists at this location', 400);
}

// Create (or replay) a preset under runVenueOperation idempotency; version starts 0.
async function createPreset(args) {
  const input = presetInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'experience.manage' });
  return runVenueOperation({
    targetType: 'VenueServicePreset', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'preset.create', key: args.idempotencyKey, payload: { input },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'experience.manage', mongoSession });
      await assertUniqueName(args.tenantId, args.locationId, input.name, null, mongoSession);
      const [row] = await Preset.create([{ tenant: args.tenantId, location: args.locationId, createdBy: context.actor.userId, version: 0, ...input }], { session: mongoSession });
      return presetDTO(row);
    },
  });
}

// Versioned update: expectedVersion is the caller's view (optimistic, like venue
// configurations); drift fails STATE_CHANGED and every success bumps version by 1.
async function updatePreset(args) {
  requireId(args.presetId);
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Preset version required; reload before saving');
  const input = presetInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'experience.manage' });
  return runVenueOperation({
    targetType: 'VenueServicePreset', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'preset.update', key: args.idempotencyKey, payload: { presetId: args.presetId, expectedVersion: args.expectedVersion, input },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'experience.manage', mongoSession });
      const preset = await Preset.findOne({ _id: args.presetId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!preset) fail('NOT_FOUND', 'Service preset not found', 404);
      if (preset.version !== args.expectedVersion) fail('STATE_CHANGED', 'Preset changed elsewhere; reload before saving');
      await assertUniqueName(args.tenantId, args.locationId, input.name, args.presetId, mongoSession);
      Object.assign(preset, input, { version: args.expectedVersion + 1 });
      await preset.save({ session: mongoSession });
      return presetDTO(preset);
    },
  });
}

async function listPresets(args) {
  await loadVenueContext({ ...args, action: 'experience.read' });
  const rows = await Preset.find({ tenant: args.tenantId, location: args.locationId }).sort({ name: 1 }).lean();
  return { items: rows.map(presetDTO) };
}

// Snapshot resolution for session create/open (additive: presetId + serviceMode travel
// together; without them the visit keeps the legacy shape). Location match, mode ∈
// allowedModes, hours window open at the requested service time, and the preset's
// required guest fields are all enforced here — any failure rejects session creation.
async function resolveForSession({ tenantId, locationId, presetId, serviceMode, guest, now, timezone }, mongoSession) {
  if (!presetId && !serviceMode) return null;
  if (!presetId || !serviceMode) fail('INVALID_INPUT', 'presetId and serviceMode are required together', 400);
  requireId(presetId);
  const preset = await Preset.findOne({ _id: presetId, tenant: tenantId }).session(mongoSession).lean();
  if (!preset || id(preset.location) !== locationId) fail('NOT_FOUND', 'Service preset not found at this location', 404);
  if (!preset.allowedModes.includes(serviceMode)) fail('INVALID_INPUT', 'serviceMode is not offered by this service preset', 400);
  assertPresetOpen(preset.hours, preset.exceptions, now, timezone);
  validateGuest(guest, preset.requiredGuestFields);
  return { presetId: preset._id, version: preset.version, serviceMode };
}

module.exports = { createPreset, updatePreset, listPresets, resolveForSession, assertPresetOpen, presetDTO };
