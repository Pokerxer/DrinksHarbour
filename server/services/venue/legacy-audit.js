'use strict';
const { resolveEntitlements } = require('../entitlements.service');
const id = value => value == null ? null : String(value._id || value);
function duplicates(records, field, kind) {
  const groups = new Map();
  for (const record of records) {
    const key = id(record[field]);
    if (key) groups.set(key, [...(groups.get(key) || []), id(record)]);
  }
  return [...groups].filter(([, values]) => values.length > 1).map(([key, ids]) => ({ kind, key, ids }));
}
function buildVenueFoundationReport({ tenant, warehouses = [], tables = [], bookings = [], orders = [], posSessions = [], approvedMappings = [], now = new Date(), revision = 'unknown' }) {
  if (!tenant?._id) throw new Error('Tenant is required');
  const tenantId = id(tenant);
  const own = rows => rows.filter(row => id(row.tenant) === tenantId);
  warehouses = own(warehouses); tables = own(tables); bookings = own(bookings); orders = own(orders);
  const locations = new Set(warehouses.filter(w => w.isActive !== false).map(id));
  const locationFindings = [...bookings, ...tables].map(resource => {
    const explicit = id(resource.location);
    const mapping = approvedMappings.find(m => id(m.tenant) === tenantId && id(m.resourceId) === id(resource));
    const mapped = id(mapping?.locationId);
    const locationId = locations.has(explicit) ? explicit : locations.has(mapped) ? mapped : null;
    return { resourceId: id(resource), locationId, reason: locationId ? (locationId === explicit ? 'explicit' : 'approved_mapping') : 'needs_review' };
  });
  const duplicateKeys = [
    ...duplicates(orders, 'tableServiceBooking', 'booking_bill'),
    ...duplicates(orders, 'venueBillForSession', 'session_bill'),
    ...duplicates(tables, 'currentTabId', 'table_hold'),
  ];
  const visitCandidates = bookings.map(booking => {
    const bills = orders.filter(order => id(order.tableServiceBooking) === id(booking));
    const mapping = approvedMappings.find(m => id(m.tenant) === tenantId && id(m.bookingId) === id(booking));
    const hold = orders.find(o => id(o) === id(mapping?.heldOrderId) && o.status === 'hold');
    const location = locationFindings.find(f => f.resourceId === id(booking));
    return { bookingId: id(booking), heldOrderId: hold ? id(hold) : null, billIds: bills.map(id),
      classification: bills.length > 1 ? 'blocked_conflict' : hold && location?.locationId ? 'safe_explicit' : 'needs_review' };
  });
  const blockers = [];
  if (duplicateKeys.length) blockers.push('DUPLICATE_BILL');
  if (locationFindings.some(f => !f.locationId)) blockers.push('LOCATION_REVIEW_REQUIRED');
  const knownHolds = new Set(orders.filter(o => o.status === 'hold').map(id));
  for (const table of tables) if (table.currentTabId && !knownHolds.has(id(table.currentTabId))) blockers.push('DANGLING_TABLE_HOLD');
  const entitlements = resolveEntitlements(tenant, now);
  return {
    metadata: { tenantId, generatedAt: now.toISOString(), revision, readOnly: true },
    eligibilityDifferences: { plan: tenant.plan, subscriptionStatus: tenant.subscriptionStatus,
      oldPublic: tenant.status === 'approved' && tenant.subscriptionStatus === 'active' && tenant.plan === 'venue',
      modeEnabled: tenant.posSettings?.isBarRestaurant === true, tableManagement: entitlements.capabilities.includes('table_management') },
    locationFindings, visitCandidates, duplicateKeys,
    locationBindings: own(posSessions).map(s => ({ sessionId: id(s), locationId: id(s.warehouse) })),
    openObligations: orders.filter(o => o.status === 'hold' || ['pending', 'paid'].includes(o.paymentStatus)).map(o => ({
      orderId: id(o), status: o.status, paymentStatus: o.paymentStatus, accountingStatus: o.tableAccountingStatus || o.accountingStatus,
    })), blockers: [...new Set(blockers)],
  };
}
function formatVenueFoundationReport(report) {
  return `# Venue foundation audit\n\nRead-only; no mutations performed.\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
}
module.exports = { buildVenueFoundationReport, formatVenueFoundationReport };
