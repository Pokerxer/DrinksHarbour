'use strict';
// services/venue/consumptions.js — consumption ledger at fire (S2, spec §5).
//
// Coordination rules (S2 task contract, must stay true for every caller):
// 1. Recipe-bearing outputs (an active RecipeVersion exists for the output):
//    consumption is a LEDGER event only. Components are consumed exactly as the
//    stored recipe states — NO ml→bottle netting at fire time. Each event item
//    claims the profile's stock form `{subProduct, size, profile}` with the
//    component quantity/unit AS STORED (per serving); `size` is the profile
//    SubProduct's `defaultSize` — the tenant must verify the profile's stock
//    form. The tenant's component stock movement belongs to later surfaces.
// 2. Pour lines (the published menu item carries `pourMl`): the ledger event
//    claims `pourMl × pendingQuantity` ml from the bar's opened-bottle stock.
//    In S2's automation path the SAME fire transaction drains that ml from the
//    OLDEST open bottles (FIFO, spread across bottles) through
//    pour-stock.pourAt, so stock and ledger can never drift. Manual, per-bottle
//    pours continue to route through pour-stock.js (`pour`).
//    If the open bottles cannot cover the claim, fire FAILS STOCK_UNAVAILABLE
//    and firedQuantity must NOT advance (the whole operation aborts): the bar
//    must open a bottle explicitly (`stock.open`) first.
// 3. Sealed lines (no pourMl, no active recipe): NO event, nothing changes —
//    the existing bill-time reserve/consume path owns their stock; the
//    settlement adapter (inventory.js) skips lines that DO have an event.
// 4. Precedence: an explicit serving measure (`pourMl`) beats an active recipe
//    for the same output — the bar pours from open bottles when the menu says
//    the item is a pour.
// 5. Idempotency: effectKey `fire:<visit>:<lineId>:<revision>` (unique per
//    tenant) is the belt; `firedQuantity` is the brace. An operation replay
//    that reaches an existing effectKey is treated as already-consumed (mongo
//    duplicate-key code 11000): no second event is written, no bottle is
//    drained again, and fire continues.

const ConsumptionEvent = require('../../models/VenueConsumptionEvent');
const OpenedBottle = require('../../models/OpenedBottle');
const IngredientProfile = require('../../models/IngredientProfile');
const SubProduct = require('../../models/SubProduct');
const { resolveActiveVersion } = require('./recipes');
const { pourAt } = require('./pour-stock');
const { fail } = require('./errors');
const { id } = require('./eligibility');

const lower = value => `${String(value)}`.toLowerCase();
const effectKeyOf = (visit, line) => `fire:${id(visit)}:${line.lineId}:${line.revision}`;

// Returns true when the event was created; false when the effectKey already
// exists (already consumed — the ledger is immutable and unique per tenant).
// The pre-check matters: inserting a key that already exists in COMMITTED state
// makes the unique index conflict manifest as a persistent WriteConflict (the
// transaction retry loop never converges), so detection must be a read first;
// the duplicate-key catch remains the in-transaction race belt.
async function createEvent(doc, mongoSession) {
  const existing = await ConsumptionEvent.findOne({ tenant: doc.tenant, effectKey: doc.effectKey }).select('_id').session(mongoSession).lean();
  if (existing) return false;
  try { await ConsumptionEvent.create([doc], { session: mongoSession }); }
  catch (error) { if (error && error.code === 11000) return false; throw error; }
  return true;
}

// Drain `ml` from the location's open bottles of this output, FIFO oldest-first,
// spreading across bottles (the sum must cover the claim — guarded before any
// move). Reuses the pour flow's guarded decrement + exhaustion transition.
async function drainOpenedBottles({ tenantId, locationId, line, ml, mongoSession }) {
  const bottles = await OpenedBottle.find({ tenant: tenantId, location: locationId,
    'source.subProduct': id(line.subproduct), 'source.size': id(line.size), state: 'open' })
    .sort({ openedAt: 1, _id: 1 }).session(mongoSession);
  const available = bottles.reduce((sum, bottle) => sum + bottle.remainingMl, 0);
  if (available < ml) fail('STOCK_UNAVAILABLE', `${available} ml left in open bottles — open a new bottle to fire this pour`);
  let left = ml;
  for (const bottle of bottles) {
    if (left <= 0) break;
    const take = Math.min(left, bottle.remainingMl);
    if (take > 0) { await pourAt({ tenantId, locationId, openedBottleId: id(bottle), ml: take, mongoSession }); left -= take; }
  }
}

