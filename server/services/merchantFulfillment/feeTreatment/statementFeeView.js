"use strict";
// ADDITIVE sibling view (workstream Fb): composes the UNMODIFIED read-only
// settlement statement with the fee-treatment projection. settlement/statement.js
// is imported read-only and never modified; the fee section is a separate
// top-level key so existing statement consumers are unaffected. Pure reads
// only — no writes, no journal, no measurement.
const statement = require("../settlement/statement");
const projection = require("./projection");

const ADDITIVE = true;

async function child(childId, actor) {
  const view = await statement.child(childId, actor);
  const fees = await projection.projectView();
  return {
    ...view,
    feeTreatment: {
      additive: ADDITIVE,
      readOnly: true,
      projectionVersion: projection.projectionVersion,
      note: "No provider fee records exist; treatment is recorded-not-measured.",
      flows: fees.flows,
      importPoint:
        "server/services/merchantFulfillment/feeTreatment/policy.js activeForFlow(flow) — read-only import",
    },
  };
}

module.exports = { child, ADDITIVE };
