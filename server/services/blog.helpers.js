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

// Inline internal links use markdown syntax with an internal (leading-slash) href:
//   [anchor words](/product/some-slug)
const INTERNAL_LINK_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

// Collect every internal link across a content array (for logging / validation).
function extractInternalLinks(content) {
  const blocks = Array.isArray(content) ? content : [];
  const out = [];
  const scan = (text) => {
    if (typeof text !== 'string') return;
    const re = new RegExp(INTERNAL_LINK_RE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) out.push({ text: m[1], href: m[2] });
  };
  blocks.forEach((b) => {
    if (!b) return;
    scan(b.text);
    (Array.isArray(b.items) ? b.items : []).forEach(scan);
  });
  return out;
}

function stripDisallowedLinks(text, isAllowed) {
  if (typeof text !== 'string') return text;
  return text.replace(INTERNAL_LINK_RE, (full, anchor, href) =>
    isAllowed(href) ? full : anchor
  );
}

// Replace links whose href fails `isAllowed(href)` with their plain anchor text,
// so hallucinated product URLs never ship as broken links.
function sanitizeInlineLinks(content, isAllowed) {
  const blocks = Array.isArray(content) ? content : [];
  return blocks.map((b) => {
    if (!b) return b;
    return {
      ...b,
      text: typeof b.text === 'string' ? stripDisallowedLinks(b.text, isAllowed) : b.text,
      items: Array.isArray(b.items) ? b.items.map((it) => stripDisallowedLinks(it, isAllowed)) : b.items,
    };
  });
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
  extractInternalLinks,
  sanitizeInlineLinks,
};
