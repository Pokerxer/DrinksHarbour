const mongoose = require('mongoose');
const { Schema } = mongoose;
const question = new Schema({
  prompt: { type: String, required: true, maxlength: 500 },
  options: [{ type: String, required: true, maxlength: 300 }],
  marks: { type: Number, min: 1, max: 20, validate: Number.isInteger },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
  correctOption: { type: Number, required: true, min: 0, max: 5, validate: Number.isInteger },
});
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true },
  durationMinutes: { type: Number, min: 1, max: 240, validate: Number.isInteger },
  attendanceMonth: String,
  attendanceFrom: String,
  attendanceTo: String,
  questionsPerEmployee: { type: Number, min: 1, max: 100, validate: Number.isInteger },
  marksPerQuestion: { type: Number, default: 1, min: 1, max: 10, validate: Number.isInteger },
  recipientIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: undefined },
  departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
  questions: [question],
}, { timestamps: true });
schema.index({ tenant: 1, cycle: 1 }, { unique: true });
module.exports = mongoose.model('PeerAppraisalExam', schema);
