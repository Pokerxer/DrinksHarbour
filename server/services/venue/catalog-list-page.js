'use strict';
const { ObjectId } = require('mongoose').Types;
const { fail, requireId } = require('./errors');
function listPage(args, direction = 1) {
  const limit = args.limit === undefined ? 100 : Number(args.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    fail('INVALID_INPUT', 'Choose a catalogue page size from 1 to 100', 400);
  let after = {};
  if (args.cursor !== undefined) {
    requireId(args.cursor);
    after = { _id: { [direction === 1 ? '$gt' : '$lt']: new ObjectId(args.cursor) } };
  }
  return { limit, after };
}
function pageRows(rows, limit) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? String(items.at(-1)._id) : null };
}
module.exports = { listPage, pageRows };
