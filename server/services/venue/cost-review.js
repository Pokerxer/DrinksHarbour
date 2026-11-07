'use strict';
const Work = require('../../models/VenueWorkItem');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
async function listCostCases(args) {
  await loadVenueContext({ ...args, action: 'costs.review' });
  const limit = args.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    fail('INVALID_INPUT', 'Limit must be 1–100', 400);
  if (args.cursor) requireId(args.cursor);
  const rows = await Work.find({
    tenant: args.tenantId,
    location: args.locationId,
    kind: 'cost_resolution',
    ...(args.cursor ? { _id: { $gt: args.cursor } } : {}),
  })
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();
  return {
    rows: rows.slice(0, limit).map((row) => ({
      id: id(row),
      version: row.reviewVersion || 0,
      state: row.state,
      billOrderId: id(row.targetId),
      reason: row.lastErrorCode || 'cost_evidence_required',
    })),
    nextCursor: rows.length > limit ? id(rows[limit - 1]) : null,
  };
}
function evidenceOf(raw) {
  const keys = ['costSnapshotIds', 'movementIds', 'journalIds'];
  if (
    !raw ||
    Object.keys(raw).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Array.isArray(raw[key]))
  )
    fail('INVALID_INPUT', 'Provide original source references only', 400);
  for (const key of keys) {
    if (raw[key].length > 1000 || new Set(raw[key]).size !== raw[key].length)
      fail('INVALID_INPUT', 'Distinct source references required', 400);
    raw[key].forEach(requireId);
  }
  return raw;
}
async function resolveCostCase(args) {
  const evidence = evidenceOf(args.evidence);
  requireId(args.caseId);
  if (
    !Number.isSafeInteger(args.expectedVersion) ||
    args.expectedVersion < 0 ||
    typeof args.reason !== 'string' ||
    args.reason.trim().length < 5 ||
    args.reason.length > 1000
  )
    fail('INVALID_INPUT', 'Case version and review reason required', 400);
  const context = await loadVenueContext({ ...args, action: 'costs.review' });
  return runVenueOperation({
    ...args,
    actor: context.actor,
    operation: 'cost.review',
    key: args.idempotencyKey,
    payload: {
      caseId: args.caseId,
      expectedVersion: args.expectedVersion,
      evidence,
      reason: args.reason,
    },
    targetType: 'VenueWorkItem',
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({
        ...args,
        action: 'costs.review',
        mongoSession,
      });
      const row = await Work.findOne({
        _id: args.caseId,
        tenant: args.tenantId,
        location: args.locationId,
        kind: 'cost_resolution',
      }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Cost case not found', 404);
      if (
        (row.reviewVersion || 0) !== args.expectedVersion ||
        row.state === 'done'
      )
        fail('STATE_CHANGED');
      const bill = await require('../../models/Order')
        .findOne({
          _id: row.targetId,
          tenant: args.tenantId,
          posWarehouse: args.locationId,
          venueSettlementState: 'settled',
        })
        .session(mongoSession);
      if (!bill || bill.venueCostRecognition?.status !== 'verified')
        fail(
          'COST_REVIEW_REQUIRED',
          'Canonical cost recognition must complete using original sources',
        );
      const proof = await require('./cost-recognition').physicalBillCosts({
        tenantId: args.tenantId,
        billOrder: bill,
        mongoSession,
      });
      const expectedSnapshots = proof.snapshots.map(id).sort();
      const expectedMovements = [
        ...new Set(
          proof.snapshots.flatMap((snapshot) =>
            snapshot.sourceAllocations.map((allocation) =>
              id(allocation.movementId),
            ),
          ),
        ),
      ].sort();
      const expectedJournals = (bill.venueCostRecognition.journalIds || [])
        .map(id)
        .sort();
      if (
        JSON.stringify([...evidence.costSnapshotIds].sort()) !==
          JSON.stringify(expectedSnapshots) ||
        JSON.stringify([...evidence.movementIds].sort()) !==
          JSON.stringify(expectedMovements) ||
        JSON.stringify([...evidence.journalIds].sort()) !==
          JSON.stringify(expectedJournals)
      )
        fail(
          'COST_REVIEW_REQUIRED',
          'Evidence does not match original canonical recognition',
        );
      for (const journalId of expectedJournals)
        if (
          !(await require('../../models/JournalEntry')
            .exists({
              _id: journalId,
              tenant: args.tenantId,
              refDoc: bill._id,
              status: 'posted',
              entryType: 'cogs',
              source: 'venue_actual_cost',
            })
            .session(mongoSession))
        )
          fail('COST_REVIEW_REQUIRED', 'Original posted cost journal missing');
      row.state = 'done';
      row.reviewVersion = (row.reviewVersion || 0) + 1;
      row.costEvidence = {
        ...evidence,
        reason: args.reason,
        reviewedBy: fresh.actor.userId,
        reviewedAt: new Date(),
      };
      await row.save({ session: mongoSession });
      return {
        id: id(row),
        version: row.reviewVersion,
        state: row.state,
        adjustmentId: null,
      };
    },
  });
}
module.exports = { listCostCases, resolveCostCase };
