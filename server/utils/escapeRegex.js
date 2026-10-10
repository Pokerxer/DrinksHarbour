// server/utils/escapeRegex.js
//
// One canonical escaper for user input going into a RegExp.
//
// The bug this exists to stop: `new RegExp(userInput, 'i')` throws a
// SyntaxError on any metacharacter, and inside an asyncHandler that surfaces
// to the client as a 500 with a raw V8 message. Typing "(" into the product
// search box on the purchase edit page returned:
//
//   HTTP 500  Invalid regular expression: /(/i: Unterminated group
//
// A search box is not a regex editor, so every metacharacter must be matched
// literally. There were six private copies of this function before it lived
// here, which is exactly why the files without a local copy (subproduct,
// search, user) were the ones that shipped the bug.

/** Escape every RegExp metacharacter so `term` matches only itself. */
function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
