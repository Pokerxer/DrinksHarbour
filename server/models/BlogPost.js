// models/BlogPost.js
'use strict';

const mongoose = require('mongoose');
const { BLOG_CATEGORIES, BLOCK_TYPES } = require('../services/blog.helpers');

const contentBlockSchema = new mongoose.Schema(
  {
    type: { type: String, enum: BLOCK_TYPES, required: true },
    text: { type: String, default: '' },
    items: { type: [String], default: [] },
  },
  { _id: false }
);

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, default: '' },
    category: { type: String, enum: BLOG_CATEGORIES, required: true },
    tags: { type: [String], default: [] },
    image: { type: String, default: '' },
    author: {
      name: { type: String, default: '' },
      role: { type: String, default: '' },
      bio: { type: String, default: '' },
    },
    content: { type: [contentBlockSchema], default: [] },
    readTime: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      ogImage: { type: String, default: '' },
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    featured: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BlogPost || mongoose.model('BlogPost', blogPostSchema);
