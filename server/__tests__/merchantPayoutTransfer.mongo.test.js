"use strict";
// Merchant payout transfer COMMAND (workstream P) — statement-linked
// once-only transfer records against the read-only settlement statement
// projection. The statement module (settlement/statement.js) is an UNMODIFIED
// read-import; the payout readiness posture ("No payout execution exists;
// payout policy requires review.") is the verbatim fail-closed wording for
// every flagged-off or unrecorded-contract path, with zero writes.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { oid } = require("./helpers/payoutFixture");

const transferPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/transfer.js",
);
const statementLinkPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/statementLink.js",
);
const PAYOUT_REASON = "No payout execution exists; payout policy requires review.";
const POLICY_V1 = {
  scheduleRule: "Weekly on the third business day after settlement",
  currencyMode: "original_transaction_currency",
  destinationAccountSource: "tenant_payout_account_reference",
  holdRegime: "recorded_holds_and_standing_minor",
  standingHoldMinor: 500,
  clawbackRule: "via_recorded_subsequent_hold",
  nettingRule: "statement_net_receivable_only",
  minimumThresholdMinor: 1000,
  decisionReference: "TEST-PAYOUT-DECISION-1",
};

test(
  "payout transfer command is fail-closed without flag or recorded contract, conserves exactly against the linked statement, and executes once",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(transferPath), "payout/transfer command exists");
    assert.ok(
      fs.existsSync(statementLinkPath),
      "payout/statementLink module exists",
    );
    await connectVenueMongo(t, "payout_transfer");
    const fixture = await require("./helpers/payoutFixture").twoChildren("payout_transfer");
    const { tenantA, tenantB, childA, childB, root, merchantA, merchantB } = fixture;
    const Transfer = require("../models/MerchantPayoutTransfer");
    const Balance = require("../models/MerchantPayoutBalance");
    const policy = require("../services/merchantFulfillment/payout/policy");
    const payout = require("../services/merchantFulfillment/payout/transfer");
    const transport = require("../services/merchantFulfillment/payout/transport");
    await require("../models/MerchantPayoutPolicy").syncIndexes();

    const prepare = (child, amount, key, actor = root) =>
      payout.prepare(
        {
          childId: String(child),
          amountMinor: amount,
          destinationAccountReference: "payout-account-ref-1",
          idempotencyKey: key,
        },
        actor,
      );

    // 1. Default-off flag: the verbatim statement payout posture, zero writes.
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "false";
    t.after(() => {
      delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
    });
    await assert.rejects(() => prepare(childA._id, 1100, "p1"), (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.message, PAYOUT_REASON);
      return true;
    });
    assert.equal(await Transfer.countDocuments(), 0, "flag-off prepare writes nothing");

    // 2. Flag on, no recorded contract: the same verbatim posture, zero writes.
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    await assert.rejects(
      () => prepare(childA._id, 1100, "p1"),
      (error) =>
        error.statusCode === 409 && error.message === PAYOUT_REASON,
    );
    assert.equal(await Transfer.countDocuments(), 0);
    assert.equal(await Balance.countDocuments(), 0);

    // 3. Tenant actors are not payout execution operators.
    await assert.rejects(() => prepare(childA._id, 1100, "p1", merchantA), /Platform admin/);
    assert.equal(await Transfer.countDocuments(), 0);

    // 4. Record the payout contract; the standing hold reduces the
    //    transferable statement base exactly (1600 − 500 = 1100).
    await policy.record(POLICY_V1, root);
    await assert.rejects(
      () => prepare(childA._id, 2000, "p-over"),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /exceeds the remaining transferable receivable/);
        return true;
      },
    );
    assert.equal(await Transfer.countDocuments(), 0, "over-transfer refused with zero writes");

    // 5. An exact-base transfer prepares; the anchor pins the linked
    //    statement version and every source figure it consumed.
    const prepared = await prepare(childA._id, 1100, "p1");
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.transfer.state, "prepared");
    assert.equal(prepared.transfer.amountMinor, 1100);
    assert.equal(prepared.transfer.currency, "NGN");
    assert.equal(prepared.transfer.statementVersion, 1);
    assert.equal(prepared.transfer.netReceivableMinor, 1600);
    assert.equal(prepared.transfer.heldTotalMinor, 500);
    assert.equal(prepared.transfer.transferableBaseMinor, 1100);
    assert.equal(prepared.transfer.destinationAccountReference, "payout-account-ref-1");
    assert.equal(prepared.transfer.policyVersion, 1);
    assert.equal(prepared.transfer.policySnapshot.holdRegime, "recorded_holds_and_standing_minor");
    assert.equal(prepared.transfer.destinationAccountSource, "tenant_payout_account_reference");
    assert.equal(prepared.transfer.conversion, null);

    // 6. The same key replays write-free; a different statement-linked
    //    command key is a distinct anchor.
    const replay = await prepare(childA._id, 1100, "p1");
    assert.equal(replay.status, "already_prepared");
    assert.deepEqual(replay.transfer._id, prepared.transfer._id);
    assert.equal(await Transfer.countDocuments(), 1);

    // 7. Execution requires a recorded review.
    await assert.rejects(
      () => payout.execute(String(prepared.transfer._id), root),
      /review/i,
    );
    await assert.rejects(
      () => payout.markReviewed(String(prepared.transfer._id), merchantA),
      /Platform admin/,
    );
    const reviewed = await payout.markReviewed(String(prepared.transfer._id), root);
    assert.equal(reviewed.transfer.state, "reviewed");
    assert.equal(String(reviewed.transfer.reviewedBy), String(root._id));
    await assert.rejects(
      () => payout.markReviewed(String(prepared.transfer._id), root),
      /review/i,
    );

    // 8. Execute once under the synthetic sealed-transport boundary: the
    //    transport's provider report is recorded as submitted identity but is
    //    NEVER a financial fact — the transfer reserves as uncertain.
    let calls = 0;
    t.mock.method(transport, "submit", async (payload) => {
      calls += 1;
      assert.equal(payload.kind, "payout_transfer");
      assert.equal(payload.amountMinor, 1100);
      assert.equal(payload.currency, "NGN");
      assert.equal(payload.destinationAccountReference, "payout-account-ref-1");
      assert.equal(payload.netReceivableMinor, 1600);
      assert.equal(payload.heldTotalMinor, 500);
      assert.equal(payload.nettingRule, "statement_net_receivable_only");
      assert.equal(String(payload.order), String(fixture.orderA));
      return { id: "ptr_synthetic_1", status: "pending" };
    });
    const executed = await payout.execute(String(prepared.transfer._id), root);
    assert.equal(calls, 1, "transport submits at most once per transfer");
    assert.equal(executed.transfer.state, "uncertain");
    assert.equal(executed.status, "uncertain");
    assert.equal(executed.transfer.submittedTransferId, "ptr_synthetic_1");
    assert.equal(
      (await Balance.findById(String(childA._id)).lean()).transferredMinor,
      1100,
      "the transferable statement base is consumed exactly once",
    );

    // 9. Conservation against the linked statement holds after execution: no
    //    further transfer command can over-transfer; the prepared anchor
    //    count never exceeds the conserved statement base.
    await assert.rejects(
      () => prepare(childA._id, 1, "p2"),
      /transferable receivable/,
    );
    assert.equal(await Transfer.countDocuments({ child: String(childA._id) }), 1);

    // 10. Concurrent duplicate preparation runs on real Promise.all: one
    //     anchor, one transferred statement consumption — exactly once.
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    const results = await Promise.allSettled([
      prepare(childB._id, 900, "race-a"),
      prepare(childB._id, 900, "race-a"),
    ]);
    assert.deepEqual(
      results.map((row) => row.status).sort(),
      ["fulfilled", "fulfilled"],
    );
    assert.deepEqual(
      results
        .map((row) => row.value.status)
        .sort(),
      ["already_prepared", "prepared"],
    );
    assert.equal(
      await Transfer.countDocuments({ child: String(childB._id) }),
      1,
    );

    // 11. Two different-key concurrent transfers cannot jointly consume more
    //    than thestatement base: the loser refuses exactly once at the
    //    server-side conservation guard and stays reviewed state.
    const second = await prepare(childB._id, 900, "race-b");
    assert.equal(second.status, "prepared");
    const secondTransfer = second.transfer;
    await payout.markReviewed(String(results[0].value.transfer._id), root);
    await payout.markReviewed(String(secondTransfer._id), root);
    t.mock.method(transport, "submit", async () => ({ id: "ptr_synthetic_2", status: "pending" }));
    const race = await Promise.allSettled([
      payout.execute(String(results[0].value.transfer._id), root),
      payout.execute(String(secondTransfer._id), root),
    ]);
    assert.deepEqual(
      race.map((row) => row.status).sort(),
      ["fulfilled", "rejected"],
    );
    const loser = race.find((row) => row.status === "rejected").reason;
    assert.equal(loser.statusCode, 409);
    assert.match(loser.message, /transferable receivable/);
    const winnerId = String(race.find((row) => row.status === "fulfilled").value.transfer._id);
    const loserId =
      winnerId === String(results[0].value.transfer._id)
        ? String(secondTransfer._id)
        : String(results[0].value.transfer._id);
    assert.equal(
      (await Balance.findById(String(childB._id)).lean()).transferredMinor,
      900,
      "the statement base is conserved exactly across the concurrent different-key race",
    );
    assert.equal(
      (await Transfer.findById(winnerId).lean()).state,
      "uncertain",
    );
    assert.equal(
      (await Transfer.findById(loserId).lean()).state,
      "reviewed",
      "the losing concurrent execute never became executing; it stays reviewed",
    );
    assert.equal(await Transfer.countDocuments({ child: String(childB._id) }), 2);
  },
);

