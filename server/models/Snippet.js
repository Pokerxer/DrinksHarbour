// models/Snippet.js
//
// A canned reply an operator inserts into a support message from the compose
// drawer. Replaces the Hydrogen demo "snippets and templates" data — the two
// were the same thing under two names, so there is one model and one page.
//
// `body` is HTML that has ALREADY passed snippet.service.sanitizeSnippetBody.
// Nothing writes this field without going through that function; the schema
// cannot enforce it, so the controller is the only writer.

const mongoose = require('mongoose');

const snippetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// The list is always newest-first, and the tag filter is the only other query.
snippetSchema.index({ updatedAt: -1 });
snippetSchema.index({ tags: 1 });

module.exports = mongoose.models.Snippet || mongoose.model('Snippet', snippetSchema);
