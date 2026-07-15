// services/banner.helpers.js — pure helpers for the banner module (no DB, no network)
'use strict';

// Enums mirrored from models/Banner.js so the AI layer can validate/snap without
// importing the Mongoose model (keeps these helpers dependency-free + testable).
const BANNER_TYPES = ['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'];
const BANNER_PLACEMENTS = ['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'];
const BANNER_VISIBLE_TO = ['all', 'guests', 'authenticated', 'new_customers', 'returning_customers', 'vip'];
const BANNER_AI_STYLES = ['playful', 'elegant', 'urgent', 'calm'];
const CONTENT_POSITIONS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const TEXT_ALIGNMENTS = ['left', 'center', 'right'];

// Per-field AI authoring surfaced by the create-edit sparkle buttons. Mirrors the
// blog editor's per-block rewrite/expand/shorten (see blog.helpers isRewritableBlock).
const BANNER_TEXT_FIELDS = ['title', 'subtitle', 'ctaText'];
const AI_FIELD_ACTIONS = ['rewrite', 'expand', 'shorten', 'punchier'];
const ENHANCE_GOALS = ['urgency', 'engagement', 'trust', 'conversions'];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// A field can only be AI-enhanced when it's a known text field AND already has
// content to work on — an empty title has nothing for the model to improve.
function isEnhanceableField(field, value) {
  if (!BANNER_TEXT_FIELDS.includes(field)) return false;
  return String(value || '').trim().length > 0;
}

// Snap an arbitrary string to a known enum member (case-insensitive), else fallback.
function snapEnum(value, allowed, fallback = null) {
  const needle = String(value || '').trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === needle) || fallback;
}

// Validate a hex color, returning the fallback when it isn't a #RRGGBB string.
function snapHexColor(value, fallback = '#1a1a2e') {
  return HEX_COLOR_RE.test(value) ? value : fallback;
}

// Max lengths for the copy fields, matching the model's schema limits so AI output
// never overflows the stored document.
const FIELD_LIMITS = { title: 60, subtitle: 100, ctaText: 30 };

// Clamp one enhanced field value to its length limit, collapsing whitespace.
function clampField(field, value) {
  const limit = FIELD_LIMITS[field] || 100;
  return String(value || '').replace(/\s+/g, ' ').trim().substring(0, limit);
}

// Tolerant JSON extraction for model output: raw JSON, ```json fences, control
// chars, or JSON embedded in prose. Returns `defaultValue` on total failure so
// callers can fall back to demo content instead of throwing.
function parseAiJson(text, defaultValue = {}) {
  if (!text || typeof text !== 'string') return defaultValue;

  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = firstBrace === -1 ? firstBracket : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket));
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = lastBrace === -1 ? lastBracket : (lastBracket === -1 ? lastBrace : Math.max(lastBrace, lastBracket));

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }
}

// Normalize a raw AI banner object into a safe, schema-shaped record: clamp copy,
// validate colors, and snap position/alignment enums to known values.
function sanitizeBannerData(data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    title: clampField('title', typeof d.title === 'string' ? d.title : ''),
    subtitle: clampField('subtitle', typeof d.subtitle === 'string' ? d.subtitle : ''),
    ctaText: clampField('ctaText', typeof d.ctaText === 'string' ? d.ctaText : ''),
    backgroundColor: snapHexColor(d.backgroundColor, '#1a1a2e'),
    textColor: snapHexColor(d.textColor, '#ffffff'),
    tags: Array.isArray(d.tags) ? d.tags.slice(0, 10).map(String) : [],
    contentPosition: snapEnum(d.contentPosition, CONTENT_POSITIONS, 'center'),
    textAlignment: snapEnum(d.textAlignment, TEXT_ALIGNMENTS, 'center'),
    styleNote: typeof d.styleNote === 'string' ? d.styleNote : '',
  };
}

module.exports = {
  BANNER_TYPES,
  BANNER_PLACEMENTS,
  BANNER_VISIBLE_TO,
  BANNER_AI_STYLES,
  BANNER_TEXT_FIELDS,
  AI_FIELD_ACTIONS,
  ENHANCE_GOALS,
  CONTENT_POSITIONS,
  TEXT_ALIGNMENTS,
  FIELD_LIMITS,
  isEnhanceableField,
  snapEnum,
  snapHexColor,
  clampField,
  parseAiJson,
  sanitizeBannerData,
};
