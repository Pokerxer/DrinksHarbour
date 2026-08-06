// services/snippet.service.js
//
// Validation for support snippets — the canned replies an operator drops into a
// live message from the compose drawer.
//
// The body is sanitized on the way IN, not on the way out. A snippet is written
// once and sent hundreds of times, so sanitizing at send time would leave the
// stored copy dangerous for every other consumer of it: the editor that loads it
// back, the list preview, an export. Storing only what is already safe means
// there is one moment where the rule is applied and no way to route around it.
//
// This module is pure. It never touches the database, so it can be exercised
// without one.

const sanitizeHtml = require('sanitize-html');
const { ValidationError } = require('../utils/errors');

const MAX_TITLE_LENGTH = 120;
/**
 * Snippet bodies are boilerplate, not documents. The compose route already
 * refuses a message body over 2 MB, and a snippet that approached that would be
 * unusable in the picker anyway.
 */
const MAX_BODY_LENGTH = 50000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 40;

/**
 * What a Quill editor actually emits, and nothing more.
 *
 * Deliberately narrower than mailBody.service's inbound allowlist: this HTML is
 * authored here and then sent out over our own domain, so there is no incoming
 * mail to render faithfully — only a formatting vocabulary to permit. No
 * <style>, no <img> (a snippet that embedded a remote image would leak the
 * recipient's open to a third party from OUR signature), no class or style
 * attributes to smuggle CSS through.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

function sanitize(html) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
    // No `data:` anywhere: the only tag that could carry one is gone, and
    // leaving the scheme allowed invites it back the next time a tag is added.
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // A link opened from a mail client should not be able to reach back into
    // the opener, and rel is not something the author should have to remember.
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
    disallowedTagsMode: 'discard',
  });
}

/**
 * Sanitizes a snippet body, refusing one that is empty once cleaned.
 *
 * "<script>alert(1)</script>" sanitizes to the empty string. Stored, it would
 * be a menu entry that silently inserts nothing — a bug the operator only finds
 * out about mid-reply — so an empty result is an error, not an empty snippet.
 */
function sanitizeSnippetBody(input) {
  if (input !== undefined && input !== null && typeof input !== 'string') {
    throw new ValidationError('Invalid snippet body');
  }
  const raw = String(input || '');
  if (raw.length > MAX_BODY_LENGTH) {
    throw new ValidationError(`That snippet body is too long (max ${MAX_BODY_LENGTH} characters)`);
  }

  const clean = sanitize(raw);
  if (!clean.replace(/<[^>]*>/g, '').trim()) {
    throw new ValidationError('A snippet body is required');
  }
  return clean;
}

/** Tags as an array or one comma-separated string; normalised and de-duplicated. */
function normalizeTags(input) {
  if (input === undefined || input === null || input === '') return [];
  const entries = Array.isArray(input) ? input : String(input).split(',');

  const tags = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') throw new ValidationError('Invalid tag');
    const tag = entry.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw new ValidationError(`That tag is too long (max ${MAX_TAG_LENGTH} characters)`);
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) {
    throw new ValidationError(`A snippet may carry at most ${MAX_TAGS} tags`);
  }
  return tags;
}

function normalizeTitle(input) {
  if (typeof input !== 'string') throw new ValidationError('A snippet title is required');
  const title = input.trim();
  if (!title) throw new ValidationError('A snippet title is required');
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`That title is too long (max ${MAX_TITLE_LENGTH} characters)`);
  }
  return title;
}

/**
 * A whole create payload. Returns ONLY the three writable fields — `createdBy`
 * is stamped by the controller from the session and is never read from the body.
 */
function validateSnippet(payload = {}) {
  return {
    title: normalizeTitle(payload.title),
    body: sanitizeSnippetBody(payload.body),
    tags: normalizeTags(payload.tags),
  };
}

/**
 * A partial update, carrying only the fields the request actually named.
 *
 * Building the full object and letting undefined ride along would blank the
 * body on a title-only edit, and a half-written snippet is discovered mid-reply.
 * An empty patch is refused rather than turned into a no-op write, because
 * "saved" over a request that changed nothing is a lie the UI would repeat.
 */
function validateSnippetPatch(payload = {}) {
  const patch = {};
  if (payload.title !== undefined) patch.title = normalizeTitle(payload.title);
  if (payload.body !== undefined) patch.body = sanitizeSnippetBody(payload.body);
  if (payload.tags !== undefined) patch.tags = normalizeTags(payload.tags);

  if (!Object.keys(patch).length) {
    throw new ValidationError('Nothing to update');
  }
  return patch;
}

module.exports = {
  sanitizeSnippetBody,
  normalizeTags,
  normalizeTitle,
  validateSnippet,
  validateSnippetPatch,
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
};
