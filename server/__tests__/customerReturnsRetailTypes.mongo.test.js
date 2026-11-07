'use strict';
// DRI-33 — /inventory customer-returns variant identity (board scope
// extension #9, checklist item 4, server side).
//
// Server gap on record (docs/memory/pos-retail-accommodation.md, ten-surface
// enumeration, item 4): customerReturns browse/evidence Size $lookup projected
// 'size, displayName' only — colorName/colorHexCode/optionName were dropped, so
// a restaurant's "Jollof portion" and "Goat portion" rows (and a fashion
// subProduct's Emerald/Ivory rows) rendered identical on the list. The fix is
// DATA PROVISION ONLY, mirroring DRI-29: the Size projection now carries the
// identity fields verbatim and each identity key is emitted only when the
// matched Size actually carries that value (emit-only-with-identity). Rows
// whose Size has no variant identity — legacy beverage rows AND the profiled
// beverage flavour's identity-less volume/pack rows ('750ml' / 'Case of 6') —
// keep their exact pre-change row shape (no new keys, byte-identical). No
// label composition server-side; the stored snapshot displayName stays
// authoritative. The restock lever is the POS returns flow
// (pos.controller.js, orderItemIndex + sizeId — DRI-4-verified) and is NOT
// touched: this fixture walks the /inventory read payload only.
//
// Pattern: DRI-16/DRI-32 real-HTTP + real-Mongo fixture — disposable
// PID-suffixed replica-set Mongo, real inventory router (protect + attachTenant
// + requireOwnTenant), real aggregation (listCustomerReturns → sources.js +
// evidence.js). The 8-tenant matrix comes from fixtures/dri33VariantMatrix.js
// (the DRI-16/DRI-32 flavour matrix): five retail types (Fashion lead with
// colorName/colorHexCode on both variants), Electronics/Beauty/Home/General
// (optionName-only variants), profiled beverage (colourless volume/pack),
// Restaurant (same-size portion rows, optionName identity only), plus the
// unprofiled legacy beverage control.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/customerReturnsRetailTypes.mongo.test.js
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

const oid = () => new mongoose.Types.ObjectId();

// Distinct per-source return quantities per variant line — deliberately
// different so a conflation bug surfaces as a wrong value mapping, not a zero.
const SALES_RETURN_FIRST = 3, SALES_RETURN_SECOND = 2;
const POS_RETURN_FIRST = 2, POS_RETURN_SECOND = 1;

async function seedReturnsData(state) {
  const db = mongoose.connection.db;
  const tenantId = new mongoose.Types.ObjectId(state.tenantId);
  const productId = new mongoose.Types.ObjectId(state.productId);
  const subId = new mongoose.Types.ObjectId(state.sub.subId);
  const warehouseId = new mongoose.Types.ObjectId(state.warehouseIds[0]);
  const def = state.def;

  // ── Sales order: one line per exact Size, each with its own returnedQty ──
  const soId = oid();
  const soItems = state.sub.sizes.map((s, i) => ({
    _id: oid(),
    name: def.productName,
    product: productId,
    subproduct: subId,
    size: new mongoose.Types.ObjectId(s._id),
    quantity: 10,
    fulfilledQty: 10,
    returnedQty: i === 0 ? SALES_RETURN_FIRST : SALES_RETURN_SECOND,
  }));
  await db.collection('salesorders').insertOne({
    _id: soId, tenant: tenantId,
    soNumber: `SO-D33-${def.key}`, docType: 'order',
    items: soItems,
  });

  // Restock evidence for the FIRST sale line only (size-scoped movement) —
  // the second line stays with no evidence (stockEvidence 'unverified').
  await db.collection('inventorymovements').insertOne({
    tenant: tenantId, subProduct: subId,
    size: new mongoose.Types.ObjectId(state.sub.sizes[0]._id),
    warehouse: warehouseId,
    type: 'return', category: 'in', status: 'confirmed',
    referenceType: 'return',
    reference: `SO-D33-${def.key}`,
    relatedSalesOrder: soId,
    quantity: SALES_RETURN_FIRST,
    createdAt: new Date('2026-11-01'),
  });

  // ── POS order: refund one restocked line (exact Size) + one not-restocked ──
  // Seeded only for multi-size flavours: the legacy control keeps its
  // byte-identical single-size sales-only shape, and each refund targets a
  // DIFFERENT orderItemIndex (0 and the last index) so the refundNever
  // ambiguity guard stays false for both rows.
  state.posId = null;
  if (state.sub.sizes.length > 1) {
    const posId = oid();
    const lastIndex = state.sub.sizes.length - 1;
    const posItems = state.sub.sizes.map((s) => ({
      _id: oid(),
      name: def.productName,
      product: productId,
      subproduct: subId,
      size: new mongoose.Types.ObjectId(s._id),
      quantity: 10,
      fulfilledQty: 10,
      returnedQty: 0,
      warehouse: warehouseId,
    }));
    await db.collection('orders').insertOne({
      _id: posId, tenant: tenantId, source: 'pos',
      orderNumber: `POS-D33-${def.key}`, receiptNumber: `RCP-D33-${def.key}`,
      items: posItems,
      refunds: [
        {
          receiptNumber: `RET-A-${def.key}`,
          refundedAt: new Date('2026-11-02'),
          reason: 'Damaged in transit',
          items: [{
            orderItemIndex: 0, quantity: POS_RETURN_FIRST,
            restock: true, restockedQuantity: POS_RETURN_FIRST,
          }],
        },
        {
          receiptNumber: `RET-B-${def.key}`,
          refundedAt: new Date('2026-11-03'),
          items: [{ orderItemIndex: lastIndex, quantity: POS_RETURN_SECOND, restock: false }],
        },
      ],
    });

    // Restock evidence for refund A (exact-Size movement row, DRI-4 lever
    // untouched — seeded the same shape the POS returns flow records).
    await db.collection('inventorymovements').insertOne({
      tenant: tenantId, subProduct: subId,
      size: new mongoose.Types.ObjectId(state.sub.sizes[0]._id),
      warehouse: warehouseId,
      type: 'return', category: 'in', status: 'confirmed',
      referenceType: 'return',
      reference: `RET-A-${def.key}`,
      relatedOrder: posId,
      quantity: POS_RETURN_FIRST,
      createdAt: new Date('2026-11-02'),
    });

    state.posId = String(posId);
  }
  state.soId = String(soId);
  state.soItemIds = soItems.map((it) => String(it._id));
  return state;
}

