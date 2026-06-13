const mongoose = require('mongoose');
const { Schema } = mongoose;

const meetingSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: { type: String, trim: true },
    attendees: [{ type: String }],
    status: {
      type: String,
      enum: ['scheduled', 'done', 'cancelled'],
      default: 'scheduled',
    },
    notes: { type: String, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Meeting', meetingSchema);
