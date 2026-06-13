const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    tenant:      { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendor:      { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    title:       { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, maxlength: 3000 },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'done', 'cancelled'],
      default: 'todo',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    dueDate:    { type: Date, index: true },
    assignedTo: { type: String, trim: true },
    tags:       [{ type: String, trim: true }],
    notes:      { type: String, maxlength: 3000 },
    completedAt: { type: Date },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-stamp completedAt when status flips to done
taskSchema.pre('save', async function () {
  if (this.isModified('status')) {
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done') {
      this.completedAt = undefined;
    }
  }
});

module.exports = mongoose.model('Task', taskSchema);
