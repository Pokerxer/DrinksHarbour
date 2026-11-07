'use strict';
// DRI-33 — /inventory procurement + replenishment backend slice (board scope
// extension #9, checklist items 9 AND 10).
//
// Server gaps on record (docs/memory/pos-retail-accommodation.md, ten-surface
// enumeration):
//   • PROCUREMENT (9): getReorderSuggestions was SubProduct-aggregate only —
//     suggestions are now PER VARIANT built from on-hand per exact Size row
//     (WarehouseStock currentQuantity - reservedQuantity, summed over every
//     warehouse), with sizeId + size + displayName + verbatim colour/option
//     identity on each suggestion (emit-only-with-identity: sizeless beverages
//     keep the exactly pre-change aggregation shape; identity-less Size rows —
//     the beverage 750ml / 'Case of 6' volume/pack rows — carry no identity
//     keys). urgency/reorderPoint/suggestedQuantity are recomputed per variant
//     from the Size row (Size-level reorderLevel when the Size carries one,
//     falling back to the subProduct fields exactly as before).
//   • REPLENISHMENT (10): ReorderRule.size existed but was never evaluated and
//     never populated. getRules/getRuleById now populate 'size' with identity
//     (DRI-29 mirror); the evaluation engine (checkRules/triggerRule) computes
//     currentStock from the rule's exact Size row WarehouseStock on-hand for
//     the rule's warehouse scope — SIZELESS RULES AND ALL EXISTING BEVERAGE
//     VOLUME/PACK RULES KEEP BIT-IDENTICAL BEHAVIOUR (recorded decision). Sales
//     velocity stays at subProduct level (stated in the evidence).
//
// Pattern: DRI-16/DRI-32 real-HTTP + real-Mongo fixture — disposable
// PID-suffixed replica-set Mongo, real reorder router (protect + attachTenant
// + requireOwnTenant + purchase_orders plan gate), real service. 8-tenant
// matrix from fixtures/dri33VariantMatrix.js. The PO-raising handoff target
// is the /purchases verified pickers (DRI-14): suggestion rows carry the
// exact fields pickers consume per Size (sizeId, size display data, unitType,
// unitsPerPack, unitCost) — the picker logic stays theirs; this payload only
// supplies the per-variant rows.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/reorderProcurementRetailTypes.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
const {
  RETAIL_TYPES, LEGACY_DEF, seedTenantBase, seedVariantsSubProduct,
} = require('./fixtures/dri33VariantMatrix');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Per-flavour WarehouseStock layout + expected per-variant values.
// Variant 0: on-hand 6 (4 at warehouse 0 + 2 at warehouse 1, one line reserved)
// against a Size-level reorderLevel 12 → 'high'; the warehouse-1 rule trigger
// reads ONLY warehouse 1 (on-hand 2).
// Variant 1: well-stocked above its own Size threshold except the Restaurant
// portion row (Goat) which sits at 0 → 'critical'.
const FLAVOUR_STOCK = {
  fashion: { v0: [{ warehouseIndex: 0, currentQuantity: 5, reservedQuantity: 1 }, { warehouseIndex: 1, currentQuantity: 2, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 40, reservedQuantity: 0 }] },
  electronics: { v0: [{ warehouseIndex: 0, currentQuantity: 5, reservedQuantity: 1 }, { warehouseIndex: 1, currentQuantity: 2, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 30, reservedQuantity: 0 }] },
  beauty: { v0: [{ warehouseIndex: 0, currentQuantity: 5, reservedQuantity: 1 }, { warehouseIndex: 1, currentQuantity: 2, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 30, reservedQuantity: 0 }] },
  home: { v0: [{ warehouseIndex: 0, currentQuantity: 5, reservedQuantity: 1 }, { warehouseIndex: 1, currentQuantity: 2, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 30, reservedQuantity: 0 }] },
  general: { v0: [{ warehouseIndex: 0, currentQuantity: 5, reservedQuantity: 1 }, { warehouseIndex: 1, currentQuantity: 2, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 30, reservedQuantity: 0 }] },
  beverage: { v0: [{ warehouseIndex: 0, currentQuantity: 3, reservedQuantity: 1 }, { warehouseIndex: 1, currentQuantity: 4, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 100, reservedQuantity: 20 }] },
  restaurant: { v0: [{ warehouseIndex: 0, currentQuantity: 4, reservedQuantity: 0 }, { warehouseIndex: 1, currentQuantity: 2, reservedQuantity: 0 }], v1: [{ warehouseIndex: 0, currentQuantity: 0, reservedQuantity: 0 }] },
};
const SIZE_REORDER_LEVELS = {
  fashion: [12, 50], electronics: [12, 40], beauty: [12, 40],
  home: [12, 40], general: [12, 40], beverage: [12, 90], restaurant: [12, 9],
};
// Expected per-variant suggestion values (currentStock/reorderPoint/urgency).
const EXPECTED = {
  fashion: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 40, reorderPoint: 50, urgency: 'normal' },
  ],
  electronics: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 30, reorderPoint: 40, urgency: 'normal' },
  ],
  beauty: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 30, reorderPoint: 40, urgency: 'normal' },
  ],
  home: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 30, reorderPoint: 40, urgency: 'normal' },
  ],
  general: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 30, reorderPoint: 40, urgency: 'normal' },
  ],
  beverage: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 80, reorderPoint: 90, urgency: 'normal' },
  ],
  restaurant: [
    { currentStock: 6, reorderPoint: 12, urgency: 'high' },
    { currentStock: 0, reorderPoint: 9, urgency: 'critical' },
  ],
};

