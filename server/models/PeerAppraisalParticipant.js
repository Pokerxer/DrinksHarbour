const mongoose = require('mongoose');
const { Schema } = mongoose;
const money = { type: Number, min: 0, validate: Number.isSafeInteger };
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  displayName: { type: String, required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  allocationMinor: { ...money, required: true },
  isAppraiser: { type: Boolean, default: true },
  reviewRevision: { type: Number, default: 0 },
  submittedAt: Date,
  result: { type: new Schema({ averageScore: Number, ratingCount: Number, bonusMinor: money, composite: { type: new Schema({ appraisalScore: Number, examScore: Number, attendanceScore: Number, combinedScore: Number, attendanceMonth: String, attendanceFrom: String, attendanceTo: String, calculatedAt: Date }, { _id: false }), default: undefined } }, { _id: false }), default: undefined },
}, { timestamps: true });
schema.index({ tenant: 1, cycle: 1, employee: 1 }, { unique: true });
module.exports = mongoose.model('PeerAppraisalParticipant', schema);
