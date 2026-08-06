// services/mailBody.service.js
//
// Parsing and sanitizing message bodies. Everything in here treats its input
// as hostile: an email body is HTML written by a stranger, delivered into a
// page that holds an authenticated admin session.
//
// The client renders the output inside a sandboxed iframe as well. Two layers,
// because either one alone has been enough to burn people.

const sanitizeHtml = require('sanitize-html');
const { simpleParser } = require('mailparser');

const ALLOWED_TAGS = [
  'p', 'div', 'span', 'br', 'hr', 'a', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'img', 'font', 'center', 'small', 'sub', 'sup',
];

/**
 * Sanitizes a message body.
 *
 * Remote images are removed unless the reader explicitly asks for them: an
 * <img> pointing at the sender's server is a read receipt that also hands over
 * the reader's IP address. Embedded data: and cid: images are always kept —
 * they cannot phone home.
 *
 * NOTE on cid: nothing in this feature serves cid: parts, so a cid: image
 * renders as a broken image in the reading pane rather than as a blocked one.
 * Resolving them into data: URIs is deliberately out of scope here.
 */
function sanitizeBody(html, { allowRemoteImages = false } = {}) {
  let blockedRemoteImages = 0;

  const clean = sanitizeHtml(String(html || ''), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'name', 'title', 'target', 'rel'],
      // data-blocked-remote is set by the transform below. sanitize-html filters
      // attributes *after* transformTags runs, so without listing it here the
      // marker the transform just added would be stripped straight back off and
      // the client would have no way to draw a placeholder for a blocked image.
      img: ['src', 'alt', 'title', 'width', 'height', 'style', 'data-blocked-remote'],
      '*': ['style', 'align', 'valign', 'bgcolor', 'colspan', 'rowspan', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data', 'cid'] },
    allowProtocolRelative: false,
    // style is allowed for layout fidelity but positioning is not: a fixed or
    // absolutely-positioned element inside the frame can cover the whole body.
    allowedStyles: {
      '*': {
        color: [/^.*$/],
        'background-color': [/^.*$/],
        'text-align': [/^.*$/],
        'font-size': [/^.*$/],
        'font-weight': [/^.*$/],
        'font-family': [/^.*$/],
        'text-decoration': [/^.*$/],
        margin: [/^.*$/],
        padding: [/^.*$/],
        border: [/^.*$/],
        width: [/^.*$/],
        'max-width': [/^.*$/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
      img: (tagName, attribs) => {
        const src = attribs.src || '';
        // A srcless <img> — the spacer/shim that real marketing mail is full of
        // — fetches nothing, so it must not be counted as a blocked image or
        // the reading pane offers "Show 3 blocked images" that loads nothing.
        if (!src) return { tagName: 'img', attribs };
        const isEmbedded = src.startsWith('data:') || src.startsWith('cid:');
        if (!isEmbedded && !allowRemoteImages) {
          blockedRemoteImages += 1;
          const { src: _dropped, ...rest } = attribs;
          return { tagName: 'img', attribs: { ...rest, 'data-blocked-remote': 'true' } };
        }
        return { tagName: 'img', attribs };
      },
    },
  });

  return { html: clean, blockedRemoteImages };
}

const addr = (obj) => ({
  name: obj?.value?.[0]?.name || '',
  address: obj?.value?.[0]?.address || '',
});

const addrList = (obj) =>
  (obj?.value || []).map((a) => ({ name: a.name || '', address: a.address || '' }));

/** Parses raw RFC822 into headers, body and an attachment manifest. */
async function parseMessage(source) {
  const parsed = await simpleParser(source);

  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? String(parsed.references).trim().split(/\s+/)
      : [];

  return {
    subject: parsed.subject || '(no subject)',
    from: addr(parsed.from),
    to: addrList(parsed.to),
    cc: addrList(parsed.cc),
    date: parsed.date || null,
    messageId: parsed.messageId || null,
    inReplyTo: parsed.inReplyTo || null,
    references,
    // textAsHtml is the fallback for text-only mail; without it a plain
    // message renders as a single unbroken paragraph.
    html: parsed.html || parsed.textAsHtml || '',
    text: parsed.text || '',
    attachments: (parsed.attachments || []).map((a, index) => ({
      index,
      filename: a.filename || `attachment-${index + 1}`,
      contentType: a.contentType || 'application/octet-stream',
      size: a.size || 0,
      isInline: a.contentDisposition === 'inline',
    })),
  };
}

/** Returns one attachment's raw buffer by manifest index, or null. */
async function extractAttachment(source, index) {
  const parsed = await simpleParser(source);
  const attachment = (parsed.attachments || [])[index];
  if (!attachment || !attachment.content) return null;
  return {
    filename: attachment.filename || `attachment-${index + 1}`,
    contentType: attachment.contentType || 'application/octet-stream',
    content: attachment.content,
  };
}

// ── attachment response headers ─────────────────────────────────────────────
//
// Both the filename and the content type of an attachment are written by
// whoever sent the mail. They are echoed into response headers, which makes
// them an injection surface, so they are rebuilt here rather than passed
// through.

const MIME_TOKEN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

// Types a browser will execute in the response's own origin. Content-Disposition
// alone is not a guarantee across every client, and this API's origin also
// serves cookie-authenticated storefront routes — an .html attachment rendered
// there would be same-origin script. Everything on this list is downgraded.
const ACTIVE_TYPES = new Set([
  'text/html',
  'text/xml',
  'text/xsl',
  'application/xml',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
]);

/** Reduces a sender-supplied content type to something safe to echo back. */
function safeContentType(contentType) {
  const base = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!MIME_TOKEN.test(base) || ACTIVE_TYPES.has(base)) return 'application/octet-stream';
  return base;
}

