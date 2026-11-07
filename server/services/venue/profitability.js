'use strict';
const crypto = require('node:crypto');
const { lineRows, refundRow } = require('./profitability-rows');
const { loadVenueContext } = require('./context');
const { id } = require('./eligibility');
const { fail } = require('./errors');
const { businessDate } = require('./clock');
const { aggregateMarginRows } = require('./profitability-math');
const { loadSources } = require('./profitability-sources');
const DAY = 86400000;
function dateValue(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(new Date(value).getTime()) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail('INVALID_INPUT', 'Use a valid local business date', 400);
  return new Date(value).getTime();
}
function reportWindow(args) {
  const from = dateValue(args.fromDate),
    to = dateValue(args.toDate);
  if (
    to < from ||
    (to - from) / DAY >= 366 ||
    !['estimated', 'recorded'].includes(args.basis)
  )
    fail('INVALID_INPUT', 'Choose a basis and at most 366 business dates', 400);
  if (args.currency !== undefined && args.currency !== 'NGN')
    fail('INVALID_CURRENCY', 'Initial venue reports support NGN', 400);
  const limit = args.limit === undefined ? 50 : args.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    fail('INVALID_INPUT', 'Report limit must be 1 to 100', 400);
  const filterHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        args.tenantId,
        args.locationId,
        args.fromDate,
        args.toDate,
        args.basis,
        'NGN',
      ]),
    )
    .digest('hex');
  let cursor = null;
  if (args.cursor !== undefined) {
    try {
      cursor = JSON.parse(Buffer.from(args.cursor, 'base64url').toString());
    } catch {
      fail('INVALID_INPUT', 'Invalid report cursor', 400);
    }
    if (
      !cursor ||
      cursor.filterHash !== filterHash ||
      typeof cursor.sourceId !== 'string' ||
      typeof cursor.businessDate !== 'string' ||
      !Number.isFinite(new Date(cursor.asOf).getTime()) ||
      new Date(cursor.asOf) > new Date()
    )
      fail('INVALID_INPUT', 'Report cursor does not match this scope', 400);
  }
  return {
    limit,
    filterHash,
    cursor,
    asOf: cursor ? new Date(cursor.asOf) : new Date(),
  };
}
async function getMarginReport(args) {
  const context = await loadVenueContext({
    ...args,
    action: 'profitability.read',
  });
  const window = reportWindow(args),
    services = context.location.venueServices;
  const sources = await loadSources({
    tenantId: args.tenantId,
    locationId: args.locationId,
    asOf: window.asOf,
  });
  let rows = [];
  const inRange = (date) => {
    const value = businessDate(
      new Date(date),
      services.timezone,
      services.businessDayStartMinutes ?? 240,
    );
    return value >= args.fromDate && value <= args.toDate;
  };
  if (args.basis === 'estimated') {
    for (const bill of sources.bills.filter((bill) =>
      inRange(bill.venueBillSnapshot.createdAt || bill.createdAt),
    ))
      rows.push(
        ...lineRows(
          args,
          bill,
          {
            _id: bill._id,
            date: bill.venueBillSnapshot.createdAt || bill.createdAt,
          },
          sources,
          { ...window, services },
        ),
      );
  } else {
    for (const entry of sources.journals) {
      if (!inRange(entry.date)) continue;
      if (entry.refDocType === 'Order' && entry.entryType === 'sales_revenue') {
        const bill = sources.bills.find((row) => id(row) === id(entry.refDoc));
        if (bill)
          rows.push(
            ...lineRows(args, bill, entry, sources, { ...window, services }),
          );
      } else if (
        entry.refDocType === 'VenueRefundCase' &&
        entry.entryType === 'refund'
      ) {
        const reversal = sources.reversals.find(
          (row) => id(row.caseId) === id(entry.refDoc),
        );
        const bill =
          reversal &&
          sources.bills.find((row) => id(row) === id(reversal.billOrder));
        if (bill)
          rows.push(
            refundRow(args, entry, reversal, bill, { ...window, services }),
          );
      }
    }
  }
  rows = rows
    .filter(
      (row) =>
        row.businessDate >= args.fromDate && row.businessDate <= args.toDate,
    )
    .sort(
      (a, b) =>
        a.businessDate.localeCompare(b.businessDate) ||
        a.sourceId.localeCompare(b.sourceId),
    );
  const totals = aggregateMarginRows(rows);
  totals[
    args.basis === 'recorded' ? 'recordedCogsMinor' : 'estimatedCostMinor'
  ] = totals.costMinor;
  const after = window.cursor
    ? rows.filter(
        (row) =>
          row.businessDate > window.cursor.businessDate ||
          (row.businessDate === window.cursor.businessDate &&
            row.sourceId > window.cursor.sourceId),
      )
    : rows;
  const page = after.slice(0, window.limit),
    last = page[page.length - 1];
  const nextCursor =
    after.length > window.limit
      ? Buffer.from(
          JSON.stringify({
            filterHash: window.filterHash,
            businessDate: last.businessDate,
            sourceId: last.sourceId,
            asOf: window.asOf.toISOString(),
          }),
        ).toString('base64url')
      : null;
  return {
    rows: page,
    nextCursor,
    totals,
    coverage: totals.coverage,
    asOf: window.asOf.toISOString(),
    currency: 'NGN',
    basis: args.basis,
    dateScope: {
      fromDate: args.fromDate,
      toDate: args.toDate,
      timezone: services.timezone,
      businessDayStartMinutes: services.businessDayStartMinutes ?? 240,
    },
    ledgerResult: null,
    ledgerStatus: 'use_existing_tenant_posted_ledger_report',
    reconciliationStatus: 'not_reconciled',
  };
}
module.exports = { getMarginReport };
