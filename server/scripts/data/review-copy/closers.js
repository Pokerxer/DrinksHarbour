// scripts/data/review-copy/closers.js
//
// Trailing remarks appended to a minority of review bodies so the copy bank
// does not read as N identical strings. Deliberately about the ORDER (delivery,
// packaging, price) rather than the drink, so any closer can attach to any
// family without contradicting the body.
//
// The empty strings are load-bearing: they keep most reviews closer-free, which
// is how real review text actually looks.

const NEUTRAL_CLOSERS = [
  '', '', '', '',
  ' Delivery was quick too.',
  ' Packaging was solid, nothing damaged.',
  ' Arrived well wrapped.',
  ' Ordering was straightforward.',
  ' Turned up earlier than the estimate.',
  ' Bottle was sealed properly.',
];

// Only attached to 4★/5★ bodies — a 3★ review that ends "will reorder" reads false.
const POSITIVE_CLOSERS = [
  '', '', '',
  ' Will definitely reorder.',
  ' Already planning to order again.',
  ' Good value for what you get.',
  ' Would recommend it.',
];

// Only attached to 3★ bodies — a mild reservation.
const LUKEWARM_CLOSERS = [
  '', '', '', '',
  ' Might try something else next time.',
  ' Not sure it justifies the price though.',
  ' Fine, but nothing I would rush back for.',
  ' Does the job.',
];

module.exports = { NEUTRAL_CLOSERS, POSITIVE_CLOSERS, LUKEWARM_CLOSERS };
