#!/usr/bin/env node
'use strict';
// Explicit database selection. No application .env fallback and no destructive syncIndexes.
const mongoose = require('mongoose');
const { planAuditIndexes } = require('../services/venue/audit-indexes');
async function main() {
  if (!process.env.VENUE_INDEX_MONGO_URI) throw new Error('Set VENUE_INDEX_MONGO_URI to the explicitly reviewed database');
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--retention-and-backup-reviewed')) throw new Error('Apply requires --retention-and-backup-reviewed');
  await mongoose.connect(process.env.VENUE_INDEX_MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const collection = db.collection('auditlogs');
  const indexes = await collection.listIndexes().toArray();
  const plan = planAuditIndexes(indexes);
  const expired = await collection.countDocuments({ timestamp: { $lt: new Date(Date.now() - 220752000000) } });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', indexes, expiredRecordsAtRisk: expired, ...plan }, null, 2));
  if (plan.status === 'blocked') throw new Error('Index preparation blocked; no changes made');
  if (apply) {
    for (const action of plan.actions) {
      if (action.type === 'collMod') await db.command({ collMod: 'auditlogs', index: { name: action.index, expireAfterSeconds: action.expireAfterSeconds } });
      else await collection.createIndex({ timestamp: 1 }, { name: action.index, expireAfterSeconds: action.expireAfterSeconds });
    }
    const after = planAuditIndexes(await collection.listIndexes().toArray());
    if (after.status !== 'ready') throw new Error('Index verification failed; retain backup and investigate');
    console.log(JSON.stringify({ status: 'ready' }));
  }
}
if (require.main === module) main().catch(() => { console.error('Audit index preparation failed; inspect access, index compatibility and reviewed configuration. URI withheld.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = { main };
