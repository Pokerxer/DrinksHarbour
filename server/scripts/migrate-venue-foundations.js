#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises'); const mongoose = require('mongoose');
async function main() {
  const options = process.argv.slice(2); const input = options.find(o => o.startsWith('--input='))?.slice(8);
  if (!input || options.some(o => o !== '--apply' && !/^--(?:input|expected-fingerprint)=/.test(o))) throw new Error('Explicit --input=<mapping.md> required');
  const service = require('../services/venue/migration'); const mapping = service.parseVenueMapping(await fs.readFile(input, 'utf8'));
  const actor = { userId: mapping.reviewedBy };
  require('dotenv').config({ quiet: true });
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  try {
    const user = await require('../models/User').findById(actor.userId).select('role').lean(); actor.role = user?.role;
    const args = { tenantId: mapping.tenantId, mapping, actor };
    const result = options.includes('--apply') ? await service.applyVenueMapping({ ...args, expectedFingerprint: options.find(o => o.startsWith('--expected-fingerprint='))?.slice(23) }) : await service.previewVenueMapping(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(error => { process.stderr.write(`Venue mapping refused: ${error.code || 'MAPPING_FAILED'}\n`); process.exitCode = 1; });
module.exports = { main };
