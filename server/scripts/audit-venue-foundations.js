#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const { buildVenueFoundationReport, formatVenueFoundationReport } = require('../services/venue/legacy-audit');
async function main() {
  const args = process.argv.slice(2);
  const tenantId = args.find(a => a.startsWith('--tenant='))?.slice(9);
  const output = args.find(a => a.startsWith('--output='))?.slice(9);
  if (!/^[a-f\d]{24}$/i.test(tenantId || '') || !output || args.some(a => !/^--(?:tenant|output)=/.test(a))) {
    throw new Error('Usage: audit-venue-foundations --tenant=<24-hex-id> --output=<path>');
  }
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  try {
    const tenant = await require('../models/Tenant').findOne({ _id: tenantId }).select('plan subscriptionStatus status businessType posSettings.isBarRestaurant customCapabilities trialEndsAt').lean();
    if (!tenant) throw new Error('Tenant not found');
    const [warehouses, tables, bookings, orders, posSessions] = await Promise.all([
      require('../models/Warehouse').find({ tenant: tenantId }).select('tenant isActive').lean(),
      require('../models/POSTable').find({ tenant: tenantId }).select('tenant location currentTabId status').lean(),
      require('../models/Booking').find({ tenant: tenantId }).select('tenant location status source serviceSession').lean(),
      require('../models/Order').find({ tenant: tenantId }).select('tenant status paymentStatus accountingStatus tableAccountingStatus tableServiceBooking venueBillForSession').lean(),
      require('../models/POSSession').find({ tenant: tenantId }).select('tenant warehouse').lean(),
    ]);
    await fs.writeFile(output, formatVenueFoundationReport(buildVenueFoundationReport({ tenant, warehouses, tables, bookings, orders, posSessions })), { flag: 'wx', mode: 0o600 });
    process.stdout.write('Read-only venue audit saved.\n');
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(() => { process.stderr.write('Venue audit failed; check tenant, destination and database configuration. No apply mode exists.\n'); process.exitCode = 1; });
module.exports = { main };