const SUB_METRICS = {
  availableStock: 3, reorderPoint: 10, reorderQuantity: 50,
  costPrice: 100, leadTimeDays: 7,
};
// Catch-up subProduct: stored AGGREGATE (500) is far above the subProduct
// threshold, so the pre-change aggregate query never returned it — but its
// variant 0 sits at on-hand 1. The per-variant scan must surface it.
const CATCHUP_METRICS = { ...SUB_METRICS, availableStock: 500 };
// Catch-up variant 0 sits at on-hand 1; variant 1 is deliberately far above
// its own threshold (Size-level where seeded, subProduct fallback otherwise)
// so ONLY the low variant qualifies per sub.
const CATCHUP_STOCK = [
  [{ warehouseIndex: 0, currentQuantity: 1, reservedQuantity: 0 }],
  [{ warehouseIndex: 0, currentQuantity: 500, reservedQuantity: 0 }],
];
const CATCHUP_EXPECTED_V0 = { currentStock: 1, urgency: 'high' };

async function seedSub(def, base, kind) {
  const stock = kind === 'legacy'
    ? null
    : kind === 'catchup'
      ? CATCHUP_STOCK
      : [
          FLAVOUR_STOCK[def.key].v0,
          FLAVOUR_STOCK[def.key].v1,
        ];
  const options = kind === 'legacy'
    ? { legacy: true, metrics: SUB_METRICS }
    : kind === 'catchup'
      ? {
          metrics: CATCHUP_METRICS,
          stock,
          sizeOpts: kind === 'beverage'
            ? undefined
            : { 0: { reorderLevel: SIZE_REORDER_LEVELS[def.key][0] } },
        }
      : {
          metrics: SUB_METRICS,
          stock,
          sizeOpts: { 0: { reorderLevel: SIZE_REORDER_LEVELS[def.key][0] }, 1: { reorderLevel: SIZE_REORDER_LEVELS[def.key][1] } },
        };
  return seedVariantsSubProduct(def, base, options);
}

