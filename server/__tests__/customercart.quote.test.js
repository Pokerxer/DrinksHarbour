// server/__tests__/customercart.quote.test.js
//
// getCustomerCartForQuote bridges a tenant's POSCustomer to the marketplace
// User/Cart by email (fallback: phone) — there is no link field between the
// two records — and filters the cart down to lines this tenant actually
// sells (SubProduct.tenant === tenantId). Mirrors this repo's convention of
// stubbing Mongoose model static methods directly (see
// adminReviewCrossTenantListing.test.js) rather than booting a real DB.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const POSCustomer = require('../models/POSCustomer');
const User = require('../models/User');
const Cart = require('../models/Cart');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const svc = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

/** Build a chainable stub that resolves to `doc` from `.lean()` (with or
 *  without an intervening `.select()`/`.populate()`). */
function leanStub(doc) {
  const chain = {
    select() { return chain; },
    populate() { return chain; },
    lean: async () => doc,
  };
  return chain;
}

function stubModels({
  posCustomer,
  marketplaceUser,
  cart,
  subProducts = [],
  sizes = [],
} = {}) {
  const originals = {
    posCustomerFindOne: POSCustomer.findOne,
    userFindOne: User.findOne,
    userFind: User.find,
    cartFindOne: Cart.findOne,
    subProductFind: SubProduct.find,
    sizeFind: Size.find,
  };

  POSCustomer.findOne = () => leanStub(posCustomer ?? null);

  const userCalls = [];
  User.findOne = (filter) => {
    userCalls.push(filter);
    // Email lookup first, then phone — resolve whichever field matches.
    if (filter.email && marketplaceUser?.email === filter.email) {
      return leanStub(marketplaceUser);
    }
    if (filter.phone && marketplaceUser?.phone === filter.phone) {
      return leanStub(marketplaceUser);
    }
    return leanStub(null);
  };

  // Name fallback: match the seeded user when first+last both match.
  User.find = (filter) => {
    if (
      marketplaceUser &&
      filter?.firstName?.test?.(marketplaceUser.firstName || '') &&
      filter?.lastName?.test?.(marketplaceUser.lastName || '')
    ) {
      return leanStub([marketplaceUser]);
    }
    return leanStub([]);
  };

  const cartCalls = [];
  Cart.findOne = (filter) => {
    cartCalls.push(filter);
    return leanStub(cart ?? null);
  };
  SubProduct.find = () => leanStub(subProducts);
  Size.find = () => leanStub(sizes);

  return {
    userCalls,
    cartCalls,
    restore: () => {
      POSCustomer.findOne = originals.posCustomerFindOne;
      User.findOne = originals.userFindOne;
      User.find = originals.userFind;
      Cart.findOne = originals.cartFindOne;
      SubProduct.find = originals.subProductFind;
      Size.find = originals.sizeFind;
    },
  };
}

test('no POSCustomer in this tenant -> found: false, not-found', async () => {
  const { restore } = stubModels({ posCustomer: null });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: oid(),
    });
    assert.strictEqual(res.found, false);
    assert.strictEqual(res.matchBy, 'not-found');
    assert.strictEqual(res.items.length, 0);
    assert.strictEqual(res.cartCount, 0);
  } finally {
    restore();
  }
});

test('POSCustomer email matches no marketplace User -> found: false', async () => {
  const posCustomer = { _id: oid(), email: 'ghost@example.com', phone: '' };
  const { restore } = stubModels({ posCustomer, marketplaceUser: null });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, false);
    assert.strictEqual(res.matchBy, 'not-found');
  } finally {
    restore();
  }
});

test('matches marketplace User by email', async () => {
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const { restore, userCalls } = stubModels({
    posCustomer,
    marketplaceUser,
    cart: null,
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.matchBy, 'email');
    assert.strictEqual(res.user.email, 'jane@example.com');
    assert.strictEqual(res.user.name, 'Jane Doe');
    assert.strictEqual(res.cartCount, 0);
    assert.strictEqual(res.items.length, 0);
    // Email was tried before phone.
    assert.ok(userCalls[0].email, 'first lookup was by email');
  } finally {
    restore();
  }
});

test('falls back to phone when email is absent or does not match', async () => {
  const posCustomer = { _id: oid(), email: '', phone: '+2348012345678' };
  const marketplaceUser = {
    _id: oid(),
    email: 'other@example.com',
    phone: '+2348012345678',
    firstName: 'Kelly',
    lastName: 'Oruma',
  };
  const { restore } = stubModels({ posCustomer, marketplaceUser, cart: null });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.matchBy, 'phone');
  } finally {
    restore();
  }
});

