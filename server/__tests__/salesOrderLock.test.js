const test = require('node:test');
const assert = require('node:assert/strict');
const SalesOrder = require('../models/SalesOrder');
const ctrl = require('../controllers/salesOrder.controller');
const log = require('../services/salesActivity.service');
const response = () => ({
  code: 200,
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const call = (fn, req, res) =>
  fn(req, res, (e) => {
    if (e) throw e;
  });

test('locking persists actor and timestamp in own tenant, unlock restores only lock state', async (t) => {
  assert.equal(typeof ctrl.lockSalesOrder, 'function');
  let saves = 0;
  const doc = {
    _id: 'sale',
    tenant: 'mine',
    docType: 'order',
    orderStatus: 'confirmed',
    locked: false,
    save: async () => {
      saves++;
    },
  };
  t.mock.method(SalesOrder, 'findOne', async (q) => {
    assert.deepEqual(q, { _id: 'sale', tenant: 'mine' });
    return doc;
  });
  const events = [];
  t.mock.method(log, 'logActivity', async (...args) => {
    events.push(args);
  });
  const req = {
    params: { id: 'sale' },
    tenant: { _id: 'mine' },
    user: { _id: 'staff' },
    body: { tenant: 'theirs' },
  };
  const locked = response();
  await call(ctrl.lockSalesOrder, req, locked);
  assert.equal(locked.body.data.locked, true);
  assert.equal(doc.lockedBy, 'staff');
  assert.ok(doc.lockedAt instanceof Date);
  assert.equal(doc.orderStatus, 'confirmed');
  await call(ctrl.lockSalesOrder, req, response());
  assert.equal(saves, 1, 'repeat lock is idempotent');
  await call(ctrl.unlockSalesOrder, req, response());
  assert.equal(doc.locked, false);
  assert.equal(
    doc.orderStatus,
    'confirmed',
    'unlock must not reopen or make paid orders drafts',
  );
  assert.equal(saves, 2);
  assert.equal(events.length, 2);
});

test('lock refuses unresolved tenants, foreign records and closed documents', async (t) => {
  assert.equal(typeof ctrl.lockSalesOrder, 'function');
  let reads = 0;
  t.mock.method(SalesOrder, 'findOne', async () => {
    reads++;
    return null;
  });
  const missing = response();
  await call(ctrl.lockSalesOrder, { params: { id: 'foreign' } }, missing);
  assert.equal(missing.code, 401);
  assert.equal(reads, 0);
  const foreign = response();
  await call(
    ctrl.lockSalesOrder,
    { params: { id: 'foreign' }, tenant: { _id: 'mine' } },
    foreign,
  );
  assert.equal(foreign.code, 404);
  t.mock.method(SalesOrder, 'findOne', async () => ({
    docType: 'order',
    orderStatus: 'cancelled',
    save: () => {
      throw new Error('must not save');
    },
  }));
  const closed = response();
  await call(
    ctrl.lockSalesOrder,
    { params: { id: 'sale' }, tenant: { _id: 'mine' } },
    closed,
  );
  assert.equal(closed.code, 409);
});

test('server rejects edit, repricing, coupon, confirmation and cancellation when locked', async (t) => {
  const doc = {
    _id: 'sale',
    tenant: 'mine',
    docType: 'order',
    orderStatus: 'draft',
    locked: true,
    items: [],
    save: () => {
      throw new Error('must not save');
    },
  };
  t.mock.method(SalesOrder, 'findOne', async () => doc);
  for (const name of [
    'updateSalesOrder',
    'updatePrices',
    'applyCoupon',
    'confirmSalesOrder',
    'deleteSalesOrder',
  ]) {
    const res = response();
    await call(
      ctrl[name],
      { params: { id: 'sale' }, tenant: { _id: 'mine' }, body: {} },
      res,
    );
    assert.equal(res.code, 409, name);
  }
});

test('a locked confirmed order can still be delivered through the normal tenant-scoped action', async (t) => {
  const fulfill = require('../services/salesFulfill.service');
  const doc = {
    _id: 'sale',
    tenant: 'mine',
    docType: 'order',
    orderStatus: 'confirmed',
    locked: true,
    warehouseId: 'wh',
  };
  t.mock.method(SalesOrder, 'findOne', async (q) => {
    assert.deepEqual(q, { _id: 'sale', tenant: 'mine', docType: 'order' });
    return doc;
  });
  t.mock.method(fulfill, 'fulfillOrder', async (input) => {
    assert.equal(input.tenantId, 'mine');
    assert.deepEqual(input.fulfillLines, [{ lineId: 'line', qty: 2 }]);
    return {
      order: { ...doc, orderStatus: 'fulfilled' },
      posting: { successCount: 1, failCount: 0 },
    };
  });
  t.mock.method(log, 'logActivity', async () => {});
  const res = response();
  await call(
    ctrl.fulfillSalesOrder,
    {
      params: { id: 'sale' },
      tenant: { _id: 'mine' },
      body: { items: [{ lineId: 'line', qty: 2 }] },
    },
    res,
  );
  assert.equal(res.body.data.orderStatus, 'fulfilled');
  assert.equal(res.body.data.locked, true);
});

test('a fulfilled reserved order can replay a settled delivery through the controller',async t=>{
 const doc={_id:'sale',tenant:'mine',docType:'order',reservationVersion:1,orderStatus:'fulfilled',warehouseId:'wh'};
 t.mock.method(SalesOrder,'findOne',async()=>doc);
 t.mock.method(require('../services/salesReservations'),'fulfillReservedOrder',async args=>{
  assert.equal(args.requestId,'delivery-replay');return {order:doc,duplicate:true,posting:{successCount:1,failCount:0}};
 });
 t.mock.method(log,'logActivity',async()=>{});
 const res=response();
 await call(ctrl.fulfillSalesOrder,{params:{id:'sale'},tenant:{_id:'mine'},body:{requestId:'delivery-replay',items:[{lineId:'line',qty:1}]}},res);
 assert.equal(res.body.success,true);assert.equal(res.body.data.orderStatus,'fulfilled');
});