test('reorder_suggestions_per_variant_and_rules_size_engine', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'dri33_reorder_variants');

  const tenants = [];
  for (const def of RETAIL_TYPES) {
    const base = await seedTenantBase(def);
    const lead = await seedSub(def, base, 'lead');
    const catchup = await seedSub(def, base, 'catchup');
    tenants.push({ ...base, lead, catchup });
  }
  const legacyBase = await seedTenantBase(LEGACY_DEF);
  const legacyLead = await seedVariantsSubProduct(LEGACY_DEF, legacyBase, { legacy: true, metrics: SUB_METRICS });
  tenants.push({ ...legacyBase, lead: legacyLead });

  const app = express();
  app.use(express.json());
  app.use('/api/reorder', require('../routes/reorder.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  async function request(state, path, method = 'GET', body) {
    const token = jwt.sign(
      { userId: state.adminId, email: `${state.def.key}@test.local`, role: 'tenant_admin', tenant: state.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    return { status: response.status, ...data };
  }

  try {
    for (const state of tenants) {
      const def = state.def;
      const isLegacy = def.key === 'legacy';

      // ── 1. PROCUREMENT — per-variant suggestions ──────────────────────────
      const suggestions = await request(state, '/api/reorder/suggestions');
      assert.equal(suggestions.status, 200, `${def.key}: suggestions read failed: ${JSON.stringify(suggestions)}`);
      const rows = suggestions.data;
      assert.equal(
        rows.length,
        isLegacy ? 1 : 3,
        `${def.key}: suggestion row count (lead variants + catch-up ${isLegacy ? '(legacy has none)' : ''})`
      );
      const leadRows = rows.filter((r) => r.subProductId === state.lead.subId);
      const catchUpRows = rows.filter((r) => r.subProductId === state.catchup?.subId);
      assert.equal(leadRows.length, isLegacy ? 1 : 2, `${def.key}: lead sub row count (legacy: the single sizeless aggregate row)`);
      assert.equal(catchUpRows.length, isLegacy ? 0 : 1, `${def.key}: catch-up sub surfaces its qualified variant only`);
      assert.equal(
        rows.some((r) => r.subProductId === state.lead.subId && 'sizeId' in r),
        !isLegacy,
        `${def.key}: legacy payload carries no sizeId`
      );

      if (!isLegacy) {
        for (let i = 0; i < state.lead.sizes.length; i++) {
          const s = state.lead.sizes[i];
          const row = leadRows.find((r) => String(r.sizeId) === s._id);
          assert.ok(row, `${def.key}: suggestion present for exact size ${i}`);
          const exp = EXPECTED[def.key][i];
          assert.equal(row.currentStock, exp.currentStock, `${def.key}: suggestion ${i} currentStock recomputed from its exact Size's WarehouseStock rows`);
          assert.equal(row.reorderPoint, exp.reorderPoint, `${def.key}: suggestion ${i} reorderPoint from the Size row`);
          assert.equal(row.urgency, exp.urgency, `${def.key}: suggestion ${i} urgency per variant`);
          assert.equal(row.suggestedQuantity, Math.max(50, exp.reorderPoint * 2 - exp.currentStock), `${def.key}: suggestion ${i} suggestedQuantity per variant`);
          assert.equal(row.unitCost, def.unitCost, `${def.key}: suggestion ${i} unitCost from the Size row`);
          assert.equal(row.estimatedCost, def.unitCost * row.reorderQuantity, `${def.key}: suggestion ${i} estimatedCost per variant`);
          for (const key of ['colorName', 'colorHexCode', 'optionName']) {
            assert.equal(key in row, !!s[key], `${def.key}: suggestion ${i} ${key} emit-only-with-identity`);
          }
          if (s.colorName) {
            assert.equal(row.colorName, s.colorName, `${def.key}: suggestion ${i} colorName verbatim`);
            assert.equal(row.colorHexCode, s.colorHexCode, `${def.key}: suggestion ${i} colorHexCode verbatim`);
            assert.equal(row.optionName, s.optionName, `${def.key}: suggestion ${i} optionName verbatim`);
          } else if (s.optionName) {
            assert.equal(row.optionName, s.optionName, `${def.key}: suggestion ${i} optionName verbatim`);
          }
          // PO-picker handoff consumables (DRI-14 pickers read unitType and
          // unitsPerPack off the Size row). Emitted with the flavour's stored
          // unitType — per-row for the beverage volume/pack flavour.
          assert.equal(row.unitType, s.unitType, `${def.key}: suggestion ${i} unitType rides along for the packaging handoff`);
        }
        // Distinct rows per exact Size — no variant conflation regardless of
        // flavour (Emerald/Ivory, Jollof/Goat, 750ml/Case-of-6).
        assert.equal(
          new Set(leadRows.map((r) => String(r.sizeId))).size,
          state.lead.sizes.length,
          `${def.key}: lead suggestions keyed by DISTINCT exact sizeIds`
        );

        // Catch-up row: the aggregate gate missed it (500 > 10) — the per-
        // variant scan surfaced the at-threshold variant.
        const catchRow = catchUpRows.find((r) => String(r.sizeId) === state.catchup.sizes[0]._id);
        assert.ok(catchRow, `${def.key}: catch-up row present for the exact low variant`);
        assert.equal(catchRow.currentStock, CATCHUP_EXPECTED_V0.currentStock, `${def.key}: catch-up currentStock per exact Size`);
        assert.equal(catchRow.urgency, CATCHUP_EXPECTED_V0.urgency, `${def.key}: catch-up urgency per exact Size`);
      } else {
        // BYTE-IDENTICAL legacy mapping — field-by-field assertion of the
        // whole sizeless row (+ no new keys anywhere).
        const expectedLegacy = {
          subProductId: state.lead.subId, sku: def.sku,
          currentStock: SUB_METRICS.availableStock,
          reorderPoint: SUB_METRICS.reorderPoint,
          reorderQuantity: SUB_METRICS.reorderQuantity,
          suggestedQuantity: Math.max(
            SUB_METRICS.reorderQuantity,
            SUB_METRICS.reorderPoint * 2 - SUB_METRICS.availableStock
          ),
          leadTimeDays: SUB_METRICS.leadTimeDays,
          unitCost: SUB_METRICS.costPrice,
          estimatedCost: SUB_METRICS.costPrice * SUB_METRICS.reorderQuantity,
          urgency: SUB_METRICS.availableStock <= 0
            ? 'critical'
            : SUB_METRICS.availableStock <= SUB_METRICS.reorderPoint / 2 ? 'high' : 'normal',
        };
        const row = rows[0];
        assert.equal(row.subProductId, expectedLegacy.subProductId, 'legacy: subProductId unchanged');
        assert.equal(row.sku, expectedLegacy.sku, 'legacy: sku unchanged');
        assert.equal(row.currentStock, expectedLegacy.currentStock, 'legacy: currentStock aggregate unchanged');
        assert.equal(row.reorderPoint, expectedLegacy.reorderPoint, 'legacy: reorderPoint unchanged');
        assert.equal(row.reorderQuantity, expectedLegacy.reorderQuantity, 'legacy: reorderQuantity unchanged');
        assert.equal(row.suggestedQuantity, expectedLegacy.suggestedQuantity, 'legacy: suggestedQuantity formula unchanged');
        assert.equal(row.leadTimeDays, expectedLegacy.leadTimeDays, 'legacy: leadTimeDays unchanged');
        assert.equal(row.unitCost, expectedLegacy.unitCost, 'legacy: unitCost unchanged');
        assert.equal(row.estimatedCost, expectedLegacy.estimatedCost, 'legacy: estimatedCost unchanged');
        assert.equal(row.urgency, expectedLegacy.urgency, 'legacy: urgency unchanged');
        assert.ok('product' in row, 'legacy: product key still present');
        for (const key of ['sizeId', 'size', 'displayName', 'colorName', 'colorHexCode', 'optionName', 'unitType', 'unitsPerPack']) {
          assert.equal(key in row, false, `legacy: row carries no ${key} key (byte-identical shape)`);
        }
      }

      // ── 2. REPLENISHMENT — rules Size populate + per-Size engine ─────────
      const ruleBody = {
        subProductId: state.lead.subId,
        name: `${def.key} variant rule`,
        triggerType: 'reorder_point',
        reorderPoint: 12,
        orderQuantity: 20,
        checkFrequency: 'realtime',
      };
      if (!isLegacy) ruleBody.sizeId = state.lead.sizes[0]._id;
      const created = await request(state, '/api/reorder/rules', 'POST', ruleBody);
      assert.equal(created.status, 201, `${def.key}: size-scoped rule create failed: ${JSON.stringify(created)}`);

      let whRule = null;
      if (!isLegacy) {
        whRule = await request(state, '/api/reorder/rules', 'POST', {
          subProductId: state.lead.subId,
          name: `${def.key} warehouse-scoped rule`,
          warehouseId: state.warehouseIds[1],
          sizeId: state.lead.sizes[0]._id,
          triggerType: 'reorder_point',
          reorderPoint: 12,
          orderQuantity: 20,
          checkFrequency: 'realtime',
        });
        assert.equal(whRule.status, 201, `${def.key}: warehouse-scoped rule create failed: ${JSON.stringify(whRule)}`);
      }

      // getRules — size populate carries identity verbatim (DRI-29 mirror);
      // sizeless rules populate to null and keep their exact shape.
      const rulesRes = await request(state, '/api/reorder/rules?limit=50');
      assert.equal(rulesRes.status, 200, `${def.key}: rules read failed: ${JSON.stringify(rulesRes)}`);
      const rules = rulesRes.data.filter((r) => r.name === ruleBody.name);
      assert.equal(rules.length, 1, `${def.key}: created rule listed once`);
      const rule = rules[0];
      if (isLegacy) {
        // populate leaves an unset rule.size unset — the legacy list payload
        // keeps its exact pre-change shape (no size present, null or absent).
        assert.ok(!rule.size, 'legacy: rule.size stays unset (no per-Size evaluation)');
      } else {
        const s = state.lead.sizes[0];
        assert.equal(String(rule.size._id), s._id, `${def.key}: rule.size populated to the exact Size`);
        assert.equal(rule.size.size, s.size, `${def.key}: rule.size size string verbatim`);
        assert.equal(rule.size.displayName, s.displayName, `${def.key}: rule.size displayName verbatim`);
        if (s.colorName) {
          assert.deepEqual(
            Object.keys(rule.size).sort(),
            ['_id', 'colorHexCode', 'colorName', 'displayName', 'optionName', 'size'],
            `${def.key}: populated Size keys exact (colour row)`
          );
        } else if (s.optionName) {
          assert.deepEqual(
            Object.keys(rule.size).sort(),
            ['_id', 'displayName', 'optionName', 'size'],
            `${def.key}: populated Size keys exact (option row)`
          );
        } else {
          assert.deepEqual(
            Object.keys(rule.size).sort(),
            ['_id', 'displayName', 'size'],
            `${def.key}: populated Size keys exact (identity-free beverage row — pre-change shape)`
          );
        }
      }

      // getRuleById — same populate mirror.
      const single = await request(state, `/api/reorder/rules/${rule._id}`);
      assert.equal(single.status, 200, `${def.key}: rule by id failed: ${JSON.stringify(single)}`);
      if (isLegacy) {
        assert.ok(!single.data.size, 'legacy: by-id rule.size stays unset');
      } else {
        assert.equal(String(single.data.size._id), state.lead.sizes[0]._id, `${def.key}: by-id size populate`);
      }

      // POST /api/reorder/check — the engine walks both rules.
      const check = await request(state, '/api/reorder/check', 'POST', {});
      assert.equal(check.status, 200, `${def.key}: rules check failed: ${JSON.stringify(check)}`);
      const checkedLead = check.data.find((r) => String(r.ruleId) === String(rule._id));
      assert.ok(checkedLead, `${def.key}: lead rule evaluated by the checker`);
      assert.equal(checkedLead.currentStock, isLegacy ? SUB_METRICS.availableStock : EXPECTED[def.key][0].currentStock, `${def.key}: engine currentStock ${isLegacy ? '(aggregate, bit-identical legacy)' : '(per exact Size row on-hand)'}`);
      assert.equal(checkedLead.triggered, true, `${def.key}: engine triggered on the threshold`);
      if (!isLegacy && whRule) {
        const checkedWh = check.data.find((r) => String(r.ruleId) === String(whRule.data._id));
        assert.ok(checkedWh, `${def.key}: warehouse-scoped rule evaluated`);
        const expectedWhOnHand = FLAVOUR_STOCK[def.key].v0
          .filter((r) => r.warehouseIndex === 1)
          .reduce((sum, r) => sum + r.currentQuantity - r.reservedQuantity, 0);
        assert.equal(checkedWh.currentStock, expectedWhOnHand, `${def.key}: rule warehouse scope reads ONLY warehouse 1's row`);
      }

      // Manual trigger — rule.recentTriggers records the per-Size stock.
      const trigger = await request(state, `/api/reorder/rules/${rule._id}/trigger`, 'POST', { notes: 'DRI-33 per-size trigger' });
      assert.equal(trigger.status, 200, `${def.key}: manual trigger failed: ${JSON.stringify(trigger)}`);
      assert.equal(trigger.data.currentStock, isLegacy ? SUB_METRICS.availableStock : EXPECTED[def.key][0].currentStock, `${def.key}: manual trigger currentStock per-Size`);
      assert.equal(trigger.data.rule.recentTriggers[0].currentStock, trigger.data.currentStock, `${def.key}: recentTriggers snapshot per-Size`);

      // ── 3. Tenant isolation ──────────────────────────────────────────────
      const other = tenants.find((x) => x !== state);
      const foreign = await request(state, '/api/reorder/rules', 'POST', {
        subProductId: other.lead.subId,
        name: 'Cross-tenant probe',
        checkFrequency: 'realtime',
        ...(other.lead.sizes?.[0] ? { sizeId: other.lead.sizes[0]._id } : {}),
      });
      assert.equal(foreign.status, 404, `${def.key}: cross-tenant rule create rejected: ${JSON.stringify(foreign)}`);
      assert.equal(
        (await request(state, '/api/reorder/suggestions')).data.every((r) => r.subProductId !== other.lead.subId),
        true,
        `${def.key}: suggestions surface only this tenant's rows`
      );
    }

    console.log(JSON.stringify({
      DRI_EVIDENCE_ID: 'DRI_EVIDENCE_DRI33_PROCUREMENT_REPLENISHMENT_VARIANTS',
      environment: 'isolated reorder fixture: real reorder router + real service on disposable replica-set Mongo (:29127)',
      tenants: tenants.map((s) => s.def.key),
      payloadSurfaces: [
        'GET /api/reorder/suggestions (per-variant procurement rows → PO pickers handoff)',
        'GET /api/reorder/rules + /:id (Size identity populate)',
        'POST /api/reorder/rules (sizeId + warehouseId acceptance)',
        'POST /api/reorder/check + /:id/trigger (per-Size evaluation engine)',
      ],
      invariants: [
        'one suggestion per exact Size row with per-variant currentStock/reorderPoint/urgency recomputed from WarehouseStock',
        'sizeless beverage rows byte-identical to the pre-change aggregate mapping (no sizeId/size/identity keys)',
        'emit-only-with-identity on every new payload key (colour vars, option vars, identity-free volume/pack rows)',
        'rules populate Size identity verbatim; sizeless rules keep rule.size null',
        'size-scoped rules evaluate WarehouseStock on-hand per the rule warehouse scope; sizeless rules bit-identical aggregate read',
        'aggregate-gate-missed low variants surface via the bounded per-variant catch-up scan',
        'cross-tenant rule create 404; suggestions tenant-scoped',
      ],
      untouched: [
        'POS returns restock lever (pos.controller.js) per item 4',
        'sales velocity stays subProduct-level (coarse, stated)',
      ],
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
