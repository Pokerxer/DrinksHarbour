// Preview by default; explicitly scope one approved tenant before saving policies.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
if (process.env.NODE_DNS_SERVERS?.trim())
  require('node:dns').promises.setServers(process.env.NODE_DNS_SERVERS.split(',').map(s => s.trim()));
async function main() {
  const args = process.argv.slice(2);
  const scopes = args.filter(arg => /^--tenant=[a-z0-9-]+$/.test(arg));
  if (scopes.length !== 1 || args.some(arg => arg !== '--apply' && !scopes.includes(arg)))
    throw Error('Use --tenant=slug, optionally with --apply');
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false, autoCreate: false, maxPoolSize: 1, serverSelectionTimeoutMS: 10000,
  });
  const tenant = await require('../models/Tenant').findOne({
    slug: scopes[0].slice(9), status: 'approved',
  }).select('_id slug').lean();
  if (!tenant) throw Error('Approved tenant not found');
  const now = new Date();
  const evidence = await require('../services/restock/reader').readEvidence(String(tenant._id), { now });
  const plan = require('../services/restock/plan').buildPlan(evidence, { now });
  const eligible = plan.lines.filter(l => l.stockRecordId && l.minimumPolicy.status === 'active');
  const apply = args.includes('--apply');
  if (apply) await require('../services/restock/minimum-storage').persistMinimums(String(tenant._id), plan);
  const stored = await require('../models/WarehouseStock').find({
    tenant: tenant._id, _id: { $in: eligible.map(l => l.stockRecordId) },
  }).select('currentQuantity minStockLevel +automaticMinimum').lean();
  const expected = new Map(eligible.map(l => [l.stockRecordId, l]));
  if (apply && (stored.length !== eligible.length || stored.some(row => {
    const line = expected.get(String(row._id));
    return row.automaticMinimum?.units !== line.threshold ||
      new Date(row.automaticMinimum?.calculatedAt).getTime() !== now.getTime();
  }))) throw Error('Saved minimum verification failed');
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', tenant: tenant.slug,
    eligible: eligible.length, early: eligible.filter(l => l.minimumPolicy.confidence === 'early').length,
    established: eligible.filter(l => l.minimumPolicy.confidence === 'established').length,
    learning: plan.lines.filter(l => l.minimumPolicy.status === 'learning').length,
    incomplete: plan.lines.filter(l => l.minimumPolicy.status === 'incomplete').length,
    savedVerified: apply ? stored.length : 0,
    examples: eligible.slice(0, 3).map(l => ({ product: l.productName,
      warehouse: l.warehouseName, minimum: l.threshold, confidence: l.minimumPolicy.confidence })) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
