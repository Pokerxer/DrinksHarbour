// controllers/blog.controller.js
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const asyncHandler = require('express-async-handler');
const BlogPost = require('../models/BlogPost');
const {
  BLOG_CATEGORIES,
  slugify,
  dedupeSlug,
  computeReadTime,
  sanitizeContentBlocks,
  snapCategory,
  parseAiJson,
} = require('../services/blog.helpers');

// Same AI setup as gemini.controller.js: Haiku for structured generation.
const HAIKU_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5';
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function parsePaging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
}

async function listPosts(filter, query, res) {
  const { page, limit, skip } = parsePaging(query);
  if (query.category) {
    const cat = snapCategory(query.category);
    if (cat) filter.category = cat;
  }
  const [posts, total] = await Promise.all([
    BlogPost.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    BlogPost.countDocuments(filter),
  ]);
  res.json({ posts, total, page, pages: Math.ceil(total / limit) || 1 });
}

// ── Public ────────────────────────────────────────────────────────────────

const getPublishedPosts = asyncHandler(async (req, res) => {
  await listPosts({ status: 'published' }, req.query, res);
});

const getPublishedPostBySlug = asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' }).lean();
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// ── Admin CRUD ────────────────────────────────────────────────────────────

const adminListPosts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status === 'draft' || req.query.status === 'published') filter.status = req.query.status;
  await listPosts(filter, req.query, res);
});

const adminGetPost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id).lean();
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

function normalizeBody(body) {
  const category = snapCategory(body.category);
  return {
    title: String(body.title || '').trim(),
    excerpt: String(body.excerpt || ''),
    category,
    tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [],
    image: String(body.image || ''),
    author: {
      name: String(body.author?.name || ''),
      role: String(body.author?.role || ''),
      bio: String(body.author?.bio || ''),
    },
    content: sanitizeContentBlocks(body.content),
    featured: Boolean(body.featured),
    status: body.status === 'published' ? 'published' : 'draft',
  };
}

const createPost = asyncHandler(async (req, res) => {
  const data = normalizeBody(req.body);
  if (!data.title) return res.status(400).json({ message: 'Title is required' });
  if (!data.category) return res.status(400).json({ message: `Category must be one of: ${BLOG_CATEGORIES.join(', ')}` });

  const base = slugify(req.body.slug || data.title);
  if (!base) return res.status(400).json({ message: 'Could not derive a slug from the title' });
  const existing = await BlogPost.find({ slug: new RegExp(`^${base}(-\\d+)?$`) }).select('slug').lean();
  data.slug = dedupeSlug(base, existing.map((p) => p.slug));
  data.readTime = computeReadTime(data.content);
  if (data.status === 'published') data.publishedAt = new Date();

  try {
    const post = await BlogPost.create(data);
    res.status(201).json(post);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: `Slug "${data.slug}" already exists` });
    throw err;
  }
});

const updatePost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const data = normalizeBody(req.body);
  if (!data.title) return res.status(400).json({ message: 'Title is required' });
  if (!data.category) return res.status(400).json({ message: `Category must be one of: ${BLOG_CATEGORIES.join(', ')}` });

  if (req.body.slug && slugify(req.body.slug) !== post.slug) {
    const base = slugify(req.body.slug);
    const clash = await BlogPost.findOne({ slug: base, _id: { $ne: post._id } }).lean();
    if (clash) return res.status(409).json({ message: `Slug "${base}" already exists` });
    post.slug = base;
  }

  Object.assign(post, {
    title: data.title,
    excerpt: data.excerpt,
    category: data.category,
    tags: data.tags,
    image: data.image,
    author: data.author,
    content: data.content,
    featured: data.featured,
    readTime: computeReadTime(data.content),
  });
  if (data.status === 'published' && post.status !== 'published') {
    post.status = 'published';
    if (!post.publishedAt) post.publishedAt = new Date();
  } else if (data.status === 'draft') {
    post.status = 'draft';
  }
  await post.save();
  res.json(post);
});

const setPostStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (status !== 'draft' && status !== 'published') {
    return res.status(400).json({ message: 'status must be "draft" or "published"' });
  }
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  post.status = status;
  if (status === 'published' && !post.publishedAt) post.publishedAt = new Date();
  await post.save();
  res.json(post);
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findByIdAndDelete(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json({ message: 'Post deleted' });
});

// ── AI (Haiku) ────────────────────────────────────────────────────────────

async function callHaikuJson(prompt, maxTokens) {
  const message = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    system:
      'You are an expert drinks & lifestyle content writer for DrinksHarbour, a Nigerian online drinks marketplace. Respond with ONLY valid JSON — no markdown code fences, no explanation, no preamble.',
    messages: [{ role: 'user', content: prompt }],
  });
  if (message.stop_reason === 'refusal') throw new Error('Claude declined the request');
  return message.content?.[0]?.text || '';
}

const generatePost = asyncHandler(async (req, res) => {
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });
  const topic = String(req.body.topic || '').trim();
  if (!topic) return res.status(400).json({ message: 'topic is required' });
  const forcedCategory = snapCategory(req.body.category);

  const prompt = `Write a complete blog post for DrinksHarbour (Nigerian online drinks marketplace, Abuja-based) about: "${topic}".
${forcedCategory ? `The category MUST be exactly "${forcedCategory}".` : `Choose the single best category from: ${BLOG_CATEGORIES.join(', ')}.`}

Return ONLY this JSON shape:
{
  "title": "engaging title, max 70 chars",
  "excerpt": "compelling summary, max 40 words",
  "category": "one of: ${BLOG_CATEGORIES.join(' | ')}",
  "tags": ["3-5 short tags"],
  "content": [
    {"type": "p", "text": "..."},
    {"type": "h2", "text": "..."},
    {"type": "ul", "items": ["...", "..."]},
    {"type": "tip", "text": "..."}
  ],
  "author": {"name": "a plausible Nigerian expert name", "role": "their job title", "bio": "1-2 sentence bio"}
}

Content rules: 600-900 words total; start with an intro paragraph; organize with "h2" section headings; include exactly one "tip" block with a practical pro tip; use "ul" or "ol" blocks with "items" for lists (all other block types use "text"); allowed block types are only: p, h2, h3, ul, ol, quote, tip. Use Nigerian context (naira prices, local brands, Lagos/Abuja references) where natural.`;

  let data;
  try {
    data = parseAiJson(await callHaikuJson(prompt, 4096));
  } catch (err) {
    console.error('generatePost AI error:', err.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }

  const content = sanitizeContentBlocks(data.content);
  res.json({
    title: String(data.title || topic),
    excerpt: String(data.excerpt || ''),
    category: snapCategory(data.category) || forcedCategory || 'Lifestyle',
    tags: Array.isArray(data.tags) ? data.tags.map(String).slice(0, 5) : [],
    content,
    author: {
      name: String(data.author?.name || ''),
      role: String(data.author?.role || ''),
      bio: String(data.author?.bio || ''),
    },
    readTime: computeReadTime(content),
  });
});

const generateField = asyncHandler(async (req, res) => {
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });
  const { field, post } = req.body || {};
  if (!['title', 'excerpt', 'tags'].includes(field)) {
    return res.status(400).json({ message: 'field must be one of: title, excerpt, tags' });
  }
  const bodyText = sanitizeContentBlocks(post?.content)
    .map((b) => [b.text, ...(b.items || [])].filter(Boolean).join(' '))
    .join('\n')
    .slice(0, 6000);

  const asks = {
    title: 'Return {"value": "an engaging blog title, max 70 chars"}',
    excerpt: 'Return {"value": "a compelling excerpt, max 40 words"}',
    tags: 'Return {"value": ["3-5 short tags"]}',
  };
  const prompt = `Blog post title: "${post?.title || ''}"
Category: ${post?.category || 'unknown'}
Body:
${bodyText || '(empty)'}

${asks[field]} for this DrinksHarbour blog post. ONLY the JSON object.`;

  try {
    const data = parseAiJson(await callHaikuJson(prompt, 512));
    res.json({ value: data.value });
  } catch (err) {
    console.error('generateField AI error:', err.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }
});

module.exports = {
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
};
