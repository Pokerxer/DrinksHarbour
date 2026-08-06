const mongoose = require('mongoose');
const { Schema } = mongoose;

// One answer covers all six template question types, which is why the numeric
// and the textual field are both optional and neither is a discriminator:
//
//   rating | likert | scale -> `rating`   (ordinal, 1..scaleMax)
//   yes_no                  -> `rating`   (1 = yes, 0 = no)
//   choice                  -> `selected` (always an array, even single-select)
//   text                    -> `text`
//
// `selected` holds option LABELS rather than indices deliberately: a template
// is copy-on-write versioned (see AppraisalTemplate), but an HR user editing a
// still-unlaunched template can reorder options in place, and an index stored
// against the old order would silently start meaning a different option.
const answerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    rating: { type: Number, min: 0, max: 10 },
    text: { type: String, trim: true, maxlength: 5000 },
    // maxlength matches AppraisalTemplate's option maxlength — a stored answer
    // can never be longer than the option it was chosen from.
    selected: [{ type: String, trim: true, maxlength: 200 }],
  },
  { _id: false }
);

const appraisalFeedbackSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    appraisal: { type: Schema.Types.ObjectId, ref: 'Appraisal', required: true, index: true },
    // Denormalised so cycle-wide completion stats are a count, not a join.
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['self', 'manager', 'peer'], required: true },
    answers: [answerSchema],
    status: {
      type: String,
      // 'declined' is deliberately distinct from 'expired': a manager who can
      // tell "refused" from "went quiet" can backfill a replacement in time.
      enum: ['pending', 'submitted', 'expired', 'declined'],
      default: 'pending',
      index: true,
    },
    submittedAt: { type: Date },
    declinedAt: { type: Date },
    declineReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

appraisalFeedbackSchema.index({ appraisal: 1, reviewer: 1 }, { unique: true });
appraisalFeedbackSchema.index({ tenant: 1, reviewer: 1, status: 1 });
// What the denormalised `cycle` field exists for: cycleProgress counts every
// row in a cycle and then the submitted ones, and closeCycle expires every
// still-pending row in one updateMany. All three are (tenant, cycle[, status])
// over a whole cycle's worth of feedback — the widest scan in the module.
appraisalFeedbackSchema.index({ tenant: 1, cycle: 1, status: 1 });

module.exports = mongoose.model('AppraisalFeedback', appraisalFeedbackSchema);
