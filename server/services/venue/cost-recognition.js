'use strict';
const { fail } = require('./errors');
const { id } = require('./eligibility');
const math = require('./cost-math');
const Events = require('../../models/VenueConsumptionEvent');
const Costs = require('../../models/VenueCostSnapshot');
const Journal = require('../../models/JournalEntry');
async function physicalBillCosts({ tenantId, billOrder, mongoSession }) {
  const lines = billOrder.venueBillSnapshot.acceptedLines;
  const locationId = id(
    billOrder.posWarehouse || billOrder.venueBillSnapshot.locationId,
  );
  const { policy } = await require('./costing-policy').requireCostingPolicy({
    tenantId,
    locationId,
    mongoSession,
    forRecognition: true,
  });
  const events = await Events.find({
    tenant: tenantId,
    location: locationId,
    session: billOrder.venueServiceSession,
  })
    .session(mongoSession)
    .lean();
  const snapshots = [];
  let amountMinor = 0;
  for (const line of lines) {
    const matches = events.filter(
      (event) =>
        event.lineId === line.lineId && event.revision === line.revision,
    );
    if (
      matches.some((event) => event.physicalCoverage !== 'complete') ||
      matches.reduce((sum, event) => sum + (event.fireDelta || 0), 0) !==
        line.quantity
    )
      fail(
        'COST_REVIEW_REQUIRED',
        'Physical coverage does not match accepted quantity',
      );
    for (const event of matches) {
      const snapshot = await Costs.findOne({
        _id: event.costSnapshotId,
        tenant: tenantId,
        location: locationId,
        sourceEvent: event._id,
        status: 'verified',
      })
        .session(mongoSession)
        .lean();
      if (
        !snapshot ||
        snapshot.amountMinor == null ||
        snapshot.policyVersion !== policy.version
      )
        fail('COST_REVIEW_REQUIRED', 'Matched original cost evidence required');
      const pending = await Journal.findOne({
        tenant: tenantId,
        refDoc: event._id,
        refDocType: 'VenueConsumptionEvent',
        entryType: 'inventory_adjust',
        status: 'posted',
        venueCostSnapshotIds: snapshot._id,
      })
        .session(mongoSession)
        .lean();
      if (!pending && snapshot.amountMinor !== 0)
        fail('COST_REVIEW_REQUIRED', 'Issued-service cost journal is missing');
      const posted = pending
        ? Math.round(
            pending.lines
              .filter((line) => line.account === policy.accounts.issuedService)
              .reduce((sum, line) => sum + line.debit - line.credit, 0) * 100,
          )
        : 0;
      if (posted !== snapshot.amountMinor)
        fail(
          'COST_REVIEW_REQUIRED',
          'Original issued-service journal differs from evidence',
        );
      snapshots.push(snapshot);
      amountMinor = math.sumMinor([amountMinor, snapshot.amountMinor]);
    }
  }
  return { policy, snapshots, amountMinor };
}
async function recognizeBillCosts({ tenantId, billOrder, mongoSession }) {
  if (!mongoSession?.inTransaction()) fail('COST_TRANSACTION_REQUIRED');
  if (billOrder.venueBillSnapshot?.costMode !== 'actual')
    return { journalIds: [], costSnapshotIds: [], status: 'legacy_estimated' };
  const { policy, snapshots, amountMinor } = await physicalBillCosts({
    tenantId,
    billOrder,
    mongoSession,
  });
  const ids = snapshots.map((row) => row._id);
  const journals = [];
  if (amountMinor) {
    const journal = await require('../journalEntry.service').postJournalEntry({
      tenantId,
      refDoc: billOrder._id,
      refDocType: 'Order',
      entryType: 'cogs',
      source: 'venue_actual_cost',
      lines: [
        { account: policy.accounts.cogs, debit: amountMinor / 100, credit: 0 },
        {
          account: policy.accounts.issuedService,
          debit: 0,
          credit: amountMinor / 100,
        },
      ],
      venueCostSnapshotIds: ids,
      date: new Date(),
      session: mongoSession,
    });
    if (
      journal.source !== 'venue_actual_cost' ||
      journal.venueCostSnapshotIds.length !== ids.length ||
      ids.some(
        (value) =>
          !journal.venueCostSnapshotIds.some(
            (saved) => id(saved) === id(value),
          ),
      )
    )
      fail(
        'COST_REVIEW_REQUIRED',
        'Existing cost journal has different evidence',
      );
    journals.push(journal._id);
  }
  const result = {
    status: 'verified',
    costSnapshotIds: ids,
    journalIds: journals,
    policyVersion: policy.version,
  };
  await require('../../models/Order').updateOne(
    { _id: billOrder._id, tenant: tenantId },
    { $set: { venueCostRecognition: result } },
    { session: mongoSession },
  );
  billOrder.venueCostRecognition = result;
  return result;
}
async function postIssuedCosts({
  tenantId,
  locationId,
  eventId,
  cost,
  mongoSession,
  policy,
  inventoryRole = 'rawInventory',
}) {
  if (!cost.amountMinor) return; // Evidenced zero remains linked on immutable snapshot.
  return require('../journalEntry.service').postJournalEntry({
    tenantId,
    refDoc: eventId,
    refDocType: 'VenueConsumptionEvent',
    entryType: 'inventory_adjust',
    source: 'venue_physical_cost',
    lines: [
      {
        account: policy.accounts.issuedService,
        debit: cost.amountMinor / 100,
        credit: 0,
      },
      {
        account: policy.accounts[inventoryRole],
        debit: 0,
        credit: cost.amountMinor / 100,
      },
    ],
    venueCostSnapshotIds: [cost._id],
    session: mongoSession,
  });
}
module.exports = { physicalBillCosts, recognizeBillCosts, postIssuedCosts };
