// models/Notification.js

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const notificationSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'new_product_pending',
        'product_approved',
        'product_rejected',
        'new_tenant_registration',
        'tenant_subscription_expiring',
        'low_stock_alert',
        'new_order',
        'order_status_update',
        'payment_received',
        'system_alert',
        'general',
      ],
      index: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    shortMessage: {
      type: String,
      maxlength: 500,
    },

    product: {
      type: ObjectId,
      ref: 'Product',
      sparse: true,
    },

    subProduct: {
      type: ObjectId,
      ref: 'SubProduct',
      sparse: true,
    },

    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      sparse: true,
    },

    user: {
      type: ObjectId,
      ref: 'User',
      sparse: true,
    },

    recipient: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },

    recipients: [{
      type: ObjectId,
      ref: 'User',
    }],

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
    },

    readBy: [{
      user: { type: ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    }],

    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },

    actionUrl: {
      type: String,
      maxlength: 500,
    },

    actionLabel: {
      type: String,
      maxlength: 100,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
    },

    emailError: {
      type: String,
    },

    scheduledFor: {
      type: Date,
    },

    expiresAt: {
      type: Date,
      index: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    archivedAt: {
      type: Date,
    },

    createdBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ tenant: 1, isRead: 1 });
notificationSchema.index({ product: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

notificationSchema.virtual('timeAgo').get(function () {
  const now = new Date();
  const created = this.createdAt;
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return created.toLocaleDateString();
});

notificationSchema.methods.markAsRead = async function (userId) {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    this.readBy.push({ user: userId, readAt: new Date() });
    await this.save();
  }
  return this;
};

notificationSchema.statics.markAllAsRead = async function (recipientId, notificationIds) {
  return this.updateMany(
    { _id: { $in: notificationIds }, recipient: recipientId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

notificationSchema.statics.getUnreadCount = async function (recipientId) {
  return this.countDocuments({ recipient: recipientId, isRead: false, isArchived: false });
};

notificationSchema.statics.getNotifications = async function (recipientId, options = {}) {
  const { page = 1, limit = 20, type, unreadOnly = false } = options;
  const skip = (page - 1) * limit;

  const query = { recipient: recipientId, isArchived: false };
  
  if (type) {
    query.type = type;
  }
  
  if (unreadOnly) {
    query.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('product', 'name slug images')
      .populate('tenant', 'name slug')
      .populate('user', 'name email')
      .lean(),
    this.countDocuments(query),
    this.countDocuments({ ...query, isRead: false }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    unreadCount,
  };
};

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = Notification;
