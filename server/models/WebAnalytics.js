// models/WebAnalytics.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const WebAnalyticsSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
    page: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: '',
    },
    referrer: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      enum: ['google', 'facebook', 'instagram', 'youtube', 'twitter', 'email', 'direct', 'referral', 'other'],
      default: 'direct',
    },
    medium: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet'],
      default: 'desktop',
    },
    os: {
      type: String,
      default: '',
    },
    browser: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: 'Nigeria',
    },
    state: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
    },
    sessionDuration: {
      type: Number,
      default: 0,
    },
    isNewUser: {
      type: Boolean,
      default: false,
    },
    isFirstInSession: {
      type: Boolean,
      default: false,
    },
    bounced: {
      type: Boolean,
      default: true,
    },
    converted: {
      type: Boolean,
      default: false,
    },
    pageViewsInSession: {
      type: Number,
      default: 1,
    },
    utmSource: {
      type: String,
      default: '',
    },
    utmMedium: {
      type: String,
      default: '',
    },
    utmCampaign: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound indexes
WebAnalyticsSchema.index({ createdAt: 1 });
WebAnalyticsSchema.index({ sessionId: 1, createdAt: 1 });
WebAnalyticsSchema.index({ page: 1 });
WebAnalyticsSchema.index({ source: 1 });
WebAnalyticsSchema.index({ device: 1 });

module.exports = mongoose.model('WebAnalytics', WebAnalyticsSchema);
