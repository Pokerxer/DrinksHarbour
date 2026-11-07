'use strict';
const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  state: { type: String, enum: ['draft', 'approved', 'retired'], default: 'draft' },
  approvedBy: Schema.Types.ObjectId, approvedAt: Date, decisionOwner: String, decisionReference: String,
  effectiveFrom: Date, effectiveUntil: Date, policyHash: String,
  currency: { type: String, enum: ['NGN'], required: true }, depositMinor: Number, paymentWindowSeconds: Number, minimumMinor: Number,
  cancellationTerms: String, noShowTerms: String, excessCreditTerms: String, refundAuthority: String, refundFunding: String,
  taxTreatment: String, eligibility: String, minimumTerms: String, excludedSubProducts: [Schema.Types.ObjectId],
  shortfallClassification: String, shortfallTaxRate: Number, shortfallTaxDecision: String,
  accounts: { advance: String, clearing: String, shortfall: String, shortfallTax: String },
  // S5 additive subdocs — absent/false means zero behavior change. Codes follow
  // the existing Account.code string discipline (not raw ObjectIds).
  serviceCharge: {
    enabled: { type: Boolean, default: false },
    rateBps: { type: Number }, // integer 1..5000; gated in service-charge.js
    appliesTo: { type: String, enum: ['merchandise_net', 'food_only'], default: 'merchandise_net' },
    taxable: { type: Boolean, default: true },
    taxDecision: String, // named approval, required when taxable is false
    countsTowardMinimum: { type: Boolean, default: false },
    accounts: { revenue: String, tax: String },
    displayLabel: { type: String }, // receipt label, ≤80 characters; gated in service-charge.js
  },
  gratuityAllocation: { // recorded-only policy input (Task 3); never executed here
    mode: { type: String, enum: ['none', 'staff', 'shift'], default: 'none' },
    defaultStaffIds: [Schema.Types.ObjectId],
    shiftPolicyRef: String,
  },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
schema.index({ tenant: 1, location: 1, version: 1 }, { unique: true });
// Approved snapshots are append-only. New commercial decisions get a new
// version; none of the model mutation paths may rewrite historical terms.
async function rejectApprovedMutation(filter,session){
 const row=await mongoose.models.VenueFinancialPolicy.exists({...filter,state:{$in:['approved','retired']}}).session(session||null);
 if(row)require('../services/venue/errors').fail('POLICY_VERSION_IMMUTABLE','Approved financial policies require a new version');
}
schema.pre('save',async function(){if(!this.isNew&&this.isModified())await rejectApprovedMutation({_id:this._id},this.$session());});
for(const operation of['updateOne','updateMany','findOneAndUpdate','replaceOne','findOneAndReplace','deleteOne','deleteMany','findOneAndDelete'])schema.pre(operation,async function(){await rejectApprovedMutation(this.getFilter(),this.getOptions().session);});
module.exports = model('VenueFinancialPolicy', schema);
