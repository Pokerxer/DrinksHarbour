// controllers/blog.controller.js
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const asyncHandler = require('express-async-handler');
const BlogPost = require('../models/BlogPost');
const Product = require('../models/Product');
const {
  BLOG_CATEGORIES,
  slugify,
  dedupeSlug,
  computeReadTime,
  sanitizeContentBlocks,
  snapCategory,
  parseAiJson,
  extractInternalLinks,
  sanitizeInlineLinks,
} = require('../services/blog.helpers');

// Same AI setup as gemini.controller.js: Haiku for structured generation.
const HAIKU_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5';
// A stronger model for full-post generation, which needs more critical thinking.
const SMART_MODEL = process.env.ANTHROPIC_SMART_MODEL || 'claude-sonnet-4-6';
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

// Build a catalog of real, linkable products (+ their categories) for a topic so
// the AI can weave contextual internal links instead of inventing URLs.
async function buildLinkCatalog(topic) {
  const baseFilter = { status: 'approved', isPublished: true };
  const projection = { name: 1, slug: 1, category: 1, subCategory: 1, brand: 1 };
  let products = [];

  try {
    products = await Product.find(
      { ...baseFilter, $text: { $search: topic } },
      { ...projection, score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(24)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .populate('brand', 'name slug')
      .lean();
  } catch (_) {
    products = [];
  }

  // Fallback to recent products when the topic matches few/none.
  if (products.length < 6) {
    try {
      const seen = new Set(products.map((p) => String(p._id)));
      const extra = await Product.find(baseFilter, projection)
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(24)
        .populate('category', 'name slug')
        .populate('subCategory', 'name slug')
        .populate('brand', 'name slug')
        .lean();
      products = products.concat(extra.filter((p) => !seen.has(String(p._id))));
    } catch (_) {
      /* keep whatever we have */
    }
  }

  const entries = products
    .filter((p) => p && p.slug && p.name)
    .slice(0, 20)
    .map((p) => ({
      name: p.name,
      slug: p.slug,
      category: p.category?.name || '',
      categorySlug: p.category?.slug || '',
      subCategory: p.subCategory?.name || '',
      brand: p.brand?.name || '',
      brandSlug: p.brand?.slug || '',
    }));

  const categories = new Map();
  const brands = new Map();
  entries.forEach((e) => {
    if (e.categorySlug && !categories.has(e.categorySlug)) categories.set(e.categorySlug, e.category);
    if (e.brandSlug && !brands.has(e.brandSlug)) brands.set(e.brandSlug, e.brand);
  });

  const allowed = new Set();
  entries.forEach((e) => allowed.add(`/product/${e.slug}`));
  categories.forEach((_name, slug) => allowed.add(`/shop?category=${slug}`));
  brands.forEach((_name, slug) => allowed.add(`/shop?brand=${slug}`));

  return { entries, categories, brands, allowed };
}

function catalogToPrompt({ entries, categories, brands }) {
  if (!entries.length) return '';
  const productLines = entries
    .map((e) => {
      const tail = e.category ? ` (${e.category}${e.subCategory ? ` / ${e.subCategory}` : ''})` : '';
      return `- "${e.name}" → /product/${e.slug}${tail}`;
    })
    .join('\n');
  const categoryLines = [...categories.entries()]
    .map(([slug, name]) => `- "${name}" → /shop?category=${slug}`)
    .join('\n');
  const brandLines = [...(brands?.entries() || [])]
    .map(([slug, name]) => `- "${name}" → /shop?brand=${slug}`)
    .join('\n');

  return `

INTERNAL LINKING: weave 3-6 contextual internal links into paragraph, list, quote, or tip text using markdown syntax [anchor words](/path). Rules:
- Use ONLY links from the approved catalog below. NEVER invent a URL or product slug.
- The anchor must be natural words inside a sentence (e.g. "reach for a bottle of [Hennessy VS](/product/hennessy-vs)"), never the raw slug.
- Link each product at most once. Favour specific products; use a brand or category page only when no specific product fits.

Approved product links:
${productLines}${categoryLines ? `\n\nApproved category links:\n${categoryLines}` : ''}${brandLines ? `\n\nApproved brand links:\n${brandLines}` : ''}`;
}

// A product link must be in the catalog (prevents 404s); other internal paths are safe.
function makeLinkValidator(allowed) {
  return (href) => {
    if (allowed.has(href)) return true;
    if (href.startsWith('/product/')) return false;
    return href.startsWith('/shop') || href.startsWith('/blog') || href === '/';
  };
}

async function callHaikuJson(prompt, maxTokens, model = HAIKU_MODEL) {
  const message = await anthropic.messages.create({
    model,
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
  const catalog = await buildLinkCatalog(topic);

  const prompt = `Write a complete blog post for DrinksHarbour (Nigerian online drinks marketplace, Abuja-based) about: "${topic}".
${forcedCategory ? `The category MUST be exactly "${forcedCategory}".` : `Choose the single best category from: ${BLOG_CATEGORIES.join(', ')}.`}

Return ONLY this JSON shape:
{
  "title": "engaging title, max 70 chars",
  "excerpt": "compelling summary, max 40 words",
  "category": "one of: ${BLOG_CATEGORIES.join(' | ')}",
  "tags": ["3-5 short tags"],
  "imageAlt": "short alt text describing a fitting cover image, max 100 chars",
  "seo": {
    "metaTitle": "SEO title, max 60 chars",
    "metaDescription": "meta description, max 155 chars"
  },
  "content": [
    {"type": "p", "text": "..."},
    {"type": "h2", "text": "..."},
    {"type": "image", "src": "", "alt": "descriptive alt text", "caption": "short caption"},
    {"type": "ul", "items": ["...", "..."]},
    {"type": "tip", "text": "..."}
  ],
  "author": {"name": "a plausible Nigerian expert name", "role": "their job title", "bio": "1-2 sentence bio"}
}

Content rules: 600-900 words total; start with an intro paragraph; organize with "h2" section headings; include exactly one "tip" block with a practical pro tip; use "ul" or "ol" blocks with "items" for lists (all other block types use "text"); allowed block types are only: p, h2, h3, ul, ol, quote, tip, image. Insert 1-2 "image" blocks at natural break points (after a relevant section) as placeholders — ALWAYS leave "src" as an empty string (the author uploads the real photo), but write a specific "alt" and a short editorial "caption" describing the ideal photo. Use Nigerian context (naira prices, local brands, Lagos/Abuja references) where natural.
SEO rules: metaTitle should be click-worthy and under 60 chars; metaDescription should be an active-voice summary under 155 chars; both may differ from the title/excerpt to target search intent.
${catalogToPrompt(catalog)}`;

  let data;
  try {
    data = parseAiJson(await callHaikuJson(prompt, 4096, SMART_MODEL));
  } catch (err) {
    console.error('generatePost AI error:', err.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }

  // Strip any hallucinated product links, keeping only real catalog URLs.
  const content = sanitizeInlineLinks(sanitizeContentBlocks(data.content), makeLinkValidator(catalog.allowed));
  const linkCount = extractInternalLinks(content).length;
  if (linkCount) console.log(`generatePost: kept ${linkCount} internal link(s) for "${topic}"`);

  const seo = {
    metaTitle: String(data.seo?.metaTitle || '').slice(0, 60),
    metaDescription: String(data.seo?.metaDescription || '').slice(0, 160),
    ogImage: '',
  };

  res.json({
    title: String(data.title || topic),
    excerpt: String(data.excerpt || ''),
    category: snapCategory(data.category) || forcedCategory || 'Lifestyle',
    tags: Array.isArray(data.tags) ? data.tags.map(String).slice(0, 5) : [],
    imageAlt: String(data.imageAlt || '').slice(0, 125),
    seo,
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
  const ALLOWED = ['title', 'excerpt', 'tags', 'seoTitle', 'seoDescription', 'imageAlt'];
  if (!ALLOWED.includes(field)) {
    return res.status(400).json({ message: `field must be one of: ${ALLOWED.join(', ')}` });
  }
  const bodyText = sanitizeContentBlocks(post?.content)
    .map((b) => [b.text, ...(b.items || [])].filter(Boolean).join(' '))
    .join('\n')
    .slice(0, 6000);

  const asks = {
    title: 'Return {"value": "an engaging blog title, max 70 chars"}',
    excerpt: 'Return {"value": "a compelling excerpt, max 40 words"}',
    tags: 'Return {"value": ["3-5 short tags"]}',
    seoTitle: 'Return {"value": "an SEO-friendly title under 60 chars, targeting search intent"}',
    seoDescription: 'Return {"value": "a meta description in active voice under 155 chars"}',
    imageAlt: 'Return {"value": "short alt text describing a fitting cover image, max 100 chars"}',
  };
  const prompt = `Blog post title: "${post?.title || ''}"
Category: ${post?.category || 'unknown'}
Excerpt: "${post?.excerpt || ''}"
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

// One-shot SEO generation: fills metaTitle + metaDescription together so they
// read as a coherent pair in SERP/social previews.
const generateSeo = asyncHandler(async (req, res) => {
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });
  const { post } = req.body || {};
  if (!post?.title && !post?.content?.length) {
    return res.status(400).json({ message: 'Post needs a title or content before generating SEO' });
  }
  const bodyText = sanitizeContentBlocks(post?.content)
    .map((b) => [b.text, ...(b.items || [])].filter(Boolean).join(' '))
    .join('\n')
    .slice(0, 6000);

  const prompt = `You are an SEO specialist for DrinksHarbour, a Nigerian drinks marketplace blog.
Write SEO metadata for this blog post.

Post title: "${post?.title || ''}"
Category: ${post?.category || 'unknown'}
Excerpt: "${post?.excerpt || ''}"
Body:
${bodyText || '(empty)'}

Return ONLY this JSON shape:
{
  "metaTitle": "a click-worthy SEO title under 60 chars, targeting search intent",
  "metaDescription": "a meta description in active voice under 155 chars that encourages clicks"
}

The metaTitle and metaDescription must read as a coherent pair in a Google result. Do not repeat the brand name twice. Do NOT wrap the JSON in code fences.`;

  try {
    const data = parseAiJson(await callHaikuJson(prompt, 512));
    res.json({
      metaTitle: String(data.metaTitle || '').slice(0, 60),
      metaDescription: String(data.metaDescription || '').slice(0, 160),
    });
  } catch (err) {
    console.error('generateSeo AI error:', err.message);
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
  generateSeo,
};
