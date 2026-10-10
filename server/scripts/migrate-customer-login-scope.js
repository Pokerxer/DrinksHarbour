'use strict';
// Default is read-only. --apply changes only loginScope and the email index.
const mongoose = require('mongoose');
const { loginScope } = require('../utils/customerIdentity');
async function migrate(db, apply = false) {
  const users = db.collection('users');
  const rows = await users
    .find(
      {},
      { projection: { _id: 1, role: 1, tenant: 1, email: 1, loginScope: 1 } },
    )
    .toArray();
  const seen = new Set();
  const updates = [];
  let tenantCustomers = 0;
  for (const row of rows) {
    const scope = loginScope(row);
    if (scope.startsWith('tenant:')) tenantCustomers++;
    const email = String(row.email || '')
      .trim()
      .toLowerCase();
    if (!email || email !== row.email)
      throw new Error(
        'Account email normalization requires manual review; no migration applied',
      );
    const key = `${email}:${scope}`;
    if (seen.has(key))
      throw new Error(
        'Duplicate email in an account namespace; no migration applied',
      );
    seen.add(key);
    if (row.loginScope !== scope)
      updates.push({
        updateOne: {
          // Ownership is part of the write guard; concurrent role/tenant changes do not get overwritten.
          filter: { _id: row._id, role: row.role, tenant: row.tenant || null },
          update: { $set: { loginScope: scope } },
        },
      });
  }
  const indexes = await users.indexes();
  const old = indexes.filter(
    (index) =>
      index.unique &&
      Object.keys(index.key).length === 1 &&
      index.key.email === 1,
  );
  const report = {
    totalAccounts: rows.length,
    tenantCustomers,
    platformAccounts: rows.length - tenantCustomers,
    namespaceUpdates: updates.length,
    oldEmailIndexes: old.map((index) => index.name),
    applied: false,
  };
  if (!apply) return report;
  if (updates.length) {
    const result = await users.bulkWrite(updates, { ordered: true });
    if (result.matchedCount !== updates.length)
      throw new Error(
        'Account ownership changed during migration; rerun dry-run',
      );
  }
  // Check every namespace again after guarded backfill, before releasing the old unique index.
  const current = await users
    .find({}, { projection: { role: 1, tenant: 1, loginScope: 1 } })
    .toArray();
  if (current.some((row) => row.loginScope !== loginScope(row)))
    throw new Error(
      'Account namespace changed during migration; rerun dry-run',
    );
  await users.createIndex(
    { email: 1, loginScope: 1 },
    { unique: true, name: 'email_loginScope_unique' },
  );
  for (const index of old) await users.dropIndex(index.name);
  return { ...report, applied: true };
}
if (require.main === module) {
  (async () => {
    if (!process.env.MONGODB_URI)
      throw new Error('MONGODB_URI must be set explicitly');
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    try {
      console.log(
        JSON.stringify(
          await migrate(
            mongoose.connection.db,
            process.argv.includes('--apply'),
          ),
          null,
          2,
        ),
      );
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { migrate };
