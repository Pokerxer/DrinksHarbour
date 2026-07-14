// routes/blog.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getPublishedPosts,
  getPublishedPostBySlug,
  adminListPosts,
  adminGetPost,
  createPost,
  updatePost,
  setPostStatus,
  deletePost,
  generatePost,
  generateField,
  generateSeo,
  generateBlock,
} = require('../controllers/blog.controller');

// Public
router.get('/', getPublishedPosts);
router.get('/slug/:slug', getPublishedPostBySlug);

// Admin (authenticated). AI routes registered before '/admin/:id' so "ai" is not treated as an id.
router.post('/admin/ai/generate-post', authenticate, generatePost);
router.post('/admin/ai/generate-field', authenticate, generateField);
router.post('/admin/ai/generate-seo', authenticate, generateSeo);
router.post('/admin/ai/generate-block', authenticate, generateBlock);
router.get('/admin', authenticate, adminListPosts);
router.post('/admin', authenticate, createPost);
router.get('/admin/:id', authenticate, adminGetPost);
router.put('/admin/:id', authenticate, updatePost);
router.patch('/admin/:id/status', authenticate, setPostStatus);
router.delete('/admin/:id', authenticate, deletePost);

module.exports = router;
