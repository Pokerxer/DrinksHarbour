# Blog Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin `(hydrogen)/blog` module that creates/manages blog posts (with Claude Haiku generation) stored in MongoDB and rendered by the platform `/blog` pages.

**Architecture:** New `BlogPost` Mongoose model + `/api/blog` Express routes (public read of published posts, authenticated admin CRUD + AI endpoints). Admin Next.js app gets a banners-style list/create/edit module with a content-block builder. Platform `/blog` pages switch from the static `POSTS` array to server-side API fetches with ISR.

**Tech Stack:** Express + Mongoose (server), `@anthropic-ai/sdk` (Haiku `claude-haiku-4-5`), Next.js App Router + rizzui + react-hot-toast + next-auth (admin), Next.js server components (platform), `node:test` (server tests).

**Spec:** `docs/superpowers/specs/2026-07-14-blog-management-design.md`

## Global Constraints

- Categories enum (exact strings): `'Wine Guide','Spirits Guide','Beer Guide','Recipes','Entertaining','Lifestyle'`
- Content block types enum (exact strings): `'p','h2','h3','ul','ol','quote','tip'`
- Haiku model: `process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5'`; Anthropic client only created when `process.env.ANTHROPIC_API_KEY` is set; AI routes return **503** when it is not.
- Server tests use `node:test` + `node:assert` in `server/__tests__/` and must not hit the DB or the Anthropic API. Run with `cd server && npx mocha` — NO. Run with `cd server && node --test __tests__/blog.helpers.test.js` (repo convention: plain `node --test`).
- Admin client components start with `// @ts-nocheck` (matches sibling banner components; admin tsc has ~546 pre-existing errors — do not add new ones in files without `@ts-nocheck`).
- Admin API base: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'`; auth token from next-auth session: `session?.token || session?.user?.token || ''`.
- Platform API base: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'`; fetches use `next: { revalidate: 300 }` and degrade to `[]`/`null` on failure.
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Blog helpers (pure logic) — TDD

**Files:**
- Create: `server/services/blog.helpers.js`
- Test: `server/__tests__/blog.helpers.test.js`

**Interfaces:**
- Produces: `BLOG_CATEGORIES: string[]`, `BLOCK_TYPES: string[]`, `slugify(title) -> string`, `dedupeSlug(base, existingSlugs) -> string`, `computeReadTime(content) -> string`, `sanitizeContentBlocks(content) -> Block[]`, `snapCategory(value) -> string|null`, `parseAiJson(text) -> object` (throws on unparseable).

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/blog.helpers.test.js`:

```js
// server/__tests__/blog.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  BLOG_CATEGORIES,
  BLOCK_TYPES,
  slugify,
  dedupeSlug,
  computeReadTime,
  sanitizeContentBlocks,
  snapCategory,
  parseAiJson,
} = require('../services/blog.helpers');

test('slugify lowercases, strips apostrophes, and kebab-cases', () => {
  assert.strictEqual(slugify("Nigeria's Top 10 Wines!"), 'nigerias-top-10-wines');
  assert.strictEqual(slugify('  Gin & Tonic — 101  '), 'gin-tonic-101');
  assert.strictEqual(slugify(''), '');
});

test('dedupeSlug returns base when free, else appends -2, -3, ...', () => {
  assert.strictEqual(dedupeSlug('wine-guide', []), 'wine-guide');
  assert.strictEqual(dedupeSlug('wine-guide', ['wine-guide']), 'wine-guide-2');
  assert.strictEqual(dedupeSlug('wine-guide', ['wine-guide', 'wine-guide-2']), 'wine-guide-3');
});

test('computeReadTime counts words in text and items at ~200wpm, min 1 min', () => {
  assert.strictEqual(computeReadTime([]), '1 min read');
  const words400 = { type: 'p', text: Array(400).fill('word').join(' ') };
  assert.strictEqual(computeReadTime([words400]), '2 min read');
  const listBlock = { type: 'ul', items: [Array(100).fill('w').join(' '), Array(100).fill('w').join(' ')] };
  assert.strictEqual(computeReadTime([words400, listBlock]), '3 min read');
});

test('sanitizeContentBlocks drops invalid types and strips unknown keys', () => {
  const out = sanitizeContentBlocks([
    { type: 'p', text: 'hello', junk: 1 },
    { type: 'div', text: 'nope' },
    { type: 'ul', items: ['a', 'b'] },
    null,
    { type: 'tip' },
  ]);
  assert.deepStrictEqual(out, [
    { type: 'p', text: 'hello', items: [] },
    { type: 'ul', text: '', items: ['a', 'b'] },
    { type: 'tip', text: '', items: [] },
  ]);
});

test('snapCategory matches case-insensitively and returns null for unknown', () => {
  assert.strictEqual(snapCategory('wine guide'), 'Wine Guide');
  assert.strictEqual(snapCategory('Recipes'), 'Recipes');
  assert.strictEqual(snapCategory('Gossip'), null);
});

