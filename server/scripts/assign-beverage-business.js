#!/usr/bin/env node
'use strict';
// Preview by default; --apply requires a new Markdown --report path.
// Only industry changes. Conditional updates prevent overwriting concurrent edits.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { planBeverageAssignment } = require('../utils/beverageTaxonomyAssignment');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const reportIndex = args.indexOf('--report');
  const report = reportIndex >= 0 ? args[reportIndex + 1] : null;
  if (apply && !report) throw new Error('--apply requires --report PATH');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (process.env.NODE_DNS_SERVERS) require('node:dns').setServers(process.env.NODE_DNS_SERVERS.split(','));
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const read = async () => {
    const projection = { _id: 1, name: 1, slug: 1, industry: 1, parent: 1 };
    return Promise.all(['categories', 'subcategories'].map(name => db.collection(name).find({}, { projection }).toArray()));
  };
  const [categories, subcategories] = await read();
  const plan = planBeverageAssignment(categories, subcategories);
  const summary = { mode: apply ? 'apply' : 'preview', categories: plan.categories.length, subcategories: plan.subcategories.length, totals: plan.totals };
  console.log(JSON.stringify(summary));
  if (report) {
    const lines = ['# Beverages business assignment', '', `Date: ${new Date().toISOString()}`, '',
      'Only industry changes to beverage. IDs, parent links, status and product references stay unchanged.',
      'Rollback: for each recorded ID still assigned beverage, restore its previous industry; absent means unset. Review concurrent edits before rollback.', '',
      '| Collection | ID | Slug | Previous industry |', '| --- | --- | --- | --- |'];
    for (const collection of ['categories', 'subcategories']) for (const row of plan[collection]) {
      const previous = Object.hasOwn(row, 'industry') ? JSON.stringify(row.industry) : 'absent';
      lines.push(`| ${collection} | ${row._id} | ${row.slug || ''} | ${previous} |`);
    }
    fs.writeFileSync(report, lines.join('\n') + '\n', { flag: 'wx' });
  }
  if (!apply) return;
  for (const collection of ['categories', 'subcategories']) {
    const rows = plan[collection];
    if (!rows.length) continue;
    const result = await db.collection(collection).bulkWrite(rows.map(row => ({ updateOne: {
      filter: { _id: row._id, ...(Object.hasOwn(row, 'industry') ? { industry: row.industry } : { industry: { $exists: false } }) },
      update: { $set: { industry: 'beverage' } },
    } })), { ordered: true });
    if (result.matchedCount !== rows.length) throw new Error(`Concurrent change in ${collection}; inspect report before rerun`);
    console.log(`${collection}: ${result.modifiedCount} assigned`);
  }
  const after = await read();
  const remaining = planBeverageAssignment(...after);
  if (remaining.categories.length || remaining.subcategories.length) throw new Error('Assignment verification failed');
  console.log('Verified: repeat preview has zero changes');
  fs.appendFileSync(report, '\nApplied and verified: zero changes on repeat preview.\n');
}
main().catch(error => { console.error(error.name, String(error.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; }).finally(() => mongoose.disconnect());