test('customer_returns_variant_identity_eight_tenants_payload', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'dri33_returns_identity');

  // Seed the 7-industry matrix + the legacy control; one subProduct per
  // tenant with the flavour's exact Size rows.
  const tenants = [];
  for (const def of RETAIL_TYPES) {
    const base = await seedTenantBase(def);
    const sub = await seedVariantsSubProduct(def, base, {});
    tenants.push({ ...base, sub });
  }
  const legacyBase = await seedTenantBase(LEGACY_DEF);
  const legacySub = await seedVariantsSubProduct(LEGACY_DEF, legacyBase, { legacy: true });
  tenants.push({ ...legacyBase, sub: legacySub });

  for (const state of tenants) await seedReturnsData(state);

  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require('../routes/inventory.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

      const list = await request(state, '/api/inventory/customer-returns');
      assert.equal(list.status, 200, `${def.key}: customer-returns read failed: ${JSON.stringify(list)}`);
      const rows = list.data.rows;
      const expectPos = !!state.posId;
      assert.equal(
        list.data.total,
        state.sub.sizes.length * (expectPos ? 2 : 1),
        `${def.key}: total return rows (sales + ${expectPos ? 'POS' : 'sales-only legacy'})`
      );

      const bySource = new Map(rows.map((r) => [r.id, r]));
      for (let i = 0; i < state.sub.sizes.length; i++) {
        const s = state.sub.sizes[i];

        // ── Sales-origin row (exact Size id from sources.js L63 $ifNull) ──
        const salesRow = bySource.get(`sales:${state.soId}:${state.soItemIds[i]}`);
        assert.ok(salesRow, `${def.key}: sales row present for size ${i}`);
        assert.equal(salesRow.source, 'sales');
        // The stored snapshot displayName must resolve from THIS row's exact
        // Size — '750ml' and 'Case of 6' name their own distinct Size docs.
        assert.equal(salesRow.size, s.displayName, `${def.key}: sales row ${i} carries its exact Size's snapshot`);
        assert.equal(salesRow.returned, i === 0 ? SALES_RETURN_FIRST : SALES_RETURN_SECOND, `${def.key}: sales row ${i} returned`);
        if (i === 0) {
          assert.equal(salesRow.restocked, SALES_RETURN_FIRST, `${def.key}: sales row ${i} restock evidenced per exact size`);
          assert.equal(salesRow.stockEvidence, 'verified', `${def.key}: sales row ${i} verified`);
        } else {
          assert.equal(salesRow.stockEvidence, 'unverified', `${def.key}: sales row ${i} unevidenced`);
          assert.equal(salesRow.notRestocked ?? 0, 0, `${def.key}: sales row ${i} unevidenced leaves no notRestocked units`);
        }

        // ── POS-origin row (sources.js L154 sizeId $ifNull) ────────────────
        const posRow = expectPos ? bySource.get(`pos:${state.posId}:${i}:0`) : null;
        assert.equal(!!posRow, expectPos, `${def.key}: POS row presence for size ${i}`);
        if (posRow) {
          assert.equal(posRow.source, 'pos');
          assert.equal(posRow.size, s.displayName, `${def.key}: POS row ${i} carries its exact Size's snapshot`);
          assert.equal(posRow.returned, i === 0 ? POS_RETURN_FIRST : POS_RETURN_SECOND, `${def.key}: POS row ${i} returned`);
          if (i === 0) {
            assert.equal(posRow.restocked, POS_RETURN_FIRST, `${def.key}: POS row ${i} restocked per exact size`);
          } else {
            assert.equal(posRow.notRestocked, POS_RETURN_SECOND, `${def.key}: POS row ${i} not restocked`);
          }
        }

        // ── Identity payload (emit-only-with-identity, both sources) ───────
        for (const row of [salesRow, posRow].filter(Boolean)) {
          if (def.key === 'legacy') {
            // Byte-identical legacy row shape: NO identity keys, no new keys
            // of any kind on an identity-less Size.
            assert.equal('colorName' in row, false, `${def.key}: legacy row carries no colorName key`);
            assert.equal('colorHexCode' in row, false, `${def.key}: legacy row carries no colorHexCode key`);
            assert.equal('optionName' in row, false, `${def.key}: legacy row carries no optionName key`);
          } else if (s.colorName) {
            assert.equal(row.colorName, s.colorName, `${def.key}: row ${i} colorName verbatim`);
            assert.equal(row.colorHexCode, s.colorHexCode, `${def.key}: row ${i} colorHexCode verbatim`);
            assert.equal(row.optionName, s.optionName, `${def.key}: row ${i} optionName verbatim`);
          } else if (s.optionName) {
            assert.equal(row.optionName, s.optionName, `${def.key}: row ${i} optionName verbatim`);
            assert.equal('colorName' in row, false, `${def.key}: option-only row ${i} carries no colorName key`);
            assert.equal('colorHexCode' in row, false, `${def.key}: option-only row ${i} carries no colorHexCode key`);
          } else {
            // Profiled-beverage identity-free volume/pack rows: EXACT pre-change
            // shape — no identity keys (and no sizeId) on the row.
            assert.equal('colorName' in row, false, `${def.key}: beverage row ${i} carries no colorName key`);
            assert.equal('colorHexCode' in row, false, `${def.key}: beverage row ${i} carries no colorHexCode key`);
            assert.equal('optionName' in row, false, `${def.key}: beverage row ${i} carries no optionName key`);
          }
        }
      }

      // Distinct rows per exact Size — per flavour the two same-size rows
      // never merge (Emerald/Ivory; Jollof/Goat; 750ml/Case-of-6 distinct; the
      // legacy control stays the single identity-less row).
      if (expectPos || state.sub.sizes.length > 1) {
        const labels = rows.map((r) => r.size);
        assert.equal(new Set(labels).size, state.sub.sizes.length, `${def.key}: rows distinct per exact Size label`);
      }

      // ── Summary ──────────────────────────────────────────────────────────
      const salesFirst = SALES_RETURN_FIRST, salesSecond = state.sub.sizes.length > 1 ? SALES_RETURN_SECOND : 0;
      assert.equal(list.data.summary.returned, salesFirst + salesSecond + (expectPos ? POS_RETURN_FIRST + POS_RETURN_SECOND : 0), `${def.key}: summary returned`);
      assert.equal(list.data.summary.restocked, salesFirst + (expectPos ? POS_RETURN_FIRST : 0), `${def.key}: summary restocked`);
      assert.equal(list.data.summary.notRestocked, expectPos ? POS_RETURN_SECOND : 0, `${def.key}: summary notRestocked`);

      // ── Tenant isolation ──────────────────────────────────────────────────
      const other = tenants.find((x) => x !== state);
      assert.equal(
        rows.every((r) => !r.id.includes(other.soId) && !r.id.includes(other.posId)),
        true,
        `${def.key}: no foreign rows surfaced`
      );
    }

    // Cross-tenant probe: a super-admin-pivot is impossible here (requireOwnTenant);
    // assert a row from another tenant's exact Size id never appears.
    const first = tenants[0];
    const firstRows = (await request(first, '/api/inventory/customer-returns')).data.rows;
    assert.equal(
      firstRows.some((r) => (r.size ?? '').includes(tenants[1].def.productName)),
      false,
      'no foreign product/size identity leaks across tenants'
    );

    console.log(JSON.stringify({
      DRI_EVIDENCE_ID: 'DRI_EVIDENCE_DRI33_CUSTOMER_RETURNS_VARIANT_IDENTITY',
      environment: 'isolated customer-returns fixture: real inventory router + real aggregation on disposable replica-set Mongo (:29127)',
      tenants: tenants.map((s) => s.def.key),
      payloadSurfaces: ['GET /api/inventory/customer-returns (listCustomerReturns → sources.js + evidence.js)'],
      invariants: [
        'rows carry colorName/colorHexCode/optionName verbatim per exact Size (emit-only-with-identity)',
        'legacy beverage rows AND profiled-beverage 750ml/Case-of-6 rows keep the exact pre-change row shape (no identity/sized keys)',
        'Emerald/Ivory, Jollof/Goat, 750ml/Case-of-6 rows stay distinct rows keyed by their own exact Size snapshot',
        'restock disposition adjudicated per exact Size over the seeded movement evidence (POS returns lever untouched)',
        'summary + tenant isolation hold over the real aggregation',
      ],
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
