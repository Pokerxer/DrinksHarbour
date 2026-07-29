// services/blog.helpers.js — pure helpers for the blog module (no DB, no network)
'use strict';

const BLOG_CATEGORIES = ['Wine Guide', 'Spirits Guide', 'Beer Guide', 'Recipes', 'Entertaining', 'Lifestyle'];
const BLOCK_TYPES = ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'tip', 'image'];

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
    .map((b) => {
      if (b.type === 'image') {
        return {
          type: 'image',
          src: typeof b.src === 'string' ? b.src : '',
          alt: typeof b.alt === 'string' ? b.alt : '',
          caption: typeof b.caption === 'string' ? b.caption : '',
        };
      }
      return {
        type: b.type,
        text: typeof b.text === 'string' ? b.text : '',
        items: Array.isArray(b.items) ? b.items.map(String) : [],
      };
    });
}

function snapCategory(value) {
  const needle = String(value || '').trim().toLowerCase();
  return BLOG_CATEGORIES.find((c) => c.toLowerCase() === needle) || null;
}

// Inline links use markdown syntax. Internal hrefs start with "/"; external
// hrefs are absolute http(s) URLs:
//   [anchor words](/product/some-slug)
//   [NAFDAC](https://www.nafdac.gov.ng/)
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;

function isInternalHref(href) {
  return typeof href === 'string' && href.startsWith('/');
}

// Collect every markdown link across a content array (for logging / validation).
function extractLinks(content) {
  const blocks = Array.isArray(content) ? content : [];
  const out = [];
  const scan = (text) => {
    if (typeof text !== 'string') return;
    const re = new RegExp(LINK_RE.source, 'g');
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

// Internal-only view, kept for callers that only care about catalog links.
function extractInternalLinks(content) {
  return extractLinks(content).filter((l) => isInternalHref(l.href));
}

function stripDisallowedLinks(text, isAllowed) {
  if (typeof text !== 'string') return text;
  return text.replace(new RegExp(LINK_RE.source, 'g'), (full, anchor, href) =>
    isAllowed(href) ? full : anchor
  );
}

// Replace links whose href fails `isAllowed(href)` with their plain anchor text,
// so hallucinated or dead URLs never ship as broken links. Only the markup is
// removed — the anchor words stay in the sentence.
function sanitizeLinks(content, isAllowed) {
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

// Internal-only sanitize: external links are left untouched here, because
// external verification runs as its own pass.
function sanitizeInlineLinks(content, isAllowed) {
  return sanitizeLinks(content, (href) => (isInternalHref(href) ? isAllowed(href) : true));
}

// Tolerant JSON extraction for model output: raw JSON, ```json fences, or JSON embedded in prose.
// Per-block AI authoring actions surfaced by the admin editor's sparkle menu.
const AI_BLOCK_ACTIONS = ['rewrite', 'expand', 'shorten'];
// Block types that carry prose the AI can meaningfully rewrite. Image blocks are
// excluded — they hold a URL, not text.
const REWRITABLE_BLOCK_TYPES = ['p', 'h2', 'h3', 'quote', 'tip', 'ul', 'ol'];

// True only when the block is a rewritable type AND actually has content to work
// on — an empty paragraph or an all-blank list has nothing for the AI to improve.
function isRewritableBlock(block) {
  if (!block || !REWRITABLE_BLOCK_TYPES.includes(block.type)) return false;
  if (block.type === 'ul' || block.type === 'ol') {
    return Array.isArray(block.items) && block.items.some((it) => String(it || '').trim());
  }
  return String(block.text || '').trim().length > 0;
}

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

// With server-side tools declared, a response's content array leads with
// server_tool_use / web_search_tool_result blocks and may split the answer over
// several text blocks — content[0].text is not the answer.
function textFromMessage(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  return blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
}

module.exports = {
  BLOG_CATEGORIES,
  textFromMessage,
  BLOCK_TYPES,
  AI_BLOCK_ACTIONS,
  REWRITABLE_BLOCK_TYPES,
  isRewritableBlock,
  slugify,
  dedupeSlug,
  computeReadTime,
  sanitizeContentBlocks,
  snapCategory,
  parseAiJson,
  isInternalHref,
  extractLinks,
  sanitizeLinks,
  extractInternalLinks,
  sanitizeInlineLinks,
};