test('parseAiJson handles raw JSON, fenced JSON, and JSON with prose around it', () => {
  assert.deepStrictEqual(parseAiJson('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(parseAiJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(parseAiJson('Sure! {"a":1} hope that helps'), { a: 1 });
  assert.throws(() => parseAiJson('no json here'));
});

test('exports category and block-type enums', () => {
  assert.deepStrictEqual(BLOG_CATEGORIES, ['Wine Guide', 'Spirits Guide', 'Beer Guide', 'Recipes', 'Entertaining', 'Lifestyle']);
  assert.deepStrictEqual(BLOCK_TYPES, ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'tip']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/blog.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/blog.helpers'`

- [ ] **Step 3: Implement the helpers**

Create `server/services/blog.helpers.js`:

```js
// services/blog.helpers.js — pure helpers for the blog module (no DB, no network)
'use strict';

const BLOG_CATEGORIES = ['Wine Guide', 'Spirits Guide', 'Beer Guide', 'Recipes', 'Entertaining', 'Lifestyle'];
const BLOCK_TYPES = ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'tip'];

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dedupeSlug(base, existingSlugs) {
  const taken = new Set(existingSlugs || []);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function countWords(str) {
  return String(str || '').split(/\s+/).filter(Boolean).length;
}

function computeReadTime(content) {
  const blocks = Array.isArray(content) ? content : [];
  const words = blocks.reduce((sum, b) => {
    if (!b) return sum;
    const itemWords = Array.isArray(b.items) ? b.items.reduce((s, it) => s + countWords(it), 0) : 0;
    return sum + countWords(b.text) + itemWords;
  }, 0);
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function sanitizeContentBlocks(content) {
  const blocks = Array.isArray(content) ? content : [];
  return blocks
    .filter((b) => b && BLOCK_TYPES.includes(b.type))
    .map((b) => ({
      type: b.type,
      text: typeof b.text === 'string' ? b.text : '',
      items: Array.isArray(b.items) ? b.items.map(String) : [],
    }));
}

function snapCategory(value) {
  const needle = String(value || '').trim().toLowerCase();
  return BLOG_CATEGORIES.find((c) => c.toLowerCase() === needle) || null;
}

// Tolerant JSON extraction for model output: raw JSON, ```json fences, or JSON embedded in prose.
function parseAiJson(text) {
  const cleaned = String(text || '').replace(/```json\s*|```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI response was not valid JSON');
  }
}

module.exports = {
  BLOG_CATEGORIES,
  BLOCK_TYPES,
  slugify,
  dedupeSlug,
  computeReadTime,
  sanitizeContentBlocks,
  snapCategory,
  parseAiJson,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/blog.helpers.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/blog.helpers.js server/__tests__/blog.helpers.test.js
git commit -m "feat(blog): pure helpers for slug, read time, block sanitizing, AI JSON parse

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: BlogPost model

**Files:**
- Create: `server/models/BlogPost.js`
- Test: `server/__tests__/blogPost.model.test.js`

**Interfaces:**
- Consumes: `BLOG_CATEGORIES`, `BLOCK_TYPES` from `server/services/blog.helpers.js`
- Produces: Mongoose model `BlogPost` with fields per spec (title, slug, excerpt, category, tags, image, author{name,role,bio}, content[{type,text,items}], readTime, status, featured, publishedAt, timestamps).

- [ ] **Step 1: Write the failing test** (uses `validateSync()` — no DB connection needed)

Create `server/__tests__/blogPost.model.test.js`:

```js
// server/__tests__/blogPost.model.test.js
const test = require('node:test');
const assert = require('node:assert');
const BlogPost = require('../models/BlogPost');

test('valid draft post passes validation with defaults', () => {
  const doc = new BlogPost({
    title: 'Test Post',
    slug: 'test-post',
    category: 'Wine Guide',
    content: [{ type: 'p', text: 'hello' }],
  });
  assert.strictEqual(doc.validateSync(), undefined);
  assert.strictEqual(doc.status, 'draft');
  assert.strictEqual(doc.featured, false);
  assert.strictEqual(doc.content[0]._id, undefined);
});

test('rejects unknown category and unknown block type', () => {
  const badCat = new BlogPost({ title: 't', slug: 't', category: 'Gossip' });
  assert.ok(badCat.validateSync().errors['category']);
  const badBlock = new BlogPost({ title: 't', slug: 't', category: 'Recipes', content: [{ type: 'div' }] });
  assert.ok(badBlock.validateSync());
});

test('requires title and slug', () => {
  const doc = new BlogPost({ category: 'Recipes' });
  const err = doc.validateSync();
  assert.ok(err.errors['title']);
  assert.ok(err.errors['slug']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/blogPost.model.test.js`
Expected: FAIL — `Cannot find module '../models/BlogPost'`

- [ ] **Step 3: Implement the model**

Create `server/models/BlogPost.js`:

```js
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
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    featured: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BlogPost || mongoose.model('BlogPost', blogPostSchema);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/blogPost.model.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add server/models/BlogPost.js server/__tests__/blogPost.model.test.js
git commit -m "feat(blog): BlogPost mongoose model

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Blog controller + routes (public read, admin CRUD, Haiku AI) and server mount

**Files:**
- Create: `server/controllers/blog.controller.js`
- Create: `server/routes/blog.routes.js`
- Modify: `server/server.js` (add require near line 48 and mount near line 215)

**Interfaces:**
- Consumes: `BlogPost` model; helpers from Task 1; `authenticate` from `server/middleware/auth.middleware.js`; `@anthropic-ai/sdk` (already a server dependency); `express-async-handler`.
- Produces HTTP API (all JSON):
  - `GET /api/blog?category=&page=&limit=` → `{ posts, total, page, pages }` (published only, `publishedAt` desc)
  - `GET /api/blog/slug/:slug` → post or 404 (published only)
  - `GET /api/blog/admin?status=&category=&page=&limit=` (auth) → `{ posts, total, page, pages }`
  - `GET /api/blog/admin/:id` (auth) → post
  - `POST /api/blog/admin` (auth) → created post (400 invalid category/title, 409 slug conflict)
  - `PUT /api/blog/admin/:id` (auth) → updated post
  - `PATCH /api/blog/admin/:id/status` (auth) `{ status }` → updated post
  - `DELETE /api/blog/admin/:id` (auth) → `{ message }`
  - `POST /api/blog/admin/ai/generate-post` (auth) `{ topic, category? }` → `{ title, excerpt, category, tags, content, author }` (503 no key, 502 bad AI output)
  - `POST /api/blog/admin/ai/generate-field` (auth) `{ field, post }` → `{ value }` (field ∈ `title|excerpt|tags`)

- [ ] **Step 1: Implement the controller**

Create `server/controllers/blog.controller.js`:

```js
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
```

- [ ] **Step 2: Implement the routes**

Create `server/routes/blog.routes.js`:

```js
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
} = require('../controllers/blog.controller');

// Public
router.get('/', getPublishedPosts);
router.get('/slug/:slug', getPublishedPostBySlug);

// Admin (authenticated). AI routes registered before '/admin/:id' so "ai" is not treated as an id.
router.post('/admin/ai/generate-post', authenticate, generatePost);
router.post('/admin/ai/generate-field', authenticate, generateField);
router.get('/admin', authenticate, adminListPosts);
router.post('/admin', authenticate, createPost);
router.get('/admin/:id', authenticate, adminGetPost);
router.put('/admin/:id', authenticate, updatePost);
router.patch('/admin/:id/status', authenticate, setPostStatus);
router.delete('/admin/:id', authenticate, deletePost);

module.exports = router;
```

- [ ] **Step 3: Mount in server.js**

In `server/server.js`, next to the banner requires (~line 48) add:

```js
const blogRoutes             = require('./routes/blog.routes');
```

and next to `app.use('/api/banners', bannerRoutes);` (~line 215) add:

```js
app.use('/api/blog',               blogRoutes);
```

- [ ] **Step 4: Verify server boots and routes respond**

Run: `cd /Users/mac/Documents/drinksharbour/server && node -e "require('./routes/blog.routes'); require('./controllers/blog.controller'); console.log('modules OK')"`
Expected: `modules OK`

Then run the full existing test suite to confirm nothing broke:
`cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/`
Expected: same pass/fail counts as baseline plus the new blog tests passing (pre-existing failures per memory: a few known ones are acceptable).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/blog.controller.js server/routes/blog.routes.js server/server.js
git commit -m "feat(blog): public + admin blog API with Haiku generate-post/generate-field

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Seed script for the 9 existing posts

**Files:**
- Create: `server/scripts/seed-blog-posts.js`
- Reference (read-only): `client/apps/platform/src/app/blog/data.ts` (source of the 9 posts)

**Interfaces:**
- Consumes: `BlogPost` model, `server/config/db.js`, helpers `computeReadTime`.
- Produces: idempotent script; run `node scripts/seed-blog-posts.js` from `server/`.

- [ ] **Step 1: Write the script**

Create `server/scripts/seed-blog-posts.js` with this exact skeleton. For the `POSTS` array: copy the **entire** `POSTS` array literal from `client/apps/platform/src/app/blog/data.ts` (lines 32–311) verbatim — it is already valid JavaScript once the surrounding TypeScript type annotation (`: Post[]`) is dropped. Do not retype or paraphrase the content.

```js
// scripts/seed-blog-posts.js — idempotent import of the original 9 static platform posts.
// Usage: cd server && node scripts/seed-blog-posts.js
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const BlogPost = require('../models/BlogPost');
const { computeReadTime } = require('../services/blog.helpers');

const POSTS = [
  // <<< PASTE the full POSTS array contents from
  // client/apps/platform/src/app/blog/data.ts (the 9 post objects), unchanged. >>>
];

async function run() {
  await connectDB();
  let created = 0;
  let updated = 0;
  for (const p of POSTS) {
    const doc = {
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      category: p.category,
      tags: p.tags,
      image: p.image,
      author: p.author,
      content: p.content,
      readTime: p.readTime || computeReadTime(p.content),
      status: 'published',
      featured: Boolean(p.featured),
      publishedAt: new Date(p.isoDate),
    };
    const res = await BlogPost.updateOne({ slug: p.slug }, { $set: doc }, { upsert: true });
    if (res.upsertedCount) created += 1;
    else updated += 1;
  }
  console.log(`✅ Blog seed complete: ${created} created, ${updated} updated, ${POSTS.length} total`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Blog seed failed:', err);
  process.exit(1);
});
```

Note: the seeded objects include `id: 1..9`, `date`, and `isoDate` keys from the source file — Mongoose ignores unknown keys, so leaving them in the pasted array is fine.

- [ ] **Step 2: Run the seed against the dev DB**

Run: `cd /Users/mac/Documents/drinksharbour/server && node scripts/seed-blog-posts.js`
Expected: `✅ Blog seed complete: 9 created, 0 updated, 9 total` (first run).

Run it a second time — Expected: `0 created, 9 updated` (idempotent).

- [ ] **Step 3: Verify via the public API**

Start the server if not running, then:
`curl -s 'http://localhost:5001/api/blog?limit=3' | head -c 400`
Expected: JSON with `"posts":[...]` and `"total":9`.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/seed-blog-posts.js
git commit -m "feat(blog): idempotent seed script for the 9 original platform posts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin blog service, routes config, sidebar menu

**Files:**
- Create: `client/apps/admin/src/services/blog.service.ts`
- Modify: `client/apps/admin/src/config/routes.ts` (add `blog` group after the `banners` entries around line 136-139)
- Modify: `client/apps/admin/src/layouts/hydrogen/menu-items.tsx` (add a Blog item after Banners, ~line 157)

**Interfaces:**
- Produces: `blogService` with methods `getPosts(token, params?)`, `getPostById(id, token)`, `createPost(data, token)`, `updatePost(id, data, token)`, `setStatus(id, status, token)`, `deletePost(id, token)`, `generatePost(body, token)`, `generateField(body, token)`.
- Produces routes: `routes.blog.list = '/blog'`, `routes.blog.create = '/blog/create'`, `routes.blog.edit = (id) => \`/blog/${id}/edit\``.

- [ ] **Step 1: Create the service** (same shape as `banner.service.ts`)

Create `client/apps/admin/src/services/blog.service.ts`:

```ts
// Services for blog API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function request(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const error = await response.json();
      message = error.message || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export const blogService = {
  getPosts(token: string, params?: Record<string, any>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request(`/api/blog/admin${qs}`, token);
  },
  getPostById(id: string, token: string) {
    return request(`/api/blog/admin/${id}`, token);
  },
  createPost(data: any, token: string) {
    return request('/api/blog/admin', token, { method: 'POST', body: JSON.stringify(data) });
  },
  updatePost(id: string, data: any, token: string) {
    return request(`/api/blog/admin/${id}`, token, { method: 'PUT', body: JSON.stringify(data) });
  },
  setStatus(id: string, status: 'draft' | 'published', token: string) {
    return request(`/api/blog/admin/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  deletePost(id: string, token: string) {
    return request(`/api/blog/admin/${id}`, token, { method: 'DELETE' });
  },
  generatePost(body: { topic: string; category?: string }, token: string) {
    return request('/api/blog/admin/ai/generate-post', token, { method: 'POST', body: JSON.stringify(body) });
  },
  generateField(body: { field: 'title' | 'excerpt' | 'tags'; post: any }, token: string) {
    return request('/api/blog/admin/ai/generate-field', token, { method: 'POST', body: JSON.stringify(body) });
  },
};
```

- [ ] **Step 2: Add routes config**

In `client/apps/admin/src/config/routes.ts`, immediately after the `eCommerce` group's closing brace (find `bannerDetails: (id: string) => \`/banners/${id}\`,` and locate the end of that `eCommerce` object — add a **top-level** sibling group; match the file's existing top-level style):

```ts
  blog: {
    list: '/blog',
    create: '/blog/create',
    edit: (id: string) => `/blog/${id}/edit`,
  },
```

- [ ] **Step 3: Add sidebar menu item**

In `client/apps/admin/src/layouts/hydrogen/menu-items.tsx`, after the `Banners` item (`{ name: 'Banners', href: routes.eCommerce.banners, },` ~line 154-157) add:

```tsx
      {
        name: 'Blog',
        href: routes.blog.list,
      },
```

- [ ] **Step 4: Verify compile**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: no MORE errors than the pre-existing baseline (~546). Compare by running the same command on `main` if unsure; the three touched files must not appear in the error output:
`npx tsc --noEmit 2>&1 | grep -E "blog.service|config/routes|menu-items" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/services/blog.service.ts client/apps/admin/src/config/routes.ts client/apps/admin/src/layouts/hydrogen/menu-items.tsx
git commit -m "feat(admin): blog service, routes config, sidebar entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Admin blog list page + table

**Files:**
- Create: `client/apps/admin/src/app/(hydrogen)/blog/page.tsx`
- Create: `client/apps/admin/src/app/shared/blog/blog-list/table.tsx`

**Interfaces:**
- Consumes: `blogService` (Task 5), `routes.blog.*` (Task 5), `PageHeader` from `@/app/shared/page-header`, `metaObject` from `@/config/site.config`.
- Produces: `<BlogPostsTable />` default export used by the page.

- [ ] **Step 1: Create the route page**

Create `client/apps/admin/src/app/(hydrogen)/blog/page.tsx`:

```tsx
// @ts-nocheck
import Link from 'next/link';
import { PiPlusBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import PageHeader from '@/app/shared/page-header';
import BlogPostsTable from '@/app/shared/blog/blog-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Blog'),
};

const pageHeader = {
  title: 'Blog',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { name: 'Blog' },
    { name: 'List' },
  ],
};

export default function BlogListPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link href={routes.blog.create} className="w-full @lg:w-auto">
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              Add Post
            </Button>
          </Link>
        </div>
      </PageHeader>

      <BlogPostsTable />
    </>
  );
}
```

- [ ] **Step 2: Create the table component**

Create `client/apps/admin/src/app/shared/blog/blog-list/table.tsx`:

```tsx
// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Text, Badge, Button, Select, ActionIcon, Popover } from 'rizzui';
import {
  PiPencilSimpleBold,
  PiTrashBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiArrowsClockwiseBold,
  PiStarFill,
  PiWarningBold,
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { routes } from '@/config/routes';

const CATEGORY_OPTIONS = [
  { label: 'All categories', value: '' },
  { label: 'Wine Guide', value: 'Wine Guide' },
  { label: 'Spirits Guide', value: 'Spirits Guide' },
  { label: 'Beer Guide', value: 'Beer Guide' },
  { label: 'Recipes', value: 'Recipes' },
  { label: 'Entertaining', value: 'Entertaining' },
  { label: 'Lifestyle', value: 'Lifestyle' },
];

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
];

