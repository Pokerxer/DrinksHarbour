"use strict";
// Workstream Fb barrel — the provider fee bearer AUTHORITY mechanism surface.
// policy: super_admin-only immutable versioned recording (audited).
// projection: pure record projection; fail-closed "not recorded" per flow;
// never outputs fee figures.
// statementFeeView: ADDITIVE sibling composing the unmodified settlement
// statement with the fee projection. Pure read.
// No execution surface exists (no fee journal writer in the marketplace
// path) — hence deliberately no execution flag; see policy.js header.
module.exports = {
  policy: require("./policy"),
  projection: require("./projection"),
  statementFeeView: require("./statementFeeView"),
};
