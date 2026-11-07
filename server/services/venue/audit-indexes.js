'use strict';
const RETENTION_SECONDS = 2555 * 24 * 60 * 60;
// Readiness only: serving migration is separately reviewed and never automatic.
const { SERVING_MODEL_INDEXES, previewServingIndexes } = require('./serving-indexes');
function planAuditIndexes(indexes) {
  const rows = indexes.filter(row => Object.keys(row.key || {}).length === 1 && row.key.timestamp === 1);
  if (rows.length > 1 || rows.some(row => row.unique || row.sparse || row.partialFilterExpression)) {
    return { status: 'blocked', actions: [], blockers: ['Ambiguous or specialised timestamp indexes require manual review'] };
  }
  const row = rows[0];
  if (row?.expireAfterSeconds === RETENTION_SECONDS) return { status: 'ready', actions: [], blockers: [] };
  return { status: 'review_required', actions: [{ type: row ? 'collMod' : 'createIndex', index: row?.name || 'timestamp_1', expireAfterSeconds: RETENTION_SECONDS }],
    blockers: ['TTL conversion can delete expired audit records; review retention and take a verified backup before apply'] };
}

// S2 recipe/pour collections — readiness planning + ensure. Mirrors money-indexes preview/apply
// shape (db injected, no model imports). Uniqueness must bite at service time, so ops call
// applyRecipeModelIndexes before the first write of these collections.
const RECIPE_MODEL_INDEXES = [
  { model: 'IngredientProfile', collection: 'ingredientprofiles', key: { tenant: 1, subProduct: 1 }, unique: true },
  { model: 'RecipeVersion', collection: 'recipeversions', key: { tenant: 1, 'output.subProduct': 1, 'output.size': 1, version: 1 }, unique: true },
  { model: 'OpenedBottle', collection: 'openedbottles', key: { tenant: 1, location: 1, 'source.subProduct': 1, 'source.size': 1, state: 1 }, unique: false },
  { model: 'VenueConsumptionEvent', collection: 'venueconsumptionevents', key: { tenant: 1, effectKey: 1 }, unique: true },
  { model: 'VenueWasteEvent', collection: 'venuewasteevents', key: { tenant: 1, location: 1, createdAt: -1 }, unique: false },
];

// S3 preparation/preset collections — same readiness + ensure pattern as the recipe list.
const PREP_MODEL_INDEXES = [
  { model: 'VenueServicePreset', collection: 'venueservicepresets', key: { tenant: 1, location: 1, name: 1 }, unique: true },
  { model: 'PreparationStation', collection: 'preparationstations', key: { tenant: 1, location: 1, name: 1 }, unique: true },
  { model: 'VenuePreparationItem', collection: 'venuepreparationitems', key: { tenant: 1, lineId: 1, revision: 1 }, unique: true },
];

// S4 print jobs — jobId is unique PER TENANT (format `pj:<hex>`); the poll query
// filters {tenant, deviceId, deliveryState} so it gets its own (non-unique) index.
const PRINT_MODEL_INDEXES = [
  { model: 'PreparationPrintJob', collection: 'preparationprintjobs', key: { tenant: 1, jobId: 1 }, unique: true },
  { model: 'PreparationPrintJob', collection: 'preparationprintjobs', key: { tenant: 1, deviceId: 1, deliveryState: 1 }, unique: false },
];

// Phase-4 E1 event occurrences — same readiness + ensure pattern as the prep list.
// Unique {tenant, location, eventSlug, occurrenceDate} must bite at service time; the
// query index serves the date-range listing (newest service date first per location).
const EVENT_MODEL_INDEXES = [
  { model: 'VenueEventOccurrence', collection: 'venueeventoccurrences', key: { tenant: 1, location: 1, eventSlug: 1, occurrenceDate: 1 }, unique: true },
  { model: 'VenueEventOccurrence', collection: 'venueeventoccurrences', key: { tenant: 1, location: 1, occurrenceDate: -1, publication: 1 }, unique: false },
];