export default function BlogPostsTable() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { limit: '100' };
      if (category) params.category = category;
      if (status) params.status = status;
      const data = await blogService.getPosts(token, params);
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [token, category, status]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchPosts();
  }, [sessionStatus, fetchPosts]);

  const toggleStatus = async (post) => {
    const next = post.status === 'published' ? 'draft' : 'published';
    try {
      await blogService.setStatus(post._id, next, token);
      toast.success(next === 'published' ? 'Post published' : 'Post unpublished');
      fetchPosts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removePost = async (post) => {
    try {
      await blogService.deletePost(post._id, token);
      toast.success('Post deleted');
      fetchPosts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="h-12 w-16 flex-shrink-0 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-12 text-center">
        <PiWarningBold className="mx-auto mb-4 h-10 w-10 text-red-500" />
        <Text className="mb-2 text-lg font-bold text-red-600">Failed to load posts</Text>
        <Text className="mb-6 text-gray-500">{error}</Text>
        <Button onClick={fetchPosts}>
          <PiArrowsClockwiseBold className="me-1.5 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(v) => setCategory(v?.value ?? v ?? '')}
          getOptionValue={(o) => o.value}
          displayValue={(v) => CATEGORY_OPTIONS.find((o) => o.value === v)?.label}
          placeholder="Category"
          className="w-48"
        />
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setStatus(v?.value ?? v ?? '')}
          getOptionValue={(o) => o.value}
          displayValue={(v) => STATUS_OPTIONS.find((o) => o.value === v)?.label}
          placeholder="Status"
          className="w-40"
        />
        <Text className="ms-auto text-sm text-gray-500">{posts.length} posts</Text>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center">
          <Text className="mb-2 text-lg font-bold text-gray-700">No posts yet</Text>
          <Text className="mb-6 text-gray-500">Create your first post — or generate one with AI.</Text>
          <Link href={routes.blog.create}>
            <Button as="span">Add Post</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post._id}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {post.image ? (
                  <Image src={post.image} alt="" fill sizes="64px" className="object-cover" unoptimized />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Text className="truncate font-semibold text-gray-900">{post.title}</Text>
                  {post.featured && <PiStarFill className="h-4 w-4 flex-shrink-0 text-amber-400" title="Featured" />}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <span>{post.category}</span>
                  <span>·</span>
                  <span>/{post.slug}</span>
                  {post.publishedAt && (
                    <>
                      <span>·</span>
                      <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge color={post.status === 'published' ? 'success' : 'secondary'} variant="flat">
                {post.status}
              </Badge>
              <div className="flex items-center gap-1.5">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                  onClick={() => toggleStatus(post)}
                >
                  {post.status === 'published' ? <PiEyeSlashBold className="h-4 w-4" /> : <PiEyeBold className="h-4 w-4" />}
                </ActionIcon>
                <ActionIcon size="sm" variant="outline" title="Edit" onClick={() => router.push(routes.blog.edit(post._id))}>
                  <PiPencilSimpleBold className="h-4 w-4" />
                </ActionIcon>
                <Popover placement="left">
                  <Popover.Trigger>
                    <ActionIcon size="sm" variant="outline" color="danger" title="Delete">
                      <PiTrashBold className="h-4 w-4" />
                    </ActionIcon>
                  </Popover.Trigger>
                  <Popover.Content>
                    {({ setOpen }) => (
                      <div className="w-56 p-1 text-center">
                        <Text className="mb-3 font-semibold">Delete this post?</Text>
                        <div className="flex justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            onClick={() => {
                              setOpen(false);
                              removePost(post);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </Popover.Content>
                </Popover>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify page renders**

Run the admin dev server (`cd client/apps/admin && npm run dev` if not already running), open `http://localhost:3000/blog` (or the admin port in use), log in, and confirm: seeded posts listed with status badges, filters work, publish-toggle flips a badge, delete removes a post (test on a draft you create later — do not delete seeded posts).

If browser verification is impractical in this session, minimum bar: `npx tsc --noEmit 2>&1 | grep -E "shared/blog|\\(hydrogen\\)/blog" || echo CLEAN` → `CLEAN`, plus dev-server compile of `/blog` with no runtime error in the terminal.

- [ ] **Step 4: Commit**

```bash
git add "client/apps/admin/src/app/(hydrogen)/blog/page.tsx" client/apps/admin/src/app/shared/blog/blog-list/table.tsx
git commit -m "feat(admin): blog list page with status toggle, filters, delete

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin create/edit form with content-block builder + AI

**Files:**
- Create: `client/apps/admin/src/app/shared/blog/create-edit.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/blog/create/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/blog/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `blogService` (Task 5). `CreateEditBlogPost` accepts optional prop `postId?: string` — when set it loads the post and saves via `updatePost`, otherwise `createPost`.
- Produces: `<CreateEditBlogPost postId?/>` default export.

- [ ] **Step 1: Create the shared form**

Create `client/apps/admin/src/app/shared/blog/create-edit.tsx`:

```tsx
// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Input, Textarea, Select, Button, Switch, Text, ActionIcon } from 'rizzui';
import {
  PiSparkleBold,
  PiPlusBold,
  PiTrashBold,
  PiArrowUpBold,
  PiArrowDownBold,
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { routes } from '@/config/routes';

const CATEGORIES = ['Wine Guide', 'Spirits Guide', 'Beer Guide', 'Recipes', 'Entertaining', 'Lifestyle'];
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ label: c, value: c }));
const BLOCK_TYPES = ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'tip'];
const BLOCK_OPTIONS = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading (H2)', value: 'h2' },
  { label: 'Subheading (H3)', value: 'h3' },
  { label: 'Bullet list', value: 'ul' },
  { label: 'Numbered list', value: 'ol' },
  { label: 'Quote', value: 'quote' },
  { label: 'Pro tip', value: 'tip' },
];
const LIST_TYPES = ['ul', 'ol'];

const emptyPost = {
  title: '',
  slug: '',
  excerpt: '',
  category: 'Wine Guide',
  tags: [],
  image: '',
  featured: false,
  author: { name: '', role: '', bio: '' },
  content: [{ type: 'p', text: '', items: [] }],
};

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CreateEditBlogPost({ postId }: { postId?: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [post, setPost] = useState(emptyPost);
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCategory, setAiCategory] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [fieldBusy, setFieldBusy] = useState('');

  useEffect(() => {
    if (!postId || !token) return;
    blogService
      .getPostById(postId, token)
      .then((data) =>
        setPost({
          ...emptyPost,
          ...data,
          author: { ...emptyPost.author, ...(data.author || {}) },
          content: data.content?.length ? data.content : emptyPost.content,
        })
      )
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [postId, token]);

  const set = (patch) => setPost((p) => ({ ...p, ...patch }));

  const setTitle = (title) => {
    set(slugTouched ? { title } : { title, slug: slugify(title) });
  };

  const updateBlock = (i, patch) =>
    setPost((p) => ({ ...p, content: p.content.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const addBlock = () => setPost((p) => ({ ...p, content: [...p.content, { type: 'p', text: '', items: [] }] }));
  const removeBlock = (i) => setPost((p) => ({ ...p, content: p.content.filter((_, j) => j !== i) }));
  const moveBlock = (i, dir) =>
    setPost((p) => {
      const content = [...p.content];
      const j = i + dir;
      if (j < 0 || j >= content.length) return p;
      [content[i], content[j]] = [content[j], content[i]];
      return { ...p, content };
    });

  const generateFullPost = async () => {
    if (!aiTopic.trim()) return toast.error('Enter a topic first');
    setAiBusy(true);
    try {
      const data = await blogService.generatePost({ topic: aiTopic, category: aiCategory || undefined }, token);
      setPost((p) => ({
        ...p,
        title: data.title,
        slug: slugify(data.title),
        excerpt: data.excerpt,
        category: data.category,
        tags: data.tags,
        content: data.content?.length ? data.content : p.content,
        author: data.author?.name ? data.author : p.author,
      }));
      setSlugTouched(false);
      toast.success('Draft generated — review before saving');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const regenerateField = async (field) => {
    setFieldBusy(field);
    try {
      const { value } = await blogService.generateField({ field, post }, token);
      if (field === 'tags') set({ tags: Array.isArray(value) ? value : [] });
      else set({ [field]: String(value || '') });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFieldBusy('');
    }
  };

  const save = async (status) => {
    if (!post.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const payload = { ...post, status };
      if (postId) await blogService.updatePost(postId, payload, token);
      else await blogService.createPost(payload, token);
      toast.success(status === 'published' ? 'Post published' : 'Draft saved');
      router.push(routes.blog.list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* AI bar */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
        <Text className="mb-3 flex items-center gap-2 font-semibold text-violet-800">
          <PiSparkleBold /> Generate with AI (Haiku)
        </Text>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Topic"
            placeholder="e.g. Best champagnes for Nigerian weddings"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            className="min-w-64 flex-1"
          />
          <Select
            label="Category (optional)"
            options={[{ label: 'Let AI choose', value: '' }, ...CATEGORY_OPTIONS]}
            value={aiCategory}
            onChange={(v) => setAiCategory(v?.value ?? v ?? '')}
            getOptionValue={(o) => o.value}
            displayValue={(v) => (v ? v : 'Let AI choose')}
            className="w-52"
          />
          <Button onClick={generateFullPost} isLoading={aiBusy}>
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate full post
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:grid-cols-2">
        <Input label="Title" value={post.title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
        <Input
          label="Slug"
          value={post.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set({ slug: e.target.value });
          }}
          prefix="/blog/"
        />
        <Select
          label="Category"
          options={CATEGORY_OPTIONS}
          value={post.category}
          onChange={(v) => set({ category: v?.value ?? v })}
          getOptionValue={(o) => o.value}
          displayValue={(v) => v}
        />
        <div className="relative md:col-span-2">
          <Textarea label="Excerpt" rows={2} value={post.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
          <ActionIcon
            size="sm"
            variant="text"
            className="absolute right-1 top-7 text-violet-600"
            title="Regenerate excerpt with AI"
            isLoading={fieldBusy === 'excerpt'}
            onClick={() => regenerateField('excerpt')}
          >
            <PiSparkleBold className="h-4 w-4" />
          </ActionIcon>
        </div>
        <div className="relative">
          <Input
            label="Tags (comma-separated)"
            value={post.tags.join(', ')}
            onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
          <ActionIcon
            size="sm"
            variant="text"
            className="absolute right-1 top-7 text-violet-600"
            title="Regenerate tags with AI"
            isLoading={fieldBusy === 'tags'}
            onClick={() => regenerateField('tags')}
          >
            <PiSparkleBold className="h-4 w-4" />
          </ActionIcon>
        </div>
        <Input label="Cover image URL" value={post.image} onChange={(e) => set({ image: e.target.value })} />
        {post.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image} alt="Cover preview" className="h-32 w-full rounded-xl object-cover md:col-span-2" />
        ) : null}
        <Input label="Author name" value={post.author.name} onChange={(e) => set({ author: { ...post.author, name: e.target.value } })} />
        <Input label="Author role" value={post.author.role} onChange={(e) => set({ author: { ...post.author, role: e.target.value } })} />
        <Textarea label="Author bio" rows={2} value={post.author.bio} onChange={(e) => set({ author: { ...post.author, bio: e.target.value } })} className="md:col-span-2" />
        <Switch label="Featured post" checked={post.featured} onChange={(e) => set({ featured: e.target.checked })} />
      </div>

      {/* Content blocks */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <Text className="mb-4 font-semibold text-gray-900">Content</Text>
        <div className="space-y-4">
          {post.content.map((block, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Select
                  options={BLOCK_OPTIONS}
                  value={block.type}
                  onChange={(v) => updateBlock(i, { type: v?.value ?? v })}
                  getOptionValue={(o) => o.value}
                  displayValue={(v) => BLOCK_OPTIONS.find((o) => o.value === v)?.label}
                  className="w-44"
                  size="sm"
                />
                <div className="ms-auto flex items-center gap-1">
                  <ActionIcon size="sm" variant="text" onClick={() => moveBlock(i, -1)} title="Move up">
                    <PiArrowUpBold className="h-4 w-4" />
                  </ActionIcon>
                  <ActionIcon size="sm" variant="text" onClick={() => moveBlock(i, 1)} title="Move down">
                    <PiArrowDownBold className="h-4 w-4" />
                  </ActionIcon>
                  <ActionIcon size="sm" variant="text" color="danger" onClick={() => removeBlock(i)} title="Remove block">
                    <PiTrashBold className="h-4 w-4" />
                  </ActionIcon>
                </div>
              </div>
              {LIST_TYPES.includes(block.type) ? (
                <Textarea
                  rows={3}
                  placeholder="One list item per line"
                  value={(block.items || []).join('\n')}
                  onChange={(e) => updateBlock(i, { items: e.target.value.split('\n') })}
                />
              ) : (
                <Textarea
                  rows={block.type === 'p' ? 3 : 1}
                  placeholder={block.type === 'tip' ? 'Pro tip text…' : 'Text…'}
                  value={block.text || ''}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-4" onClick={addBlock}>
          <PiPlusBold className="me-1.5 h-4 w-4" /> Add block
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" isLoading={saving} onClick={() => save('draft')}>
          Save Draft
        </Button>
        <Button isLoading={saving} onClick={() => save('published')}>
          Publish
        </Button>
      </div>
    </div>
  );
}
```

Note: list-item textareas keep raw lines (including empties) while typing; the server's `sanitizeContentBlocks` casts to strings and the platform renders them — trim empties on save is unnecessary complexity (YAGNI), but the server keeps them harmless.

- [ ] **Step 2: Create the route pages**

Create `client/apps/admin/src/app/(hydrogen)/blog/create/page.tsx`:

```tsx
// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateEditBlogPost from '@/app/shared/blog/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Blog Post'),
};

const pageHeader = {
  title: 'Create Blog Post',
  breadcrumb: [
    { href: routes.blog.list, name: 'Blog' },
    { name: 'Create' },
  ],
};

export default function CreateBlogPostPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditBlogPost />
    </>
  );
}
```

Create `client/apps/admin/src/app/(hydrogen)/blog/[id]/edit/page.tsx`:

```tsx
// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateEditBlogPost from '@/app/shared/blog/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Edit Blog Post'),
};

const pageHeader = {
  title: 'Edit Blog Post',
  breadcrumb: [
    { href: routes.blog.list, name: 'Blog' },
    { name: 'Edit' },
  ],
};

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditBlogPost postId={id} />
    </>
  );
}
```

- [ ] **Step 3: Verify in the browser**

With server + admin dev running: create a draft manually (title/category/one paragraph) → appears in list as draft. Edit a seeded post → fields populate incl. blocks. If `ANTHROPIC_API_KEY` is set, generate a full post from a topic and confirm the form fills; per-field sparkle on excerpt works. If key unset, confirm a clean toast error (503 message), not a crash.

- [ ] **Step 4: Commit**

```bash
git add client/apps/admin/src/app/shared/blog/create-edit.tsx "client/apps/admin/src/app/(hydrogen)/blog/create/page.tsx" "client/apps/admin/src/app/(hydrogen)/blog/[id]/edit/page.tsx"
git commit -m "feat(admin): blog create/edit form with block builder and Haiku AI fill

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Platform /blog switches to the API

**Files:**
- Create: `client/apps/platform/src/app/blog/api.ts`
- Modify: `client/apps/platform/src/app/blog/data.ts` (drop `POSTS`, `id` → string)
- Create: `client/apps/platform/src/app/blog/BlogIndexClient.tsx` (moved body of current `page.tsx`)
- Modify: `client/apps/platform/src/app/blog/page.tsx` (becomes a thin server component)
- Modify: `client/apps/platform/src/app/blog/[slug]/page.tsx` (fetch by slug, drop `generateStaticParams`)

**Interfaces:**
- Consumes: `GET /api/blog?limit=100`, `GET /api/blog/slug/:slug` (Task 3).
- Produces: `getPosts(): Promise<Post[]>`, `getPostBySlug(slug): Promise<Post | null>` from `blog/api.ts`; `BlogIndexClient({ posts }: { posts: Post[] })`.

- [ ] **Step 1: Create the fetch helpers**

Create `client/apps/platform/src/app/blog/api.ts`:

```ts
import type { Post } from './data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function mapPost(raw: any): Post {
  const iso = raw.publishedAt || raw.createdAt || new Date().toISOString();
  return {
    id: String(raw._id),
    title: raw.title,
    excerpt: raw.excerpt || '',
    category: raw.category,
    date: new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    isoDate: String(iso).slice(0, 10),
    readTime: raw.readTime || '1 min read',
    image: raw.image || 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80',
    slug: raw.slug,
    featured: Boolean(raw.featured),
    tags: raw.tags || [],
    author: raw.author || { name: '', role: '', bio: '' },
    content: raw.content || [],
  };
}

export async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE}/api/blog?limit=100`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).map(mapPost);
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/slug/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return mapPost(await res.json());
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Trim `data.ts`**

In `client/apps/platform/src/app/blog/data.ts`:
- Change `id: number;` to `id: string;` in the `Post` interface.
- Delete the entire `export const POSTS: Post[] = [ ... ];` block (lines 32–311).
- Keep `Category`, `ContentBlock`, `Post`, and `CATEGORY_COLORS` exactly as they are.

- [ ] **Step 3: Split the index page**

`git mv client/apps/platform/src/app/blog/page.tsx client/apps/platform/src/app/blog/BlogIndexClient.tsx`, then edit `BlogIndexClient.tsx`:
- Change the import `import { type Category, type Post, POSTS, CATEGORY_COLORS } from './data';` to `import { type Category, type Post, CATEGORY_COLORS } from './data';`
- Rename the default-exported page component to `BlogIndexClient` and give it a `posts` prop: `export default function BlogIndexClient({ posts }: { posts: Post[] })`.
- Replace every use of `POSTS` inside the component with `posts` (filtering, featured selection, counts — search the file for `POSTS`).

Create the new `client/apps/platform/src/app/blog/page.tsx`:

```tsx
import BlogIndexClient from './BlogIndexClient';
import { getPosts } from './api';

export const revalidate = 300;

export default async function BlogPage() {
  const posts = await getPosts();
  return <BlogIndexClient posts={posts} />;
}
```

- [ ] **Step 4: Switch the detail page to fetch**

In `client/apps/platform/src/app/blog/[slug]/page.tsx`:
- Remove the `generateStaticParams` export entirely.
- Change the import `import { POSTS, CATEGORY_COLORS, type ContentBlock } from '../data';` to `import { CATEGORY_COLORS, type ContentBlock } from '../data';` and add `import { getPosts, getPostBySlug } from '../api';`.
- Add `export const revalidate = 300;` below the imports.
- In `BlogPostPage`, replace the post lookup lines:

```tsx
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const all = post ? await getPosts() : [];
  const related = all.filter(p => p.slug !== slug && p.category === post?.category).slice(0, 3);
  const others  = related.length < 2 ? all.filter(p => p.slug !== slug).slice(0, 3) : related;
```

- Replace the prev/next computation (`const postIndex = POSTS.findIndex...` block) with:

```tsx
  const postIndex = all.findIndex(p => p.slug === slug);
  const prevPost = postIndex > 0 ? all[postIndex - 1] : null;
  const nextPost = postIndex >= 0 && postIndex < all.length - 1 ? all[postIndex + 1] : null;
```

- Keep the existing "Article not found" JSX for the `!post` case (it already renders a friendly 404-style screen — no `notFound()` needed since the design's requirement is that unknown/draft slugs don't render a post).
- Search the rest of the file for any remaining `POSTS` references and replace with `all`.

- [ ] **Step 5: Verify**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/platform && npx tsc --noEmit 2>&1 | grep -E "app/blog" || echo CLEAN`
Expected: `CLEAN`

With the API server running (seeded), start the platform dev server and check `http://localhost:<platform-port>/blog` shows the 9 posts (hero + grid + category filters) and a detail page renders with content blocks, related posts, prev/next. A draft created in admin must NOT appear.

- [ ] **Step 6: Commit**

```bash
git add client/apps/platform/src/app/blog
git commit -m "feat(platform): blog pages fetch published posts from the API (ISR 300s)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification pass

**Files:** none new.

- [ ] **Step 1: Server test suite**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/`
Expected: all blog tests pass; overall failures limited to the pre-existing known ones (per project memory: ~2-3 pre-existing failures unrelated to blog).

- [ ] **Step 2: Admin + platform type checks**

Run both and confirm no NEW errors referencing blog files:
- `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -iE "blog" || echo CLEAN` → `CLEAN`
- `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -iE "app/blog" || echo CLEAN` → `CLEAN`

- [ ] **Step 3: End-to-end smoke (browser)**

1. Admin → Blog → Generate full post with AI (topic: "Pairing Nigerian small chops with sparkling wine") → review → Publish.
2. Platform `/blog` → new post appears (may need ~5 min ISR or a dev-server restart) → open detail page → blocks render.
3. Admin → unpublish the same post → confirm it disappears from platform after revalidate.

- [ ] **Step 4: Final commit (if any fixups) and report**

Report results: test counts, tsc status, smoke outcome, anything deferred.
```
