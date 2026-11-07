'use strict';
const { id } = require('./eligibility');
const { fail } = require('./errors');
const { businessDate } = require('./clock');
const { marginAmounts } = require('./profitability-math');
const { sumMinor, requireMinor } = require('./cost-math');
const {
  physicalCostForBill,
  journalNet,
  majorToMinor,
} = require('./profitability-sources');
function baseRow({ args, bill, line, date, sourceId, asOf, services }) {
  return {
    tenantId: args.tenantId,
    locationId: args.locationId,
    businessDate: businessDate(
      date,
      services.timezone,
      services.businessDayStartMinutes ?? 240,
    ),
    currency: 'NGN',
    basis: args.basis,
    productId: id(line?.product) || null,
    subProductId: id(line?.subproduct) || null,
    sizeId: id(line?.size) || null,
    servingSnapshot: line?.servingSnapshot || null,
    lineId: line?.lineId || null,
    revision: line?.revision || null,
    recipeVersionId: id(line?.recipeVersionId) || null,
    packageGroupId: line?.packageGroupId || null,
    quantitySold: line?.quantity || 0,
    sourceId,
    billOrderId: id(bill),
    asOf: asOf.toISOString(),
    reconciliationStatus: 'not_reconciled',
  };
}
function feesForLine(bill, line, sources) {
  const item = (bill.items || []).find(
    (row) =>
      row.venueLineId === line.lineId &&
      row.venueLineRevision === line.revision,
  );
  const commissionMinor =
    bill.venueBillSnapshot.rateBps === 0
      ? 0
      : item && item.platformCommission != null
        ? majorToMinor(item.platformCommission)
        : null;
  const receipts = sources.receipts.filter(
    (receipt) => id(receipt.billOrder) === id(bill),
  );
  const providerFeeMinor =
    receipts.length &&
    receipts.every(
      (receipt) =>
        receipt.provider === 'cash' &&
        ['verified', 'applied'].includes(receipt.state),
    )
      ? 0
      : null;
  return { commissionMinor, providerFeeMinor };
}
function lineRows(args, bill, source, sources, configuration) {
  const { asOf, services } = configuration,
    snapshot = bill.venueBillSnapshot;
  const lines = snapshot.acceptedLines || [];
  if (bill.currency !== 'NGN')
    fail(
      'INVALID_CURRENCY',
      'Foreign venue financial currency requires review',
      409,
    );
  const proof =
    args.basis === 'recorded' ? physicalCostForBill(bill, sources) : null;
  const net = sumMinor(lines.map((line) => requireMinor(line.netMinor)));
  if (args.basis === 'recorded' && journalNet(source, ['4000'], true) !== net)
    fail(
      'REPORT_SOURCE_REVIEW_REQUIRED',
      'Posted merchandise and accepted line revenue disagree',
      409,
    );
  return lines.map((line) => {
    const matched =
      proof?.snapshots.filter(
        (cost) =>
          cost.lineId === line.lineId && cost.revision === line.revision,
      ) || [];
    const recordedCogsMinor = proof?.verified
      ? sumMinor(matched.map((cost) => cost.amountMinor))
      : null;
    const estimatedCostMinor =
      line.costMinor == null
        ? null
        : sumMinor(
            Array.from({ length: line.quantity }, () =>
              requireMinor(line.costMinor),
            ),
          );
    const costMinor =
      args.basis === 'recorded' ? recordedCogsMinor : estimatedCostMinor;
    const fees = feesForLine(bill, line, sources),
      amounts = marginAmounts({
        netMerchandiseMinor: line.netMinor,
        costMinor,
        ...fees,
      });
    return {
      ...baseRow({
        args,
        bill,
        line,
        date: source.date,
        sourceId: `${id(source)}:${line.lineId}:${line.revision}`,
        asOf,
        services,
      }),
      netMerchandiseMinor: line.netMinor,
      taxMinor: line.taxMinor || 0,
      refundsMinor: 0,
      recordedCogsMinor,
      estimatedCostMinor,
      costMinor,
      ...fees,
      ...amounts,
      costStatus:
        args.basis === 'estimated'
          ? estimatedCostMinor == null
            ? 'unknown'
            : 'estimated'
          : proof.verified
            ? 'verified'
            : 'review_required',
      missingReasons: [
        ...new Set([
          ...amounts.missingReasons,
          ...(proof?.missingReasons || []),
        ]),
      ],
      costSnapshotIds: matched.map(id),
      journalIds:
        args.basis === 'recorded'
          ? [id(source), ...(proof.journalIds || [])]
          : [],
      feeStatus:
        fees.providerFeeMinor === null || fees.commissionMinor === null
          ? 'pending'
          : 'verified',
    };
  });
}
function refundRow(args, entry, reversal, bill, configuration) {
  const { asOf, services } = configuration;
  const netMerchandiseMinor = journalNet(entry, ['4000'], true);
  const merchandise = sumMinor([
    reversal.appliedMinor || 0,
    -(reversal.taxMinor || 0),
    -(reversal.financialMinor || 0),
  ]);
  if (netMerchandiseMinor !== -merchandise)
    fail(
      'REPORT_SOURCE_REVIEW_REQUIRED',
      'Refund journal and original money allocation disagree',
      409,
    );
  const commissionMinor =
    reversal.commissionMinor == null
      ? null
      : -requireMinor(reversal.commissionMinor);
  return {
    ...baseRow({
      args,
      bill,
      line: null,
      date: entry.date,
      sourceId: `${id(entry)}:refund`,
      asOf,
      services,
    }),
    netMerchandiseMinor,
    taxMinor: -(reversal.taxMinor || 0),
    refundsMinor: merchandise,
    recordedCogsMinor: 0,
    estimatedCostMinor: null,
    costMinor: 0,
    commissionMinor,
    providerFeeMinor: null,
    ...marginAmounts({ netMerchandiseMinor, costMinor: 0, commissionMinor }),
    costStatus: 'verified',
    feeStatus: 'pending',
    costSnapshotIds: [],
    journalIds: [id(entry)],
    missingReasons: [
      'refund_line_allocation_unavailable',
      'unknown_provider_fee',
      'nonpositive_revenue_denominator',
      'nonpositive_cost_denominator',
    ],
  };
}

module.exports = { lineRows, refundRow };
