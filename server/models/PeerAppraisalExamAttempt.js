const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  questionIds: { type: [Schema.Types.ObjectId], default: undefined },
  marksPerQuestion: { type: Number, default: 1, min: 1, max: 10 },
  answers: [{ _id: false, question: { type: Schema.Types.ObjectId, required: true }, option: { type: Number, required: true, validate: Number.isInteger, min: 0, max: 5 } }],
  revision: { type: Number, default: 0 },
  durationMinutes: { type: Number, min: 1, max: 240 },
  startedAt: Date,
  expiresAt: Date,
  timedOut: Boolean,
  earnedMarks: Number,
  maxMarks: Number,
  submittedAt: Date,
  correctCount: Number,
  questionCount: Number,
}, { timestamps: true });
schema.index({ tenant: 1, cycle: 1, employee: 1 }, { unique: true });
module.exports = mongoose.model('PeerAppraisalExamAttempt', schema);
