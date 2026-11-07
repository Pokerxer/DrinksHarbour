'use strict';
const { id } = require('./eligibility');
const { sumMinor, requireMinor, quantityFrom } = require('./cost-math');
const { approvedCostAccountRoles } = require('./cost-account-roles');
function majorToMinor(value = 0) {
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * quantityFrom(Math.abs(value), 'g').amountScaled;
}
function journalNet(entry, codes, credit = false) {
  return sumMinor(
    (entry.lines || [])
      .filter((line) => codes.includes(String(line.account)))
      .map((line) =>
        credit
          ? sumMinor([majorToMinor(line.credit), -majorToMinor(line.debit)])
          : sumMinor([majorToMinor(line.debit), -majorToMinor(line.credit)]),
      ),
  );
}
async function loadSources({ tenantId, locationId, asOf }) {
  const bills = await require('../../models/Order')
    .find({
      tenant: tenantId,
      posWarehouse: locationId,
      venueIdentityVersion: 1,
      venueBillForSession: { $exists: true },
      createdAt: { $lte: asOf },
    })
    .lean();
  const billIds = bills.map((bill) => bill._id),
    scope = { tenant: tenantId, location: locationId };
  const [reversals, snapshots, receipts, events, chart, roles] =
    await Promise.all([
      require('../../models/VenuePaymentReversal')
        .find({ ...scope, billOrder: { $in: billIds } })
        .lean(),
      require('../../models/VenueCostSnapshot')
        .find({
          ...scope,
          recordedAt: { $lte: asOf },
          $or: [
            { billOrder: { $in: billIds } },
            { session: { $in: bills.map((bill) => bill.venueServiceSession) } },
          ],
        })
        .lean(),
      require('../../models/VenuePaymentReceipt')
        .find({
          ...scope,
          billOrder: { $in: billIds },
          verifiedAt: { $lte: asOf },
        })
        .lean(),
      require('../../models/VenueConsumptionEvent')
        .find({
          ...scope,
          session: { $in: bills.map((bill) => bill.venueServiceSession) },
        })
        .lean(),
      require('../../models/Account').find({ tenant: tenantId }).lean(),
      approvedCostAccountRoles({ tenantId, locationId }),
    ]);
  const journals = await require('../../models/JournalEntry')
    .find({
      tenant: tenantId,
      status: 'posted',
      date: { $lte: asOf },
      $or: [
        { refDoc: { $in: billIds }, refDocType: 'Order' },
        {
          refDoc: { $in: reversals.map((row) => row.caseId) },
          refDocType: 'VenueRefundCase',
        },
        {
          refDoc: { $in: events.map((row) => row._id) },
          refDocType: 'VenueConsumptionEvent',
        },
      ],
    })
    .lean();
  const movements = await require('../../models/InventoryMovement')
    .find({
      tenant: tenantId,
      warehouse: locationId,
      status: 'confirmed',
      _id: {
        $in: snapshots.flatMap((snapshot) =>
          (snapshot.sourceAllocations || []).map(
            (allocation) => allocation.movementId,
          ),
        ),
      },
    })
    .lean();
  return {
    bills,
    reversals,
    snapshots,
    receipts,
    events,
    chart,
    roles,
    journals,
    movements,
  };
}
function physicalCostForBill(bill, sources) {
  const recognition = bill.venueCostRecognition;
  const incomplete = (reason) => ({
    verified: false,
    missingReasons: [reason],
    snapshots: [],
    journalIds: [],
  });
  if (
    bill.venueBillSnapshot?.costMode !== 'actual' ||
    recognition?.status !== 'verified' ||
    !recognition.costSnapshotIds?.length ||
    !Array.isArray(recognition.journalIds)
  )
    return incomplete('cost_recognition_missing');
  const policy = sources.roles.policies.find(
    (row) => row.version === recognition.policyVersion,
  );
  if (!policy) return incomplete('approved_cost_role_missing');
  const snapshotIds = recognition.costSnapshotIds.map(id);
  if (new Set(snapshotIds).size !== snapshotIds.length)
    return incomplete('duplicate_cost_evidence');
  const snapshots = sources.snapshots.filter((snapshot) =>
    snapshotIds.includes(id(snapshot)),
  );
  if (
    snapshots.length !== snapshotIds.length ||
    snapshots.some(
      (snapshot) =>
        snapshot.status !== 'verified' ||
        snapshot.amountMinor == null ||
        snapshot.currency !== 'NGN' ||
        snapshot.policyVersion !== policy.version ||
        snapshot.missingReasons?.length ||
        id(snapshot.session) !== id(bill.venueServiceSession) ||
        (snapshot.billOrder && id(snapshot.billOrder) !== id(bill)),
    )
  )
    return incomplete('cost_snapshot_incomplete');
  if (
    snapshots.some(
      (snapshot) =>
        !bill.venueBillSnapshot.acceptedLines.some(
          (line) =>
            line.lineId === snapshot.lineId &&
            line.revision === snapshot.revision,
        ),
    )
  )
    return incomplete('cost_snapshot_line_mismatch');
  const journals = sources.journals.filter(
    (entry) =>
      recognition.journalIds.map(id).includes(id(entry)) &&
      id(entry.refDoc) === id(bill) &&
      entry.entryType === 'cogs' &&
      entry.source === 'venue_actual_cost',
  );
  const totalCost = sumMinor(
    snapshots.map((snapshot) =>
      requireMinor(snapshot.amountMinor, { signed: true }),
    ),
  );
  if (
    journals.length !== recognition.journalIds.length ||
    journals.some((entry) => !entry.venueCostSnapshotIds?.length) ||
    (totalCost !== 0 &&
      snapshotIds.some(
        (snapshotId) =>
          !journals.some((entry) =>
            entry.venueCostSnapshotIds.map(id).includes(snapshotId),
          ),
      )) ||
    journals.some((entry) =>
      entry.venueCostSnapshotIds.some(
        (snapshotId) => !snapshotIds.includes(id(snapshotId)),
      ),
    )
  )
    return incomplete('cost_journal_link_missing');
  if (
    journalNet({ lines: journals.flatMap((entry) => entry.lines) }, [
      policy.accounts.cogs,
    ]) !== totalCost
  )
    return incomplete('cost_journal_amount_mismatch');
  for (const snapshot of snapshots) {
    const allocations = snapshot.sourceAllocations || [];
    if (
      !allocations.length ||
      allocations.some(
        (allocation) =>
          allocation.allocatedCostMinor == null ||
          !allocation.lotId ||
          !allocation.receiptId ||
          !allocation.sourceTimestamp ||
          !sources.movements.some(
            (movement) => id(movement) === id(allocation.movementId),
          ),
      ) ||
      sumMinor(
        allocations.map((allocation) => allocation.allocatedCostMinor),
      ) !== snapshot.amountMinor
    )
      return incomplete('physical_valuation_incomplete');
    const event = sources.events.find(
      (row) =>
        id(row) === id(snapshot.sourceEvent) &&
        id(row.costSnapshotId) === id(snapshot) &&
        row.physicalCoverage === 'complete' &&
        row.lineId === snapshot.lineId &&
        row.revision === snapshot.revision,
    );
    if (
      !event ||
      snapshot.quantity?.unit !== 'count' ||
      snapshot.quantity.scale !== 1 ||
      snapshot.quantity.amountScaled !== event.fireDelta ||
      allocations.some(
        (allocation) =>
          !event.movementIds?.map(id).includes(id(allocation.movementId)),
      )
    )
      return incomplete('physical_consumption_incomplete');
    const pending = sources.journals.filter(
      (entry) =>
        id(entry.refDoc) === id(event) &&
        entry.refDocType === 'VenueConsumptionEvent' &&
        entry.entryType === 'inventory_adjust' &&
        entry.source === 'venue_physical_cost' &&
        entry.venueCostSnapshotIds?.map(id).includes(id(snapshot)),
    );
    if (
      snapshot.amountMinor !== 0 &&
      (pending.length !== 1 ||
        journalNet(pending[0], [policy.accounts.issuedService]) !==
          snapshot.amountMinor)
    )
      return incomplete('issued_cost_journal_missing');
  }
  for (const line of bill.venueBillSnapshot.acceptedLines || []) {
    const owned = snapshots.filter(
      (snapshot) =>
        snapshot.lineId === line.lineId && snapshot.revision === line.revision,
    );
    if (
      sumMinor(owned.map((snapshot) => snapshot.quantity.amountScaled)) !==
      line.quantity
    )
      return incomplete('physical_quantity_incomplete');
  }
  return {
    verified: true,
    snapshots,
    journalIds: journals.map(id),
    missingReasons: [],
  };
}
module.exports = { majorToMinor, journalNet, loadSources, physicalCostForBill };
