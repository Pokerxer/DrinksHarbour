// routes/mail.routes.js
//
// Mail is read live from IMAP — nothing is stored. Authorization is not done
// with route middleware but inside mailAccount.service.resolveAccount, which
// re-checks the caller against the requested account on every single request.

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const c = require('../controllers/mail.controller');
const snippets = require('../controllers/snippet.controller');
const sender = require('../services/mailSend.service');
const { ValidationError } = require('../utils/errors');
const { protect, attachTenant } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

// Attachments are held in memory and streamed to SMTP. Nothing is written to
// disk or uploaded anywhere — this mailbox leaves no trace on our side.
//
// The storage engine, not `limits`, is what enforces the 15 MB cap: multer's
// limits are per file, so `{ fileSize: 15MB, files: 10 }` alone would allow
// 150 MB resident before any total could be checked. `limits` stays as a
// cheaper outer bound that fails a single oversized file before the engine has
// to count it.
//
// `fieldSize` is declared rather than left to busboy, whose undeclared default
// is 1 MB per field. The message body is a *field*, not a file, so that default
// silently became the limit on how long a reply may be — and a reply carrying a
// quoted thread, or a pasted screenshot (which an HTML editor inlines as a
// base64 `data:` URI), passes it easily. The JSON path on the same route
// already accepts 10 MB (express.json), so the two were not even consistent.
// The field count comes down to pay for it: compose sends seven fields, and
// 12 × 2 MB is a smaller worst case than the 25 × 1 MB it replaces.
const upload = multer({
  storage: c.cappedMemoryStorage(sender.MAX_ATTACHMENT_BYTES),
  limits: {
    fileSize: sender.MAX_ATTACHMENT_BYTES,
    files: 10,
    fields: 12,
    fieldSize: 2 * 1024 * 1024,
  },
});

/**
 * Runs the multer middleware and turns its failures into 400s.
 *
 * Without this a MulterError reaches the global handler with no statusCode, so
 * it is served as a 500 whose message is masked to 'Internal server error' in
 * production — "your attachment is too big" would arrive as an unexplained
 * server fault. Mirrors imageUpload.middleware's wrapMulterMiddleware.
 */
const withAttachments = (req, res, next) =>
  upload.array('attachments', 10)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('That attachment is larger than the 15 MB limit'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Attach at most 10 files'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError(`Unexpected upload field: ${err.field}`));
      }
      // multer's own text for this is 'Field value too long', which names
      // neither the field nor the limit — on a compose form the field is
      // almost always the message body, and the operator needs to be told that
      // rather than left guessing which input to shorten.
      if (err.code === 'LIMIT_FIELD_VALUE') {
        return next(
          new ValidationError('That message body is too long — shorten it or attach it as a file')
        );
      }
      if (err.code === 'LIMIT_FIELD_COUNT') {
        return next(new ValidationError('Too many form fields in that request'));
      }
      return next(new ValidationError(err.message));
    }
    // The capped storage engine's own overflow error, which is a plain Error.
    if (err.code === 'LIMIT_TOTAL_SIZE') return next(new ValidationError(err.message));
    return next(err);
  });

/**
 * A much tighter budget for the two routes that actually emit mail.
 *
 * The router-wide limiter in server.js allows 240 requests a minute, which is a
 * fair read budget for a three-pane client but is also 240 messages a minute if
 * an admin session is ever stolen — enough to get the domain blacklisted before
 * anyone notices. Nobody composes 20 messages in a minute by hand.
 */
const composeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many messages sent, please slow down.' },
});

router.get('/accounts', c.getAccounts);
// Managing accounts is super_admin-only, enforced inside the service. The
// composeLimiter is borrowed as a brake on password-guessing through the
// create endpoint's verification login.
router.post('/accounts', composeLimiter, c.createAccount);
router.delete('/accounts/:accountId', c.removeAccount);

// Asks about an email address rather than a mailbox, so it sits alongside
// /accounts at the top level. Registered before the `:accountId` routes below;
// those all carry a second segment, so nothing is shadowed either way.
router.get('/context', c.getCustomerContext);

// Canned replies. Not tied to a mailbox either — the same snippet is inserted
// from whichever account the operator happens to be composing as. Registered
// above `:accountId` for the same reason as /context.
router.get('/snippets', snippets.listSnippets);
router.post('/snippets', snippets.createSnippet);
router.patch('/snippets/:id', snippets.updateSnippet);
router.delete('/snippets/:id', snippets.deleteSnippet);

router.get('/:accountId/folders', c.getFolders);
router.get('/:accountId/messages', c.getMessages);

// Registered ahead of the `:uid` route below. Express matches on method *and*
// path, and that route is a GET while these are POST/DELETE, so nothing would
// actually shadow anything today — but the two literal segments only stay
// unambiguous while that remains true, and the ordering costs nothing.
router.post('/:accountId/messages/flags', c.setFlags);
router.post('/:accountId/messages/move', c.moveMessages);
router.delete('/:accountId/messages', c.deleteMessages);

// Composing. These sit one segment below `:accountId`, not under `messages`,
// so they cannot collide with the `:uid` route at any depth. Both carry
// multipart bodies; withAttachments no-ops on a JSON one.
router.post('/:accountId/send', composeLimiter, withAttachments, c.sendMessage);
router.post('/:accountId/drafts', composeLimiter, withAttachments, c.saveDraft);

router.get('/:accountId/messages/:uid', c.getMessage);
router.get('/:accountId/messages/:uid/attachments/:index', c.getAttachment);

module.exports = router;
