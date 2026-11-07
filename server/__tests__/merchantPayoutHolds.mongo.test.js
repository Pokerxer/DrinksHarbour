"use strict";
// Merchant payout uncertainty + currency + holds (workstream P). The sealed
// transport NEVER becomes money: a sealed submit leaves the transfer
// reserved in `executing` with the explicit reason; ONLY once-only
// authenticated provider evidence (MerchantPayoutEvidence,
// _id = provider:account:transferId) settles a transfer, and duplicate or
// late confirmations cannot reconcile again. Recorded holds reduce the
// statement-linked base exactly; FX conversion is produced only from the
// recorded policy source fields with a rate snapshot.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const PAYOUT_REASON = "No payout execution exists; payout policy requires review.";
const holdsPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/holds.js",
);
const fxPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/fx.js",
);
const transportPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/transport.js",
);
const evidenceModelPath = path.resolve(
  __dirname,
  "../models/MerchantPayoutEvidence.js",
);

test(
  "recorded payout holds conserve the statement-linked base and an unreconciled statement refuses transfers with its recorded reason",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(holdsPath), "payout/holds module exists");
    await connectVenueMongo(t, "payout_holds");
    const fixture = await require("./helpers/payoutFixture").twoChildren();
    const { tenantA, tenantB, childA, childB, root, orderB } = fixture;
    const Hold = require("../models/MerchantPayoutHold");
    const Balance = require("../models/MerchantPayoutBalance");
    const Transfer = require("../models/MerchantPayoutTransfer");
    const policyAuthority = require("../services/merchantFulfillment/payout/policy");
    const holds = require("../services/merchantFulfillment/payout/holds");
    const payout = require("../services/merchantFulfillment/payout/transfer");
    await require("../models/MerchantPayoutBalance").syncIndexes();
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    t.after(() => {
      delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
    });

    // 1. Without a recorded payout contract, holds refuse with the verbatim
    //    payout posture, zero writes.
    await assert.rejects(
      () =>
        holds.recordHold(
          {
            childId: String(childA._id),
            amountMinor: 400,
            reason: "Synthetic dispute pending",
            idempotencyKey: "hold-1",
          },
          root,
        ),
      (error) => error.statusCode === 409 && error.message === PAYOUT_REASON,
    );
    assert.equal(await Hold.countDocuments(), 0);
    assert.equal(await Balance.countDocuments(), 0);

    // 2. The recorded standing hold (500) plus a recorded hold (400) reduce
    //    the transferable base exactly (1600 − 900 = 700).
    await policyAuthority.record(
      {
        scheduleRule: "Weekly on the third business day after settlement",
        currencyMode: "original_transaction_currency",
        destinationAccountSource: "tenant_payout_account_reference",
        holdRegime: "recorded_holds_and_standing_minor",
        standingHoldMinor: 500,
        clawbackRule: "via_recorded_subsequent_hold",
        nettingRule: "statement_net_receivable_only",
        minimumThresholdMinor: 1000,
        decisionReference: "TEST-HOLD-DECISION-1",
      },
      root,
    );
    const held = await holds.recordHold(
      {
        childId: String(childA._id),
        amountMinor: 400,
        reason: "Synthetic dispute pending",
        idempotencyKey: "hold-1",
      },
      root,
    );
    assert.equal(held.status, "recorded");
    assert.equal(held.hold.amountMinor, 400);
    const replay = await holds.recordHold(
      {
        childId: String(childA._id),
        amountMinor: 400,
        reason: "Synthetic dispute pending",
        idempotencyKey: "hold-1",
      },
      root,
    );
    assert.equal(replay.status, "already_recorded");
    assert.equal(await Hold.countDocuments(), 1);

    // 3. Holds cannot exceed the statement net receivable (refused, zero
    //    writes), and an over-transfer beyond the held base refuses.
    const heldBefore = await Balance.findById(String(childA._id)).lean();
    await assert.rejects(
      () =>
        holds.recordHold(
          {
            childId: String(childA._id),
            amountMinor: 701,
            reason: "Synthetic excessive hold",
            idempotencyKey: "hold-2",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /transferable receivable/);
        return true;
      },
    );
    assert.equal(await Hold.countDocuments(), 1);
    assert.equal((await Balance.findById(String(childA._id)).lean()).heldMinor, heldBefore.heldMinor);
    await assert.rejects(
      () =>
        payout.prepare(
          {
            childId: String(childA._id),
            amountMinor: 701,
            destinationAccountReference: "payout-account-ref-1",
            idempotencyKey: "held-over",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(
          error.message,
          "Payout amount exceeds the remaining transferable receivable (700 minor) for the linked settlement statement; conservation requires a smaller amount.",
        );
        return true;
      },
    );
    assert.equal(await Transfer.countDocuments(), 0);

    // 4. The exact held base prepares (conservation exactness).
    const prepared = await payout.prepare(
      {
        childId: String(childA._id),
        amountMinor: 700,
        destinationAccountReference: "payout-account-ref-1",
        idempotencyKey: "held-exact",
      },
      root,
    );
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.transfer.heldTotalMinor, 900);
    assert.equal(prepared.transfer.transferableBaseMinor, 700);

    // 5. An uncertain refund makes the OTHER child's statement
    //    needs_review; the payout command refuses with the statement's own
    //    recorded reason and zero payout writes.
    const Refund = require("../services/merchantFulfillment/refunds");
    process.env.MERCHANT_REFUNDS_ENABLED = "true";
    const refundTransport = require("../services/merchantFulfillment/refundTransport");
    t.mock.method(refundTransport, "submit", async () => {
      throw new Error("synthetic transport outage");
    });
    const requested = await Refund.request(
      childB._id,
      { amountMinor: 300, idempotencyKey: "uncertain-refund", reason: "Synthetic uncertainty" },
      root,
    );
    await assert.rejects(
      () => Refund.execute(String(requested._id), root),
      /synthetic transport outage/,
    );
    delete process.env.MERCHANT_REFUNDS_ENABLED;
    const statementChild = await require(
      "../services/merchantFulfillment/settlement/statement",
    ).child(childB._id, root);
    assert.equal(statementChild.reconciliation.state, "needs_review");
    await assert.rejects(
      () =>
        payout.prepare(
          {
            childId: String(childB._id),
            amountMinor: 100,
            destinationAccountReference: "payout-account-ref-2",
            idempotencyKey: "unreconciled-1",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /^Settlement statement is not reconciled/);
        return true;
      },
    );
    assert.equal(await Transfer.countDocuments({ child: String(childB._id) }), 0);
  },
);