test(
  "concurrent executes of the SAME payout transfer serialize on the executing claim: exactly one executes, the loser gets the explicit once-only conflict, and the transport submits at most once",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "payout_sameid");
    const fixture = await require("./helpers/payoutFixture").twoChildren();
    const { childA, root } = fixture;
    const Transfer = require("../models/MerchantPayoutTransfer");
    const Balance = require("../models/MerchantPayoutBalance");
    const policy = require("../services/merchantFulfillment/payout/policy");
    const payout = require("../services/merchantFulfillment/payout/transfer");
    const transport = require("../services/merchantFulfillment/payout/transport");
    await require("../models/MerchantPayoutPolicy").syncIndexes();
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    t.after(() => {
      delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
    });

    await policy.record(POLICY_V1, root);
    const prepared = await payout.prepare(
      {
        childId: String(childA._id),
        amountMinor: 1100,
        destinationAccountReference: "payout-account-ref-1",
        idempotencyKey: "sameid-1",
      },
      root,
    );
    assert.equal(prepared.status, "prepared");
    await payout.markReviewed(String(prepared.transfer._id), root);

    let calls = 0;
    t.mock.method(transport, "submit", async (payload) => {
      calls += 1;
      assert.equal(payload.kind, "payout_transfer");
      assert.equal(payload.amountMinor, 1100);
      return { id: "ptr_synthetic_sameid_1", status: "pending" };
    });
    const results = await Promise.allSettled([
      payout.execute(String(prepared.transfer._id), root),
      payout.execute(String(prepared.transfer._id), root),
    ]);
    assert.equal(
      calls,
      1,
      "the transport submits at most once — the losing execute never reaches submit",
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "exactly one execute wins");
    const winner = results.find((r) => r.status === "fulfilled").value;
    assert.equal(winner.status, "uncertain");
    assert.equal(winner.transfer.state, "uncertain");
    const losers = results.filter((r) => r.status === "rejected");
    assert.equal(losers.length, 1, "exactly one explicit once-only conflict");
    assert.equal(losers[0].reason.statusCode, 409);
    assert.notEqual(losers[0].reason.code, 11000, "no raw duplicate-key error may surface");
    assert.match(
      losers[0].reason.message,
      /execution is once-only/,
      "the loser carries the module's explicit once-only execution reason",
    );
    assert.equal(
      (await Balance.findById(String(childA._id)).lean()).transferredMinor,
      1100,
      "the executed balance advance happens exactly once",
    );
    assert.equal(await Balance.countDocuments(), 1);
    assert.equal(
      (await Transfer.findById(String(prepared.transfer._id)).lean()).state,
      "uncertain",
      "the transfer sits in exactly one terminal-claim state",
    );
  },
);
