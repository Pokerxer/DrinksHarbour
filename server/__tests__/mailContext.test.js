// The Customer panel in the support reading pane answers one question: who is
// this sender, as a DrinksHarbour customer?
//
// Two outcomes must never be confused, which is what most of these tests are
// about. A sender we have never sold to is NORMAL and resolves to
// `customer: null` — the panel says "No customer record". A database we cannot
// reach is NOT that, and must raise: rendering "no customer record" over an
// unreachable database tells the operator the opposite of the truth about
// somebody they are one click away from replying to.
//
// The models are replaced in the require cache before the service is loaded, so
// the service under test is the real one and only the collections are fake. No
// database and no network are involved.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

// ── stub models ─────────────────────────────────────────────────────────────

/** Every query the service issues, in order. */
let queries = [];
/** Per-test fixtures. */
let fixtures = {};

/** A findOne(...).select(...).lean() chain that records its filter. */
function userQuery(filter) {
  queries.push(['user.findOne', filter]);
  const chain = {
    select() {
      return chain;
    },
    lean: async () => fixtures.user ?? null,
  };
  return chain;
}

const FakeUser = { findOne: userQuery };

const FakeOrder = {
  find(filter) {
    queries.push(['order.find', filter]);
    const chain = {
      sort() {
        return chain;
      },
      limit(n) {
        queries.push(['order.limit', n]);
        return chain;
      },
      select() {
        return chain;
      },
      lean: async () => fixtures.orders ?? [],
    };
    return chain;
  },
  async countDocuments(filter) {
    queries.push(['order.countDocuments', filter]);
    return fixtures.orderCount ?? (fixtures.orders ?? []).length;
  },
};

const userPath = require.resolve('../models/User');
const orderPath = require.resolve('../models/Order');
const stub = (path, exports) => {
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
};
stub(userPath, FakeUser);
stub(orderPath, FakeOrder);

const svc = require('../services/mailContext.service');

// ── connection state ────────────────────────────────────────────────────────

// readyState is a prototype getter on the Connection; an own property shadows
// it, which is the only way to exercise the connected path without a database.
function setConnected(connected) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: connected ? 1 : 0,
    configurable: true,
  });
}

function reset() {
  queries = [];
  fixtures = {};
  setConnected(true);
}

const TENANT = new mongoose.Types.ObjectId();
const OTHER_TENANT = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

const customerDoc = {
  _id: USER_ID,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Okonkwo',
  phone: '+2348012345678',
  role: 'customer',
  status: 'active',
  tenant: TENANT,
  createdAt: new Date('2024-03-02T10:00:00.000Z'),
  platformWalletBalance: 12500,
  walletBalance: 800,
  loyaltyPoints: 340,
  loyaltyTier: 'barrel',
};

// ── address normalisation ───────────────────────────────────────────────────

test('normalizeContextEmail lowercases and trims a bare address', () => {
  assert.strictEqual(svc.normalizeContextEmail('  Ada@Example.COM '), 'ada@example.com');
});

test('normalizeContextEmail unwraps a display-name address', () => {
  // The reading pane hands over `from.address`, but the query string is public
  // input to this endpoint and a header-shaped value must not reach a RegExp.
  assert.strictEqual(
    svc.normalizeContextEmail('Ada Okonkwo <Ada@Example.com>'),
    'ada@example.com'
  );
});

test('normalizeContextEmail refuses a missing, non-string or malformed address', () => {
  for (const bad of [undefined, null, '', '   ', 42, ['a@b.com'], { a: 1 }, 'not-an-email', 'a@b']) {
    assert.throws(() => svc.normalizeContextEmail(bad), /email address/i, `accepted ${String(bad)}`);
  }
});

test('normalizeContextEmail refuses an absurdly long address', () => {
  assert.throws(
    () => svc.normalizeContextEmail(`${'a'.repeat(250)}@example.com`),
    /not valid/i
  );
});

// ── unknown senders ─────────────────────────────────────────────────────────

test('an unknown sender resolves to a null customer, not an error', async () => {
  reset();
  const context = await svc.getCustomerContext('stranger@example.com', TENANT);
  assert.strictEqual(context.customer, null);
  assert.strictEqual(context.wallet, null);
  assert.deepStrictEqual(context.orders, []);
  assert.strictEqual(context.orderCount, 0);
  assert.strictEqual(context.email, 'stranger@example.com');
});

