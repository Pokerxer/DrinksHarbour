// controllers/snippet.controller.js
//
// CRUD for support snippets. Mounted under /api/mail because that is what a
// snippet is for — the compose drawer inserts them — and mounting it there means
// it inherits the mail router's `protect` and reuses the mail module's own role
// list rather than growing a second, separately-drifting copy of it.
//
// Bodies are sanitized by snippet.service before they are written. This
// controller is the only writer of Snippet.body, which is what makes that
// guarantee hold.

const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { AppError, NotFoundError } = require('../utils/errors');
const accounts = require('../services/mailAccount.service');
const snippets = require('../services/snippet.service');
const Snippet = require('../models/Snippet');

/** The most snippets one list request returns. A team's canned replies are dozens. */
const MAX_SNIPPETS = 200;

/**
 * A database outage is an error, never an empty list.
 *
 * The picker in the compose drawer would render "no snippets yet" over an
 * unreachable database, and the operator would write the reply out by hand
 * believing their team had never saved one.
 */
function requireDatabase() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new AppError('Snippets are unavailable right now', 503, true);
  }
}

function present(doc) {
  const author = doc.createdBy && typeof doc.createdBy === 'object' ? doc.createdBy : null;
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    tags: doc.tags || [],
    createdBy: author?._id
      ? {
          id: String(author._id),
          name:
            [author.firstName, author.lastName].filter(Boolean).join(' ') ||
            author.email ||
            'Unknown',
        }
      : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

/** Rejects a malformed id as "not found" rather than letting Mongoose throw a 500. */
function objectId(value) {
  const id = String(value || '');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('That snippet does not exist');
  }
  return id;
}

const listSnippets = asyncHandler(async (req, res) => {
  accounts.assertMailReader(req.user);
  requireDatabase();

  const docs = await Snippet.find()
    .sort({ updatedAt: -1 })
    .limit(MAX_SNIPPETS)
    .populate('createdBy', 'firstName lastName email')
    .lean();

  successResponse(res, docs.map(present), 'Snippets retrieved');
});

const createSnippet = asyncHandler(async (req, res) => {
  accounts.assertMailReader(req.user);
  requireDatabase();

  const fields = snippets.validateSnippet(req.body || {});
  const doc = await Snippet.create({ ...fields, createdBy: req.user._id });
  // Re-read so the response carries the author the list would show, rather than
  // a bare ObjectId the client would have to special-case.
  const saved = await Snippet.findById(doc._id)
    .populate('createdBy', 'firstName lastName email')
    .lean();

  successResponse(res, present(saved), 'Snippet created', 201);
});

const updateSnippet = asyncHandler(async (req, res) => {
  accounts.assertMailReader(req.user);
  requireDatabase();

  // A partial patch: a title-only edit must not blank the body.
  const patch = snippets.validateSnippetPatch(req.body || {});
  const doc = await Snippet.findByIdAndUpdate(objectId(req.params.id), patch, {
    new: true,
    runValidators: true,
  })
    .populate('createdBy', 'firstName lastName email')
    .lean();

  if (!doc) throw new NotFoundError('That snippet does not exist');
  successResponse(res, present(doc), 'Snippet updated');
});

const deleteSnippet = asyncHandler(async (req, res) => {
  accounts.assertMailReader(req.user);
  requireDatabase();

  const doc = await Snippet.findByIdAndDelete(objectId(req.params.id));
  if (!doc) throw new NotFoundError('That snippet does not exist');
  successResponse(res, { id: String(doc._id) }, 'Snippet deleted');
});

module.exports = {
  listSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  present,
  MAX_SNIPPETS,
};