// One event per pending fired line-step. `lines` are the visit's pending
// acceptedLines subdocs (fires only when quantity > firedQuantity).
async function applyConsumption({ tenantId, locationId, visit, lines, menuIndex, actor, mongoSession }) {
  for (const line of lines) {
    const pending = line.quantity - (line.firedQuantity || 0);
    if (pending < 1) continue;
    if (line.servingSnapshot?.mode === 'sealed') continue;
    if (line.servingSnapshot) {
      if (!['made_to_order','prepared_batch'].includes(line.servingSnapshot.mode)) fail('COST_MODE_UNSUPPORTED', 'This serving mode needs its reviewed physical stock adapter', 503);
      const physicalIssue = line.servingSnapshot.mode === 'prepared_batch' ? require('./prepared-stock').issuePrepared : require('./recipe-stock').issueRecipe;
      await physicalIssue({ tenantId, locationId, visit, line, fireDelta: pending, acceptedRecipeVersionId: id(line.acceptedRecipeVersionId), actor, mongoSession, effectKey: `fire:${id(visit)}:${line.lineId}:${line.revision}:${line.firedQuantity || 0}:${line.quantity}` });
      if (!line.frozenRecipeVersion) { const recipe = await require('../../models/RecipeVersion').findOne({ _id: line.acceptedRecipeVersionId, tenant: tenantId }).session(mongoSession).lean(); line.frozenRecipeVersion = { version: recipe.version, recipe: recipe._id }; }
      continue;
    }
    const menuItem = menuIndex ? menuIndex.get(`${lower(line.subproduct)}:${lower(line.size)}`) : null;
    if (menuItem && menuItem.pourMl !== undefined) {
      const created = await createEvent({ tenant: tenantId, location: locationId, session: id(visit), billOrder: id(visit.heldOrder),
        lineId: line.lineId, revision: line.revision, effectKey: effectKeyOf(visit, line), kind: 'poured',
        items: [{ subProduct: line.subproduct, size: line.size, quantity: menuItem.pourMl * pending, unit: 'ml' }], actor: actor.userId }, mongoSession);
      if (created) await drainOpenedBottles({ tenantId, locationId, line, ml: menuItem.pourMl * pending, mongoSession });
      continue;
    }
    const version = await resolveActiveVersion(tenantId, { subProduct: line.subproduct, size: line.size }, mongoSession);
    if (!version) continue; // sealed service — the bill-time path owns the stock
    const components = version.components || [];
    const profileIds = [...new Set(components.map(component => String(component.profile)))];
    const profiles = await IngredientProfile.find({ tenant: tenantId, _id: { $in: profileIds } }).session(mongoSession).lean();
    if (profiles.length !== profileIds.length) fail('NOT_FOUND', 'Ingredient profile not found', 404);
    const subRows = await SubProduct.find({ _id: { $in: profiles.map(profile => profile.subProduct) }, tenant: tenantId }).select('defaultSize').session(mongoSession).lean();
    const sizeOfSub = new Map(subRows.map(row => [String(row._id), row.defaultSize]));
    const items = components.map(component => {
      const profile = profiles.find(row => String(row._id) === String(component.profile));
      const size = sizeOfSub.get(String(profile.subProduct));
      if (!size) fail('NOT_FOUND', 'Ingredient profile stock form unavailable', 404);
      return { subProduct: profile.subProduct, size, profile: profile._id, quantity: component.quantity, unit: component.unit };
    });
    await createEvent({ tenant: tenantId, location: locationId, session: id(visit), billOrder: id(visit.heldOrder),
      lineId: line.lineId, revision: line.revision, effectKey: effectKeyOf(visit, line), kind: 'recipe',
      recipeVersion: version._id, recipeCostMinor: version.costMinorPerUnit == null ? null : version.costMinorPerUnit * pending,
      items, actor: actor.userId }, mongoSession);
    // Freeze the consumed recipe version onto the session line (S3 kitchen reads
    // it). Never rewrite an existing freeze — a replay may resolve the same
    // version; uniqueness above decides consumption once.
    if (!line.frozenRecipeVersion) line.frozenRecipeVersion = { version: version.version, recipe: version._id };
  }
}

module.exports = { applyConsumption };