test('a guest checkout is still found by its shipping email with no user record', async () => {
  reset();
  fixtures.orders = [
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'DH-1001',
      placedAt: new Date('2026-01-04T09:00:00.000Z'),
      status: 'delivered',
      paymentStatus: 'paid',
      totalAmount: 48000,
      currency: 'NGN',
    },
  ];
  const context = await svc.getCustomerContext('guest@example.com', TENANT);
  assert.strictEqual(context.customer, null);
  assert.strictEqual(context.orders.length, 1);
  assert.strictEqual(context.orders[0].orderNumber, 'DH-1001');

  const find = queries.find((q) => q[0] === 'order.find');
  const clauses = JSON.stringify(find[1]);
  assert.ok(clauses.includes('shippingAddress.email'), 'guest orders were not matched by email');
});

// ── known senders ───────────────────────────────────────────────────────────

test('a known sender carries identity, wallet and a customer-since date', async () => {
  reset();
  fixtures.user = customerDoc;
  const context = await svc.getCustomerContext('ada@example.com', TENANT);

  assert.strictEqual(context.customer.name, 'Ada Okonkwo');
  assert.strictEqual(context.customer.email, 'ada@example.com');
  assert.strictEqual(context.customer.phone, '+2348012345678');
  assert.strictEqual(context.customer.customerSince, '2024-03-02T10:00:00.000Z');
  assert.strictEqual(context.wallet.platformBalance, 12500);
  assert.strictEqual(context.wallet.storeBalance, 800);
  assert.strictEqual(context.wallet.loyaltyPoints, 340);
  assert.strictEqual(context.wallet.loyaltyTier, 'barrel');
});

test('orders are mapped to number, date, status, paymentStatus and total', async () => {
  reset();
  fixtures.user = customerDoc;
  const id = new mongoose.Types.ObjectId();
  fixtures.orders = [
    {
      _id: id,
      orderNumber: 'DH-2001',
      placedAt: new Date('2026-02-11T12:30:00.000Z'),
      status: 'shipped',
      paymentStatus: 'paid',
      totalAmount: 125400,
      currency: 'NGN',
    },
  ];
  fixtures.orderCount = 9;

  const context = await svc.getCustomerContext('ada@example.com', TENANT);
  assert.deepStrictEqual(context.orders[0], {
    id: String(id),
    orderNumber: 'DH-2001',
    date: '2026-02-11T12:30:00.000Z',
    status: 'shipped',
    paymentStatus: 'paid',
    total: 125400,
    currency: 'NGN',
  });
  // The list is the five most recent; the count is the whole history, so the
  // panel can say "5 of 9" instead of implying this customer ordered five times.
  assert.strictEqual(context.orderCount, 9);
});

test('at most five recent orders are requested', async () => {
  reset();
  fixtures.user = customerDoc;
  await svc.getCustomerContext('ada@example.com', TENANT);
  assert.deepStrictEqual(
    queries.find((q) => q[0] === 'order.limit'),
    ['order.limit', 5]
  );
});

test("a known sender's orders are matched by account id as well as email", async () => {
  reset();
  fixtures.user = customerDoc;
  await svc.getCustomerContext('ada@example.com', TENANT);
  const find = queries.find((q) => q[0] === 'order.find');
  assert.ok(
    find[1].$or.some((clause) => String(clause.user) === String(USER_ID)),
    'orders placed on the account were not matched'
  );
});

// ── the contacts deep link ──────────────────────────────────────────────────

test('the contacts link is offered only for a customer of the operator’s tenant', async () => {
  reset();
  fixtures.user = customerDoc;
  const mine = await svc.getCustomerContext('ada@example.com', TENANT);
  assert.strictEqual(mine.customer.contactKey, `ecommerce:${USER_ID}`);

  reset();
  fixtures.user = customerDoc;
  // The admin Contacts directory is tenant-scoped, so the same link would
  // dead-end on a 404 for an operator of a different tenant.
  const theirs = await svc.getCustomerContext('ada@example.com', OTHER_TENANT);
  assert.strictEqual(theirs.customer.contactKey, null);
});

// ── outages ─────────────────────────────────────────────────────────────────

test('an unreachable database raises rather than reporting no customer', async () => {
  reset();
  setConnected(false);
  await assert.rejects(
    () => svc.getCustomerContext('ada@example.com', TENANT),
    (err) => err.statusCode === 503
  );
  setConnected(true);
});

// ── the role gate ───────────────────────────────────────────────────────────

test('only the roles that may read mail may read customer context', () => {
  const accounts = require('../services/mailAccount.service');
  for (const role of ['super_admin', 'admin']) {
    assert.doesNotThrow(() => accounts.assertMailReader({ role }));
  }
  for (const user of [null, undefined, {}, { role: 'tenant_owner' }, { role: 'customer' }]) {
    assert.throws(() => accounts.assertMailReader(user), /not available to you/i);
  }
});