test('empty active cart -> found true, zero items', async () => {
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart: { items: [], status: 'active' },
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.cartCount, 0);
    assert.deepStrictEqual(res.items, []);
    assert.strictEqual(res.skippedCount, 0);
  } finally {
    restore();
  }
});

test('cart lines from another tenant are excluded and counted as skipped', async () => {
  const tenantId = oid();
  const otherTenantId = oid();
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };

  const mySub = {
    _id: oid(),
    tenant: tenantId,
    product: { _id: oid(), name: 'Hennessy VS' },
    sku: 'HEN-VS-01',
  };
  const otherSub = {
    _id: oid(),
    tenant: otherTenantId,
    product: { _id: oid(), name: 'Moet Ice' },
    sku: 'MOET-ICE-01',
  };
  const sizeId = oid();
  const otherSizeId = oid();

  const cart = {
    status: 'active',
    items: [
      {
        subproduct: mySub._id,
        product: mySub.product._id,
        size: sizeId,
        quantity: 3,
        priceAtAddition: 45000,
      },
      {
        subproduct: otherSub._id,
        product: otherSub.product._id,
        size: otherSizeId,
        quantity: 1,
        priceAtAddition: 32000,
      },
    ],
  };

  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart,
    subProducts: [mySub, otherSub],
    sizes: [
      { _id: sizeId, size: '75cl' },
      { _id: otherSizeId, size: '20cl' },
    ],
  });

  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.cartCount, 2);
    assert.strictEqual(res.items.length, 1, 'only this tenant\'s line is returned');
    assert.strictEqual(res.skippedCount, 1);
    const [item] = res.items;
    assert.strictEqual(String(item.subProductId), String(mySub._id));
    assert.strictEqual(item.name, 'Hennessy VS');
    assert.strictEqual(item.sku, 'HEN-VS-01');
    assert.strictEqual(item.sizeName, '75cl');
    assert.strictEqual(item.quantity, 3);
    assert.strictEqual(item.marketplaceUnitPrice, 45000);
  } finally {
    restore();
  }
});

test('cart line whose subproduct no longer resolves is counted as skipped', async () => {
  const tenantId = oid();
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const cart = {
    status: 'active',
    items: [
      {
        subproduct: oid(), // not present in the resolved subProducts list
        product: oid(),
        size: oid(),
        quantity: 2,
        priceAtAddition: 9000,
      },
    ],
  };
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart,
    subProducts: [],
    sizes: [],
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.cartCount, 1);
    assert.strictEqual(res.items.length, 0);
    assert.strictEqual(res.skippedCount, 1);
  } finally {
    restore();
  }
});

test('tenantCount + skippedCount always equals cartCount', async () => {
  const tenantId = oid();
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const mySub = { _id: oid(), tenant: tenantId, product: { _id: oid(), name: 'A' }, sku: 'A' };
  const otherSub = { _id: oid(), tenant: oid(), product: { _id: oid(), name: 'B' }, sku: 'B' };
  const cart = {
    status: 'active',
    items: [
      { subproduct: mySub._id, product: mySub.product._id, size: oid(), quantity: 1, priceAtAddition: 1000 },
      { subproduct: otherSub._id, product: otherSub.product._id, size: oid(), quantity: 1, priceAtAddition: 2000 },
      { subproduct: oid(), product: oid(), size: oid(), quantity: 1, priceAtAddition: 3000 }, // unresolved
    ],
  };
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart,
    subProducts: [mySub, otherSub],
    sizes: [],
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.items.length + res.skippedCount, res.cartCount);
  } finally {
    restore();
  }
});

test('a malformed POSCustomer id is a miss, not a thrown CastError', async () => {
  // The route takes `?customer=` straight off the query string. Without the
  // ObjectId guard, Mongoose throws a CastError that asyncHandler turns into a
  // 500 — the modal would show "Failed to load cart" instead of "no match".
  const { restore } = stubModels({
    posCustomer: { _id: oid(), email: 'jane@example.com', phone: '' },
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: 'not-an-object-id',
    });
    assert.strictEqual(res.found, false);
    assert.strictEqual(res.matchBy, 'not-found');
    assert.strictEqual(res.items.length, 0);
  } finally {
    restore();
  }
});