// Phase-4 E2 guest lists — one request per phone per occurrence; the listing rides
// the location/occurrence/state filter (+ insertion-order scan).
const GUESTLIST_MODEL_INDEXES = [
  { model: 'VenueEventGuestList', collection: 'venueeventguestlists', key: { tenant: 1, occurrence: 1, phone: 1 }, unique: true },
  { model: 'VenueEventGuestList', collection: 'venueeventguestlists', key: { tenant: 1, location: 1, occurrence: 1, state: 1 }, unique: false },
];

// Phase-4 E2 admissions ledger. The entry-row uniqueness is a PARTIAL unique index
// (kind 'entry' only) so re-entry rows may repeat the token; the options object is
// carried through applyModelIndexes verbatim.
const ADMISSION_MODEL_INDEXES = [
  { model: 'VenueAdmissionEntitlement', collection: 'venueadmissionentitlements', key: { tenant: 1, 'tokens.token': 1 }, unique: true },
  { model: 'VenueAdmissionEntitlement', collection: 'venueadmissionentitlements', key: { tenant: 1, occurrence: 1, sourceRef: 1 }, unique: false },
  { model: 'VenueAdmissionRedemption', collection: 'venueadmissionredemptions', key: { tenant: 1, token: 1 }, unique: true, options: { partialFilterExpression: { kind: 'entry' } } },
  { model: 'VenueAdmissionRedemption', collection: 'venueadmissionredemptions', key: { tenant: 1, occurrence: 1, _id: -1 }, unique: false },
];

// Phase-4 E2 VIP host alerts — persistence idempotency rides the unique
// {tenant, redemptionRef}; the host listing rides the occurrence recency index.
const HOST_ALERT_MODEL_INDEXES = [
  { model: 'VenueHostAlert', collection: 'venuehostalerts', key: { tenant: 1, redemptionRef: 1 }, unique: true },
  { model: 'VenueHostAlert', collection: 'venuehostalerts', key: { tenant: 1, occurrence: 1, createdAt: -1 }, unique: false },
];

// Phase-4 E3 waitlist entries — unique phone per scope (NON-sparse compound:
// occurrence defaults to null so location-scoped rows group together — see the
// model header); the queue listing rides the state filter; the expiry sweep
// looks up the offered entry by its claim.
const WAITLIST_MODEL_INDEXES = [
  { model: 'VenueWaitlistEntry', collection: 'venuewaitlistentries', key: { tenant: 1, location: 1, occurrence: 1, phone: 1 }, unique: true },
  { model: 'VenueWaitlistEntry', collection: 'venuewaitlistentries', key: { tenant: 1, location: 1, state: 1 }, unique: false },
  { model: 'VenueWaitlistEntry', collection: 'venuewaitlistentries', key: { tenant: 1, 'offer.claimRef': 1, state: 1 }, unique: false },
];

// Phase-4 E4 packages — unique {tenant, location, name} must bite at service
// time; the active listing sorts by name; commitments list newest-first per
// location; redemptions are unique per commitment+component+sequence (the
// served-quantity ledger) and listed by commitment.
const PACKAGE_MODEL_INDEXES = [
  { model: 'VenueEventPackage', collection: 'venueeventpackages', key: { tenant: 1, location: 1, name: 1 }, unique: true },
  { model: 'VenueEventPackage', collection: 'venueeventpackages', key: { tenant: 1, location: 1, active: 1, name: 1 }, unique: false },
  { model: 'VenuePackageCommitment', collection: 'venuepackagecommitments', key: { tenant: 1, location: 1, _id: -1 }, unique: false },
  { model: 'VenuePackageRedemption', collection: 'venuepackageredemptions', key: { tenant: 1, commitment: 1, componentIndex: 1, sequence: 1 }, unique: true },
  { model: 'VenuePackageRedemption', collection: 'venuepackageredemptions', key: { tenant: 1, commitment: 1 }, unique: false },
];

function describeModelIndex(row) {
  return `${Object.entries(row.key).map(([field, dir]) => `${field}_${dir}`).join('_')}${row.unique ? '_unique' : ''}`;
}

async function previewModelIndexes(db, rows) {
  const result = [];
  for (const row of rows) {
    const collection = db.collection(row.collection);
    const exists = await db.listCollections({ name: row.collection }).hasNext();
    const indexes = exists ? await collection.listIndexes().toArray() : [];
    const name = describeModelIndex(row);
    const missing = indexes.some(index => JSON.stringify(index.key) === JSON.stringify(row.key))
      ? []
      : [name];
    result.push({ model: row.model, unique: row.unique, existing: indexes.map(index => index.name), missing });
  }
  return result;
}

