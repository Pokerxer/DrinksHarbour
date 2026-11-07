"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { project } = require("../services/customerShipments/projection");
function fixture() {
  const parent = {
    _id: "parent",
    user: "buyer",
    items: [
      {
        fulfillmentLineId: "line",
        tenant: "tenant",
        warehouse: "location",
        product: "product",
        subproduct: "offer",
        size: "size",
        quantity: 2,
      },
    ],
  };
  const child = {
    _id: "child",
    order: "parent",
    tenant: "tenant",
    location: "location",
    currency: "NGN",
    fulfillmentVersion: 2,
    state: "partially_shipped",
    lines: [
      {
        line: "line",
        product: "product",
        subproduct: "offer",
        size: "size",
        quantity: 2,
      },
    ],
    quantityProgress: [
      { line: "line", shipped: 1, delivered: 1, cancelled: 1 },
    ],
  };
  return {
    parent,
    children: [child],
    allocations: [],
    bookings: [],
    pickups: [],
    refunds: [],
    tenants: new Map([["tenant", { name: "Own merchant", private: "SECRET" }]]),
    products: new Map([["product", { name: "Own bottle", private: "SECRET" }]]),
  };
}
test("customer projection excludes sibling and corrupt saved original line bindings and nested evidence", () => {
  const input = fixture(),
    child = input.children[0];
  input.children.push({ ...child, _id: "other", location: "foreign" });
  input.allocations = [
    {
      _id: "own",
      merchantOrder: "child",
      order: "parent",
      tenant: "tenant",
      location: "location",
      state: "delivered",
      lines: [{ line: "line", quantity: 1, ranges: [{ private: "SECRET" }] }],
      private: "SECRET",
    },
    {
      _id: "foreign",
      merchantOrder: "child",
      order: "parent",
      tenant: "foreign",
      location: "location",
      state: "delivered",
      lines: [{ line: "line", quantity: 1 }],
    },
    {
      _id: "foreign-line",
      merchantOrder: "child",
      order: "parent",
      tenant: "tenant",
      location: "location",
      state: "delivered",
      lines: [{ line: "other", quantity: 1 }],
    },
  ];
  const view = project(input);
  assert.equal(view.groups.length, 1);
  assert.equal(view.groups[0].shipments.length, 1);
  assert.doesNotMatch(JSON.stringify(view), /SECRET|foreign|ranges/);
  input.children[0].lines[0].subproduct = "foreign-offer";
  assert.equal(project(input).groups.length, 0);
});
test("unrecognized stored lifecycle fields never become customer status payloads", () => {
  const input = fixture();
  input.children[0].state = { private: "SECRET" };
  input.bookings = [
    {
      _id: "own",
      merchantOrder: "child",
      order: "parent",
      tenant: "tenant",
      location: "location",
      state: "PRIVATE_OPERATION_STATUS",
      lines: [{ line: "line", quantity: 1 }],
    },
  ];
  const view = project(input);
  assert.equal(view.groups[0].status, "awaiting_update");
  assert.equal(view.groups[0].shipments[0].status, "awaiting_update");
  assert.doesNotMatch(JSON.stringify(view), /SECRET|PRIVATE/);
});
test("missing local booking evidence preserves the saved method without inventing progress", () => {
  const input = fixture();
  input.allocations = [{
    _id: "allocation", merchantOrder: "child", order: "parent",
    tenant: "tenant", location: "location", dispatchBooking: "saved-local-booking",
    state: "delivered", lines: [{ line: "line", quantity: 1 }],
  }];
  for (const bookings of [[], [{
    _id: "saved-local-booking", merchantOrder: "child", order: "parent",
    tenant: "foreign", location: "location", shipmentAllocation: "allocation",
    state: "delivered",
  }]]) {
    input.bookings = bookings;
    const shipment = project(input).groups[0].shipments[0];
    assert.equal(shipment.method, "local_delivery");
    assert.equal(shipment.status, "awaiting_update");
    assert.deepEqual(shipment.items, [{ line: "line", quantity: 1 }]);
  }
});
test('safe shipment projection distinguishes return intent and receipt without private recovery evidence',()=>{
 for(const state of ['returning','returned']){
  const f=fixture();f.bookings=[{_id:'own',merchantOrder:'child',order:'parent',tenant:'tenant',location:'location',lines:[{line:'line',quantity:1}],state,recoveryOperations:[{key:'private-key',reason:'private operator note'}]}];
  const view=project(f);assert.equal(view.groups[0].shipments[0].status,state);
  assert.equal(JSON.stringify(view).includes('private-key'),false);assert.equal(JSON.stringify(view).includes('private operator note'),false);
 }
});
test('customer carrier status is an own provider observation, not a goods confirmation or private provider record', () => {
  const input = fixture();
  input.allocations = [{ _id: 'allocation', merchantOrder: 'child', order: 'parent', tenant: 'tenant', location: 'location', state: 'shipped', lines: [{ line: 'line', quantity: 1 }] }];
  input.carriers = [{ _id: 'carrier', allocationId: 'allocation', merchantOrder: 'child', order: 'parent', tenant: 'tenant', location: 'location', state: 'booked', providerStatus: 'completed', account: 'PRIVATE_ACCOUNT', providerId: 'PRIVATE_ID', rate: { private: 'SECRET' } }];
  let group = project(input).groups[0];
  assert.equal(group.shipments[0].method, 'carrier');
  assert.equal(group.shipments[0].status, 'carrier_reported_delivered');
  assert.equal(group.items[0].delivered, 1, 'original goods progress remains unchanged');
  assert.doesNotMatch(JSON.stringify(group), /PRIVATE|SECRET|account|providerId/);
  input.carriers[0].tenant = 'foreign';
  group = project(input).groups[0];
  assert.equal(group.shipments[0].method, 'merchant');
  input.carriers[0].tenant = 'tenant'; input.carriers[0].state = 'uncertain';
  assert.equal(project(input).groups[0].shipments[0].status, 'awaiting_update');
});
