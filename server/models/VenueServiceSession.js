'use strict';
const mongoose = require('mongoose'); const { Schema } = mongoose;
const ref = name => ({ type: Schema.Types.ObjectId, ref: name });
const line = new Schema({
  lineId: { type: String, required: true }, revision: { type: Number, required: true },
  product: ref('Product'), subproduct: ref('SubProduct'), size: ref('Size'), name: String,
  quantity: { type: Number, required: true, min: 1 }, unitPriceMinor: Number, netMinor: Number, taxRate: Number, taxMinor: Number,
  costMinor: Number, acceptedAt: Date, priceRule: Schema.Types.Mixed, firedQuantity: { type: Number, default: 0 },
  note: String, choiceKey: String, choices: [{ groupId: String, optionId: String, quantity: Number }], // Phase 3 S1: frozen modifier selections (additive, no defaults)
  servingSnapshot: Schema.Types.Mixed, menuConfigVersion: Number, menuItemId: String, categoryId: String,
  acceptedRecipeVersionId: ref('RecipeVersion'), choiceSnapshots: {type:[Schema.Types.Mixed],default:undefined},
  // Phase 3 S2 Task 5: recipe version frozen at fire (additive, optional; pour/sealed
  // lines stay without it). S3 kitchen surfaces read this during course handoff.
  frozenRecipeVersion: new Schema({ version: Number, recipe: { type: Schema.Types.ObjectId, ref: 'RecipeVersion' } }, { _id: false }),
  // Phase 3 S3: course membership — free-form short id, reassignable while unfired,
  // frozen at fire like the other line fields.
  courseId: { type: String, maxlength: 50 },
}, { _id: false });
const schema = new Schema({
  tenant: { ...ref('Tenant'), required: true }, location: { ...ref('Warehouse'), required: true }, createdBy: { ...ref('User'), required: true },
  booking: ref('Booking'), heldOrder: ref('Order'), billOrder: ref('Order'), posSessionId: ref('POSSession'), posShopId: { type: String, immutable: true }, posShopName: { type: String, immutable: true }, terminalType: { type: String, immutable: true }, tableIds: [ref('POSTable')],
  businessDate: { type: String, required: true }, timezone: { type: String, required: true }, businessDayStartMinutes: Number,
  state: { type: String, enum: ['open', 'closing', 'closed', 'needs_review'], default: 'open' },
  version: { type: Number, default: 0 }, identityVersion: { type: Number, default: 1, enum: [1] },
  openedAt: { type: Date, required: true, immutable: true }, closedAt: Date,
  entitlementAtOpen: { type: Schema.Types.Mixed, immutable: true }, termsAtOpen: { type: Schema.Types.Mixed, immutable: true },
  acquisition: { type: Schema.Types.Mixed, immutable: true }, acceptedLines: [line], lineVersion: { type: Number, default: 0 },
  // Phase 3 S3: dine-in/pickup context snapshot — written once at visit creation from the
  // server-owned service preset, immutable afterwards (spec §3: never mutated by customer
  // input). courses[] is the ordered course grouping (Task 3 owns its state machine).
  serviceMode: { type: String, enum: ['dine-in', 'counter_pickup'], immutable: true },
  presetRef: { type: new Schema({ presetId: { type: Schema.Types.ObjectId, ref: 'VenueServicePreset', required: true }, version: { type: Number, required: true, min: 0 } }, { _id: false }), immutable: true },
  courses: [{ courseId: { type: String, required: true }, name: String, order: Number, state: { type: String, enum: ['planned', 'hold', 'fired'], default: 'planned' } }],
  // Phase 3 S6: party grouping is OPERATIONAL ONLY — an opaque group id shared by
  // the group's visits (additive, optional). Immutable per group join (services/
  // venue/parties.js refuses a second join); leaving is the explicit removal of
  // the whole field. Money/stock state is never merged through it.
  partyGroup: { type: new Schema({ groupId: { type: String, required: true }, joinedAt: { type: Date, required: true } }, { _id: false }) },
}, { timestamps: true, autoIndex: false });
for (const key of ['booking', 'heldOrder', 'billOrder']) schema.index({ tenant: 1, [key]: 1 }, { unique: true, partialFilterExpression: { [key]: { $type: 'objectId' } } });
schema.index({ tenant: 1, location: 1, state: 1 });
module.exports = mongoose.models.VenueServiceSession || mongoose.model('VenueServiceSession', schema);
