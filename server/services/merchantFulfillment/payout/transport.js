"use strict";
// SEALED payout transfer transport (workstream P) — carrier-external
// precedent. The interface exists exactly like the refund transport, but no
// reviewed money-rails provider contract exists in this system, so the
// transport is physically sealed: any real attempt refuses with the explicit
// sealed-reason and zero side effects. Operators inject the synthetic
// transport in tests by mocking at this boundary (`t.mock.method`), never by
// editing the seal. A later reviewed & certified rails contract becomes the
// EXTERNAL gate: implement an adapter behind this interface only after the
// provider protocol review + hosted certification evidence exists, and record
// it in the payout policy as decisions — never implied by a flag alone.
const { ConflictError } = require("../../../utils/errors");

async function submit(payload) {
  if (payload?.kind !== "payout_transfer")
    throw new ConflictError("Unsupported payout operation");
  throw new ConflictError(
    "Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate).",
  );
}

module.exports = { submit };