/**
 * Builds a Content-Disposition value for a sender-supplied filename.
 *
 * Three separate problems, all reachable from a crafted message:
 *   - CR/LF (and any other control character) splits the header.
 *   - A `"` or a trailing `\` escapes out of the quoted-string; `/` and `\`
 *     also let the name act as a path when the client writes it to disk.
 *   - A non-ASCII character makes Node's own res.setHeader throw
 *     ERR_INVALID_CHAR, turning the download into an opaque 500. So the quoted
 *     form is transliterated to ASCII and the real name is carried in the
 *     RFC 5987 `filename*` parameter, which every current browser prefers.
 */
function contentDispositionFor(filename) {
  const stripped = String(filename || '').replace(/[\u0000-\u001f\u007f]/g, '');
  const base = stripped.split(/[\\/]/).pop() || '';
  // Slicing by code point, not code unit: cutting a surrogate pair in half
  // makes encodeURIComponent throw URIError.
  const trimmed = [...base].slice(0, 120).join('').trim();
  const safe = /^\.*$/.test(trimmed) ? 'attachment' : trimmed;

  const ascii = safe.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'attachment';

  let extended = '';
  try {
    // encodeURIComponent leaves ' ( ) * unescaped, and none of them is an
    // attr-char, so they are percent-encoded by hand.
    const encoded = encodeURIComponent(safe).replace(
      /['()*]/g,
      (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
    );
    extended = `; filename*=UTF-8''${encoded}`;
  } catch {
    // Lone surrogate in the filename. The ASCII form above still identifies
    // the file, so drop the extended parameter rather than failing the
    // download over a cosmetic header.
  }

  return `attachment; filename="${ascii}"${extended}`;
}

/**
 * The full header set for an attachment response.
 *
 * nosniff and the CSP are what stop the bytes being treated as active content
 * if the disposition is ever ignored; no-store keeps mail out of every cache,
 * in line with this feature persisting nothing anywhere.
 */
function attachmentHeaders({ filename, contentType }) {
  return {
    'Content-Type': safeContentType(contentType),
    'Content-Disposition': contentDispositionFor(filename),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, no-store',
  };
}

module.exports = {
  sanitizeBody,
  parseMessage,
  extractAttachment,
  attachmentHeaders,
  safeContentType,
  contentDispositionFor,
};