test('the cart lookup is not scoped to status:active', async () => {
  // cart.service.js reads the storefront cart as Cart.findOne({ user }) with no
  // status filter, and the schema is one-cart-per-user. If this endpoint added
  // status:'active' the two would disagree the moment anything starts marking
  // carts abandoned/expired: the storefront would still show the items while
  // staff got "cart is empty".
  const tenantId = oid();
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const sub = {
    _id: oid(),
    tenant: tenantId,
    product: { _id: oid(), name: 'Jameson' },
    sku: 'JAM-01',
  };
  const sizeId = oid();
  const { restore, cartCalls } = stubModels({
    posCustomer,
    marketplaceUser,
    // An abandoned cart still yields its lines.
    cart: {
      status: 'abandoned',
      items: [
        {
          subproduct: sub._id,
          product: sub.product._id,
          size: sizeId,
          quantity: 2,
          priceAtAddition: 21000,
        },
      ],
    },
    subProducts: [sub],
    sizes: [{ _id: sizeId, size: '70cl' }],
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(cartCalls.length, 1);
    assert.ok(
      !('status' in cartCalls[0]),
      'Cart.findOne must not filter on status'
    );
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].quantity, 2);
  } finally {
    restore();
  }
});

test('the subproduct tax rate travels with the imported line', async () => {
  // sales-catalog-modal.tsx / sales-scan-drawer.tsx both seed the line's
  // taxRate from the subproduct. If this endpoint omits it, the import path
  // seeds 0 and the same product quotes VAT-free purely because of how it was
  // added — and the server persists that, since mapLine trusts the payload.
  const tenantId = oid();
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const sub = {
    _id: oid(),
    tenant: tenantId,
    product: { _id: oid(), name: 'Glenfiddich 12' },
    sku: 'GLEN-12',
    taxRate: 7.5,
  };
  const sizeId = oid();
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart: {
      items: [
        {
          subproduct: sub._id,
          product: sub.product._id,
          size: sizeId,
          quantity: 1,
          priceAtAddition: 68000,
        },
      ],
    },
    subProducts: [sub],
    sizes: [{ _id: sizeId, size: '70cl' }],
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.items[0].taxRate, 7.5);
  } finally {
    restore();
  }
});

test('a subproduct with no taxRate yields 0, never undefined', async () => {
  const tenantId = oid();
  const posCustomer = { _id: oid(), email: 'jane@example.com', phone: '' };
  const marketplaceUser = {
    _id: oid(),
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };
  const sub = {
    _id: oid(),
    tenant: tenantId,
    product: { _id: oid(), name: 'Star Lager' },
    sku: 'STAR-60',
  };
  const sizeId = oid();
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart: {
      items: [
        {
          subproduct: sub._id,
          product: sub.product._id,
          size: sizeId,
          quantity: 4,
          priceAtAddition: 1200,
        },
      ],
    },
    subProducts: [sub],
    sizes: [{ _id: sizeId, size: '60cl' }],
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.items[0].taxRate, 0);
  } finally {
    restore();
  }
});

test('falls back to name when POSCustomer has no email/phone', async () => {
  const tenantId = oid();
  const posCustomer = {
    _id: oid(),
    email: '',
    phone: '',
    firstName: 'Jordan',
    lastName: 'Waldehz',
  };
  const marketplaceUser = {
    _id: oid(),
    email: 'jordanwaldehz@test.com',
    firstName: 'Jordan',
    lastName: 'Waldehz',
  };
  const updateOneCalls = [];
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser,
    cart: { status: 'active', items: [] },
    subProducts: [],
    sizes: [],
  });
  // Also mock POSCustomer.updateOne to verify backfill.
  const origUpdateOne = POSCustomer.updateOne;
  POSCustomer.updateOne = async (filter, update) => {
    updateOneCalls.push({ filter, update });
    return { modifiedCount: 1 };
  };
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId,
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.matchBy, 'name');
    assert.strictEqual(res.user.email, 'jordanwaldehz@test.com');
    // Email backfill should have been attempted.
    assert.strictEqual(updateOneCalls.length, 1);
    assert.strictEqual(
      updateOneCalls[0].update.$set.email,
      'jordanwaldehz@test.com'
    );
  } finally {
    POSCustomer.updateOne = origUpdateOne;
    restore();
  }
});

test('does NOT match by name when multiple candidates share the same name', async () => {
  const posCustomer = {
    _id: oid(),
    email: '',
    phone: '',
    firstName: 'John',
    lastName: 'Doe',
  };
  const { restore } = stubModels({
    posCustomer,
    marketplaceUser: null, // will not be used — name search returns 2
    cart: null,
    subProducts: [],
    sizes: [],
  });
  // Override User.find to return 2 candidates with the same name.
  const origFind = User.find;
  User.find = () => ({
    lean: async () => [
      { _id: oid(), firstName: 'John', lastName: 'Doe', email: 'a@test.com' },
      { _id: oid(), firstName: 'John', lastName: 'Doe', email: 'b@test.com' },
    ],
  });
  try {
    const res = await svc.getCustomerCartForQuote({
      tenantId: oid(),
      posCustomerId: posCustomer._id,
    });
    assert.strictEqual(res.found, false);
    assert.strictEqual(res.matchBy, 'not-found');
  } finally {
    User.find = origFind;
    restore();
  }
});