async function applyModelIndexes(db, rows) {
  const preview = await previewModelIndexes(db, rows);
  for (const row of preview) {
    for (const name of row.missing) {
      const definition = rows.find(item => describeModelIndex(item) === name);
      const options = { ...(definition.options || {}), ...(definition.unique ? { unique: true } : {}) };
      await db.collection(definition.collection).createIndex(definition.key, options);
    }
  }
  return previewModelIndexes(db, rows);
}

// S2-named seams preserved verbatim (existing callers/tests), now delegating to the
// generalized core so the S3 prep collections need no forked logic.
const describeRecipeModelIndex = describeModelIndex;
const previewRecipeModelIndexes = db => previewModelIndexes(db, RECIPE_MODEL_INDEXES);
async function applyRecipeModelIndexes(db) { return applyModelIndexes(db, RECIPE_MODEL_INDEXES); }
const previewPrepModelIndexes = db => previewModelIndexes(db, PREP_MODEL_INDEXES);
async function applyPrepModelIndexes(db) { return applyModelIndexes(db, PREP_MODEL_INDEXES); }
const previewPrintModelIndexes = db => previewModelIndexes(db, PRINT_MODEL_INDEXES);
async function applyPrintModelIndexes(db) { return applyModelIndexes(db, PRINT_MODEL_INDEXES); }
const previewEventModelIndexes = db => previewModelIndexes(db, EVENT_MODEL_INDEXES);
async function applyEventModelIndexes(db) { return applyModelIndexes(db, EVENT_MODEL_INDEXES); }
const previewGuestListModelIndexes = db => previewModelIndexes(db, GUESTLIST_MODEL_INDEXES);
async function applyGuestListModelIndexes(db) { return applyModelIndexes(db, GUESTLIST_MODEL_INDEXES); }
const previewAdmissionModelIndexes = db => previewModelIndexes(db, ADMISSION_MODEL_INDEXES);
async function applyAdmissionModelIndexes(db) { return applyModelIndexes(db, ADMISSION_MODEL_INDEXES); }
const previewHostAlertModelIndexes = db => previewModelIndexes(db, HOST_ALERT_MODEL_INDEXES);
async function applyHostAlertModelIndexes(db) { return applyModelIndexes(db, HOST_ALERT_MODEL_INDEXES); }
const previewWaitlistModelIndexes = db => previewModelIndexes(db, WAITLIST_MODEL_INDEXES);
async function applyWaitlistModelIndexes(db) { return applyModelIndexes(db, WAITLIST_MODEL_INDEXES); }
const previewPackageModelIndexes = db => previewModelIndexes(db, PACKAGE_MODEL_INDEXES);
async function applyPackageModelIndexes(db) { return applyModelIndexes(db, PACKAGE_MODEL_INDEXES); }

module.exports = { SERVING_MODEL_INDEXES, previewServingIndexes, planAuditIndexes, RETENTION_SECONDS, RECIPE_MODEL_INDEXES, PREP_MODEL_INDEXES, PRINT_MODEL_INDEXES, EVENT_MODEL_INDEXES, GUESTLIST_MODEL_INDEXES, ADMISSION_MODEL_INDEXES, HOST_ALERT_MODEL_INDEXES, WAITLIST_MODEL_INDEXES, PACKAGE_MODEL_INDEXES, describeModelIndex, previewModelIndexes, applyModelIndexes, describeRecipeModelIndex, previewRecipeModelIndexes, applyRecipeModelIndexes, previewPrepModelIndexes, applyPrepModelIndexes, previewPrintModelIndexes, applyPrintModelIndexes, previewEventModelIndexes, applyEventModelIndexes, previewGuestListModelIndexes, applyGuestListModelIndexes, previewAdmissionModelIndexes, applyAdmissionModelIndexes, previewHostAlertModelIndexes, applyHostAlertModelIndexes, previewWaitlistModelIndexes, applyWaitlistModelIndexes, previewPackageModelIndexes, applyPackageModelIndexes };
