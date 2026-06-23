/**
 * Reconcile collection indexes with the current Mongoose schemas on startup.
 *
 * Mongoose's default autoIndex CREATES indexes declared on a schema but NEVER
 * drops ones that are no longer declared. After the single-per-subproduct →
 * multi-warehouse model rewrite, databases migrated from the old model keep
 * stale indexes — most damagingly the old UNIQUE `tenant_1_subProduct_1`. The
 * new Warehouse schema has no `subProduct`, so a second warehouse stores
 * `subProduct: null` and collides ("E11000 dup key … subProduct: null").
 *
 * syncIndexes() drops every index not declared on the current schema and
 * creates any that are missing, so a migrated DB self-heals on boot instead of
 * relying on someone remembering to run scripts/migrate-warehouse-indexes.js.
 * It diffs first, so it is a cheap no-op once the indexes already match.
 *
 * Best-effort and non-fatal: an index reconciliation failure must not stop the
 * server from coming up.
 */
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');

// Models whose collections were affected by the multi-warehouse rewrite.
const MODELS = [Warehouse, WarehouseStock, WarehouseMovement];

async function reconcileIndexes() {
  // Tests manage their own DB lifecycle; skip to avoid surprise index churn.
  if (process.env.NODE_ENV === 'test') return;

  for (const model of MODELS) {
    try {
      const dropped = await model.syncIndexes();
      if (dropped && dropped.length) {
        console.log(`🔧 Reconciled ${model.modelName} indexes — dropped stale: ${dropped.join(', ')}`);
      }
    } catch (err) {
      // Collection may not exist yet on a fresh DB, or the user may lack index
      // privileges — neither should block startup.
      console.warn(`⚠️  Could not reconcile ${model.modelName} indexes: ${err.message}`);
    }
  }
}

module.exports = { reconcileIndexes };
