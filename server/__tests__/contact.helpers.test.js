// server/__tests__/contact.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  isValidEmail,
  normalizeEmail,
  normalizePhone,
  sanitizeAvatar,
  normalizePosCustomer,
  normalizeEcommerceUser,
  contactKey,
  mergePair,
  mergeContacts,
  buildInstoreFilter,
  buildEcommerceFilter,
  buildContactFilter,
  buildContactOrderMatch,
  parseOrderListQuery,
  buildOrderIndex,
  contactOrderTotals,
  summarizeSpending,
  validateContactCreate,
  validateContactUpdate,
  validateWalletTx,
  applyWalletDelta,
  summarizeWallet,
} = require('../services/contact.helpers');

const TENANT = 'tenant-1';

// ── normalisation helpers ─────────────────────────────────────────────────────

test('isValidEmail catches obviously malformed addresses', () => {
  assert.ok(isValidEmail('a@b.com'));
  assert.ok(!isValidEmail('no-at-sign'));
  assert.ok(!isValidEmail('a@b'));
  assert.ok(!isValidEmail(''));
});

test('normalizeEmail lower-cases + trims, tolerates non-strings', () => {
  assert.strictEqual(normalizeEmail('  Ada@B.COM '), 'ada@b.com');
  assert.strictEqual(normalizeEmail(undefined), '');
  assert.strictEqual(normalizeEmail(null), '');
});

test('normalizePhone strips formatting + leading +', () => {
  assert.strictEqual(normalizePhone('+234 801-234 (5)'), '2348012345');
  assert.strictEqual(normalizePhone('234.801.2345'), '2348012345');
  assert.strictEqual(normalizePhone(''), '');
  assert.strictEqual(normalizePhone(null), '');
});

test('sanitizeAvatar normalises strings, objects and empties', () => {
  assert.deepStrictEqual(sanitizeAvatar('https://cdn/x.png'), {
    url: 'https://cdn/x.png',
  });
  assert.deepStrictEqual(
    sanitizeAvatar({ url: ' https://cdn/x.png ', publicId: ' c/1 ' }),
    { url: 'https://cdn/x.png', publicId: 'c/1' }
  );
  assert.strictEqual(sanitizeAvatar(''), null);
  assert.strictEqual(sanitizeAvatar(null), null);
  assert.strictEqual(sanitizeAvatar({ publicId: 'only-id' }), null);
});

test('validateContactCreate stores a sanitised avatar', () => {
  const r = validateContactCreate(
    { firstName: 'Ada', avatar: { url: 'https://cdn/a.png', publicId: 'a' } },
    'tenant-1'
  );
  assert.ok(r.ok);
  assert.deepStrictEqual(r.value.avatar, {
    url: 'https://cdn/a.png',
    publicId: 'a',
  });
});

test('validateContactUpdate (instore) sets + clears the avatar', () => {
  assert.deepStrictEqual(
    validateContactUpdate('instore', { avatar: 'https://cdn/a.png' }).changes
      .avatar,
    { url: 'https://cdn/a.png' }
  );
  assert.strictEqual(
    validateContactUpdate('instore', { avatar: null }).changes.avatar,
    undefined
  );
});

// ── document normalisers ──────────────────────────────────────────────────────

test('normalizePosCustomer reads a stored avatar url', () => {
  const c = normalizePosCustomer({
    _id: 'p1',
    firstName: 'Ada',
    avatar: { url: 'https://cdn/a.png', publicId: 'a' },
  });
  assert.strictEqual(c.avatar, 'https://cdn/a.png');
});

test('normalizePosCustomer fills ecommerce-only defaults', () => {
  const c = normalizePosCustomer({
    _id: 'p1',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@x.com',
    phone: '0801',
    loyaltyPoints: 12,
    totalSpent: 5000,
    totalOrders: 3,
    notes: 'VIP',
    createdAt: '2026-01-01',
  });
  assert.strictEqual(c.source, 'instore');
  assert.deepStrictEqual(c.ids, { instore: 'p1' });
  assert.strictEqual(c.avatar, ''); // POSCustomer has no avatar
  assert.strictEqual(c.status, 'active'); // POSCustomer has no status
  assert.strictEqual(c.loyaltyPoints, 12);
  assert.strictEqual(c.totalSpent, 5000);
  assert.strictEqual(c.notes, 'VIP');
});

test('normalizers surface the wallet balance (default 0)', () => {
  assert.strictEqual(normalizePosCustomer({ _id: 'p1', walletBalance: 2500 }).walletBalance, 2500);
  assert.strictEqual(normalizePosCustomer({ _id: 'p1' }).walletBalance, 0);
  assert.strictEqual(normalizeEcommerceUser({ _id: 'u1', walletBalance: 700 }).walletBalance, 700);
  assert.strictEqual(normalizeEcommerceUser({ _id: 'u1' }).walletBalance, 0);
  // a 'both' contact's wallet lives on the in-store record (loyalty/notes side)
  const ins = normalizePosCustomer({ _id: 'p1', walletBalance: 1000 });
  const eco = normalizeEcommerceUser({ _id: 'u1', walletBalance: 999 });
  assert.strictEqual(mergePair(ins, eco).walletBalance, 1000);
});

test('normalizeEcommerceUser fills instore-only defaults + reads avatar url', () => {
  const c = normalizeEcommerceUser({
    _id: 'u1',
    firstName: 'Ben',
    email: 'ben@x.com',
    phone: '0802',
    avatar: { url: 'https://cdn/b.png', publicId: 'b' },
    status: 'suspended',
    createdAt: '2026-02-01',
  });
  assert.strictEqual(c.source, 'ecommerce');
  assert.deepStrictEqual(c.ids, { ecommerce: 'u1' });
  assert.strictEqual(c.avatar, 'https://cdn/b.png');
  assert.strictEqual(c.status, 'suspended');
  assert.strictEqual(c.loyaltyPoints, 0); // no loyalty on ecommerce
  assert.strictEqual(c.totalSpent, 0);
  assert.strictEqual(c.notes, '');
});

// ── routing key ───────────────────────────────────────────────────────────────

test('contactKey addresses the right model per source', () => {
  assert.strictEqual(
    contactKey({ source: 'instore', ids: { instore: 'p1' } }),
    'instore:p1'
  );
  assert.strictEqual(
    contactKey({ source: 'ecommerce', ids: { ecommerce: 'u1' } }),
    'ecommerce:u1'
  );
  // a 'both' contact is edited through its in-store record
  assert.strictEqual(
    contactKey({ source: 'both', ids: { instore: 'p1', ecommerce: 'u1' } }),
    'instore:p1'
  );
});

// ── merge rules ───────────────────────────────────────────────────────────────

test('mergePair prefers ecommerce identity and in-store loyalty/notes', () => {
  const ins = normalizePosCustomer({
    _id: 'p1',
    firstName: 'A',
    lastName: 'Instore',
    email: 'same@x.com',
    phone: '0801',
    loyaltyPoints: 10,
    totalSpent: 5000,
    totalOrders: 2,
    notes: 'POS note',
    createdAt: '2026-01-01',
  });
  const eco = normalizeEcommerceUser({
    _id: 'u1',
    firstName: 'Ada',
    lastName: 'Ecommerce',
    email: 'same@x.com',
    phone: '0801',
    avatar: { url: 'https://cdn/a.png' },
    status: 'inactive',
    createdAt: '2026-03-01',
  });
  const m = mergePair(ins, eco);
  assert.strictEqual(m.source, 'both');
  assert.deepStrictEqual(m.ids, { instore: 'p1', ecommerce: 'u1' });
  assert.strictEqual(m.firstName, 'Ada'); // ecommerce identity wins
  assert.strictEqual(m.lastName, 'Ecommerce');
  assert.strictEqual(m.status, 'inactive'); // ecommerce status wins
  assert.strictEqual(m.avatar, 'https://cdn/a.png');
  assert.strictEqual(m.loyaltyPoints, 10); // in-store loyalty kept
  assert.strictEqual(m.totalSpent, 5000);
  assert.strictEqual(m.notes, 'POS note'); // in-store notes kept
  assert.strictEqual(m.createdAt, '2026-01-01'); // earliest of the two
});

test('mergeContacts dedupes by email then phone', () => {
  const instore = [
    normalizePosCustomer({ _id: 'p1', firstName: 'Ada', email: 'ada@x.com', phone: '0801' }),
    normalizePosCustomer({ _id: 'p2', firstName: 'Phone', email: '', phone: '+234-803-1111' }),
    normalizePosCustomer({ _id: 'p3', firstName: 'Solo', email: 'solo@x.com', phone: '0900' }),
  ];
  const ecommerce = [
    normalizeEcommerceUser({ _id: 'u1', firstName: 'AdaE', email: 'ADA@x.com', phone: '0999' }),
    normalizeEcommerceUser({ _id: 'u2', firstName: 'PhoneE', email: 'p@x.com', phone: '2348031111' }),
    normalizeEcommerceUser({ _id: 'u3', firstName: 'WebOnly', email: 'web@x.com', phone: '0700' }),
  ];
  const merged = mergeContacts(instore, ecommerce);
  const by = (id) => merged.find((c) => c._id === id);

  // p1 + u1 match on email (case-insensitive)
  assert.strictEqual(by('p1').source, 'both');
  assert.deepStrictEqual(by('p1').ids, { instore: 'p1', ecommerce: 'u1' });
  // p2 + u2 match on normalised phone
  assert.strictEqual(by('p2').source, 'both');
  assert.deepStrictEqual(by('p2').ids, { instore: 'p2', ecommerce: 'u2' });
  // p3 instore-only, u3 ecommerce-only
  assert.strictEqual(by('p3').source, 'instore');
  assert.strictEqual(by('u3').source, 'ecommerce');
  // 3 in + 3 eco, two pairs merged → 4 rows total
  assert.strictEqual(merged.length, 4);
});

test('mergeContacts consumes each ecommerce match only once', () => {
  const instore = [
    normalizePosCustomer({ _id: 'p1', firstName: 'A', email: 'dup@x.com' }),
    normalizePosCustomer({ _id: 'p2', firstName: 'B', email: 'dup@x.com' }),
  ];
  const ecommerce = [normalizeEcommerceUser({ _id: 'u1', firstName: 'E', email: 'dup@x.com' })];
  const merged = mergeContacts(instore, ecommerce);
  assert.strictEqual(merged.length, 2); // not 3 — u1 consumed once
  assert.strictEqual(merged.find((c) => c._id === 'p1').source, 'both');
  assert.strictEqual(merged.find((c) => c._id === 'p2').source, 'instore');
});

test('mergeContacts ignores empty email/phone as match keys', () => {
  const instore = [normalizePosCustomer({ _id: 'p1', firstName: 'A', email: '', phone: '' })];
  const ecommerce = [normalizeEcommerceUser({ _id: 'u1', firstName: 'E', email: '', phone: '' })];
  const merged = mergeContacts(instore, ecommerce);
  assert.strictEqual(merged.length, 2); // blank keys never match
  assert.ok(merged.every((c) => c.source !== 'both'));
});

test('mergeContacts handles empty inputs', () => {
  assert.deepStrictEqual(mergeContacts([], []), []);
  assert.strictEqual(mergeContacts([], [normalizeEcommerceUser({ _id: 'u1', email: 'a@x.com' })]).length, 1);
});

// ── list filters ──────────────────────────────────────────────────────────────

test('buildInstoreFilter scopes to tenant and builds escaped search', () => {
  const f = buildInstoreFilter(TENANT, { search: 'a.b' });
  assert.strictEqual(f.tenant, TENANT);
  assert.strictEqual(f.$or.length, 4);
  assert.strictEqual(f.$or[0].firstName.source, 'a\\.b');
  assert.ok(f.$or[0].firstName.flags.includes('i'));
});

test('buildInstoreFilter is null for ecommerce-only source or non-active status', () => {
  assert.strictEqual(buildInstoreFilter(TENANT, { source: 'ecommerce' }), null);
  assert.strictEqual(buildInstoreFilter(TENANT, { status: 'suspended' }), null);
  // active status + both source still include in-store
  assert.ok(buildInstoreFilter(TENANT, { status: 'active', source: 'both' }));
});

test('buildEcommerceFilter always excludes deleted and scopes to customers', () => {
  const f = buildEcommerceFilter(TENANT);
  assert.strictEqual(f.tenant, TENANT);
  assert.strictEqual(f.role, 'customer');
  assert.deepStrictEqual(f.status, { $ne: 'deleted' });
});

test('buildEcommerceFilter applies a settable status and is null for instore-only', () => {
  assert.strictEqual(buildEcommerceFilter(TENANT, { status: 'suspended' }).status, 'suspended');
  assert.strictEqual(buildEcommerceFilter(TENANT, { source: 'instore' }), null);
});

test('buildContactFilter returns both per-store filters', () => {
  const f = buildContactFilter(TENANT, {});
  assert.ok(f.instore && f.ecommerce);
  const onlyEco = buildContactFilter(TENANT, { source: 'ecommerce' });
  assert.strictEqual(onlyEco.instore, null);
  assert.ok(onlyEco.ecommerce);
});

// ── create validation ─────────────────────────────────────────────────────────

test('validateContactCreate requires firstName', () => {
  assert.strictEqual(validateContactCreate({}, TENANT).ok, false);
  assert.strictEqual(validateContactCreate({ firstName: '  ' }, TENANT).ok, false);
});

test('validateContactCreate accepts a contact with no email but rejects a bad one', () => {
  const ok = validateContactCreate({ firstName: 'Ada', phone: ' 0801 ' }, TENANT);
  assert.ok(ok.ok);
  assert.strictEqual(ok.value.email, '');
  assert.strictEqual(ok.value.phone, '0801');
  assert.strictEqual(ok.value.tenant, TENANT);
  assert.strictEqual(validateContactCreate({ firstName: 'Ada', email: 'nope' }, TENANT).ok, false);
});

test('validateContactCreate normalises email + clamps loyalty', () => {
  const r = validateContactCreate(
    { firstName: 'Ada', email: 'ADA@X.com', loyaltyPoints: -5, totalSpent: '900' },
    TENANT
  );
  assert.ok(r.ok);
  assert.strictEqual(r.value.email, 'ada@x.com');
  assert.strictEqual(r.value.loyaltyPoints, 0);
  assert.strictEqual(r.value.totalSpent, 900);
});

// ── update validation ─────────────────────────────────────────────────────────

test('validateContactUpdate (ecommerce) accepts only a settable status', () => {
  assert.deepStrictEqual(validateContactUpdate('ecommerce', { status: 'inactive' }).changes, {
    status: 'inactive',
  });
  // status omitted → no-op
  assert.deepStrictEqual(validateContactUpdate('ecommerce', { firstName: 'X' }).changes, {});
  // 'deleted' is never settable
  assert.strictEqual(validateContactUpdate('ecommerce', { status: 'deleted' }).ok, false);
  assert.strictEqual(validateContactUpdate('ecommerce', { status: 'bogus' }).ok, false);
});

test('validateContactUpdate (instore) edits every field but guards empties', () => {
  const r = validateContactUpdate('instore', {
    firstName: ' Ada ',
    lastName: ' Obi ',
    email: 'NEW@X.com',
    phone: ' 0801 ',
    notes: ' hi ',
    loyaltyPoints: 7,
  });
  assert.ok(r.ok);
  assert.deepStrictEqual(r.changes, {
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'new@x.com',
    phone: '0801',
    notes: 'hi',
    loyaltyPoints: 7,
  });
  assert.strictEqual(validateContactUpdate('instore', { firstName: '' }).ok, false);
  assert.strictEqual(validateContactUpdate('instore', { email: 'nope' }).ok, false);
});

test('validateContactUpdate (instore) allows clearing email + phone', () => {
  const r = validateContactUpdate('instore', { email: '', phone: '' });
  assert.ok(r.ok);
  assert.strictEqual(r.changes.email, '');
  assert.strictEqual(r.changes.phone, '');
});

// ── order matching ────────────────────────────────────────────────────────────

test('buildContactOrderMatch matches a both-contact across user, POS id, email + phone', () => {
  const or = buildContactOrderMatch({
    ids: { instore: 'p1', ecommerce: 'u1' },
    email: 'Ada@X.com',
    phone: ' 0801 ',
  });
  // user + POS customerId + email + (shipping phone, POS phone)
  assert.strictEqual(or.length, 5);
  assert.deepStrictEqual(or[0], { user: 'u1' });
  assert.deepStrictEqual(or[1], { 'paymentDetails.customer.customerId': 'p1' });
  // email is matched case-insensitively + anchored
  assert.ok(or[2]['shippingAddress.email'] instanceof RegExp);
  assert.strictEqual(or[2]['shippingAddress.email'].source, '^ada@x\\.com$');
  assert.ok(or[2]['shippingAddress.email'].flags.includes('i'));
  // phone is trimmed and matched on both stores
  assert.deepStrictEqual(or[3], { 'shippingAddress.phone': '0801' });
  assert.deepStrictEqual(or[4], { 'paymentDetails.customer.phone': '0801' });
});

test('buildContactOrderMatch returns [] for an identity-less contact', () => {
  assert.deepStrictEqual(buildContactOrderMatch({ ids: {} }), []);
  assert.deepStrictEqual(buildContactOrderMatch({}), []);
});

test('parseOrderListQuery validates status, builds an inclusive date range, clamps paging', () => {
  const r = parseOrderListQuery({
    status: 'delivered',
    from: '2026-01-01',
    to: '2026-01-31',
    page: '3',
    limit: '25',
  });
  assert.strictEqual(r.match.status, 'delivered');
  assert.ok(r.match.placedAt.$gte instanceof Date);
  assert.ok(r.match.placedAt.$lte instanceof Date);
  // `to` is pushed to the end of its day so the whole day is included
  assert.strictEqual(r.match.placedAt.$lte.getHours(), 23);
  assert.strictEqual(r.page, 3);
  assert.strictEqual(r.limit, 25);
  assert.strictEqual(r.skip, 50);
});

test('parseOrderListQuery ignores a bogus status + clamps limit to 1..100, page to >=1', () => {
  assert.strictEqual(parseOrderListQuery({ status: 'bogus' }).match.status, undefined);
  assert.strictEqual(parseOrderListQuery({ limit: '999' }).limit, 100);
  assert.strictEqual(parseOrderListQuery({ limit: '-5' }).limit, 1); // clamped up to 1
  assert.strictEqual(parseOrderListQuery({ limit: '0' }).limit, 20); // 0 → falsy → default
  assert.strictEqual(parseOrderListQuery({ page: '-2' }).page, 1);
  const def = parseOrderListQuery({});
  assert.strictEqual(def.page, 1);
  assert.strictEqual(def.limit, 20);
  assert.deepStrictEqual(def.match, {});
});

// ── order index + per-contact totals ──────────────────────────────────────────

const ORDERS = [
  { _id: 'o1', user: 'u1', totalAmount: 1000 },                                    // ecommerce account
  { _id: 'o2', shippingAddress: { email: 'ADA@x.com', phone: '0801' }, totalAmount: 500 }, // guest, same person as u1/ada
  { _id: 'o3', paymentDetails: { customer: { customerId: 'p1', phone: '0801' } }, totalAmount: 250 }, // POS named customer
  { _id: 'o4', paymentDetails: { customer: { phone: '0900' } }, totalAmount: 80 }, // POS walk-in, other phone
];

test('buildOrderIndex buckets each order under every identity key it carries', () => {
  const idx = buildOrderIndex(ORDERS);
  assert.strictEqual(idx.amount.get('o1'), 1000);
  assert.deepStrictEqual([...idx.byUser.get('u1')], ['o1']);
  assert.deepStrictEqual([...idx.byCustomerId.get('p1')], ['o3']);
  assert.deepStrictEqual([...idx.byEmail.get('ada@x.com')], ['o2']);
  // both o2 (shipping) and o3 (POS) carry phone 0801
  assert.deepStrictEqual([...idx.byPhone.get('0801')].sort(), ['o2', 'o3']);
});

test('contactOrderTotals counts each matching order once across all keys', () => {
  const idx = buildOrderIndex(ORDERS);
  // a "both" contact owning u1 + p1 + ada@x.com + 0801 matches o1,o2,o3 (not o4)
  const totals = contactOrderTotals(
    { ids: { instore: 'p1', ecommerce: 'u1' }, email: 'ada@x.com', phone: '0801' },
    idx
  );
  assert.strictEqual(totals.totalOrders, 3);
  assert.strictEqual(totals.totalSpent, 1750);
});

// ── spending summary ──────────────────────────────────────────────────────────

const SPEND_ORDERS = [
  {
    totalAmount: 1000, status: 'delivered', paymentMethod: 'card',
    placedAt: '2026-01-15',
    items: [
      { product: { name: 'Whisky' }, quantity: 2, itemSubtotal: 800 },
      { product: { name: 'Gin' }, quantity: 1, itemSubtotal: 200 },
    ],
  },
  {
    totalAmount: 500, status: 'delivered', paymentMethod: 'cash',
    placedAt: '2026-01-20',
    items: [{ product: { name: 'Whisky' }, quantity: 1, itemSubtotal: 500 }],
  },
  {
    totalAmount: 300, status: 'cancelled', paymentMethod: 'card',
    placedAt: '2026-02-02',
    items: [{ subproduct: { name: 'House Lager' }, quantity: 3, itemSubtotal: 300 }],
  },
];

test('summarizeSpending rolls up totals, average and first/last dates', () => {
  const s = summarizeSpending(SPEND_ORDERS);
  assert.strictEqual(s.totalSpent, 1800);
  assert.strictEqual(s.orderCount, 3);
  assert.strictEqual(s.avgOrderValue, 600);
  assert.strictEqual(s.firstOrderAt, new Date('2026-01-15').toISOString());
  assert.strictEqual(s.lastOrderAt, new Date('2026-02-02').toISOString());
});

test('summarizeSpending buckets by month, method, status and top products', () => {
  const s = summarizeSpending(SPEND_ORDERS);

  // months ascending
  assert.deepStrictEqual(s.byMonth.map((m) => m.month), ['2026-01', '2026-02']);
  assert.strictEqual(s.byMonth[0].total, 1500); // Jan: 1000 + 500
  assert.strictEqual(s.byMonth[0].count, 2);

  // payment methods sorted by total desc (card 1300 > cash 500)
  assert.deepStrictEqual(s.byPaymentMethod[0], { method: 'card', total: 1300, count: 2 });
  assert.deepStrictEqual(s.byPaymentMethod[1], { method: 'cash', total: 500, count: 1 });

  // status buckets
  const delivered = s.byStatus.find((x) => x.status === 'delivered');
  assert.strictEqual(delivered.count, 2);

  // top product by spend is Whisky (800 + 500 = 1300, 3 units)
  assert.deepStrictEqual(s.topProducts[0], { name: 'Whisky', quantity: 3, total: 1300 });
  // subproduct name is used when no central product
  assert.ok(s.topProducts.some((p) => p.name === 'House Lager'));
});

test('summarizeSpending handles empty input + falls back to createdAt + item names', () => {
  const empty = summarizeSpending([]);
  assert.strictEqual(empty.totalSpent, 0);
  assert.strictEqual(empty.avgOrderValue, 0);
  assert.strictEqual(empty.firstOrderAt, null);
  assert.deepStrictEqual(empty.byMonth, []);

  const s = summarizeSpending([
    { totalAmount: 50, createdAt: '2026-03-01', items: [{ quantity: 1, itemSubtotal: 50 }] },
  ]);
  assert.strictEqual(s.byMonth[0].month, '2026-03'); // createdAt used when no placedAt
  assert.strictEqual(s.topProducts[0].name, 'Unknown item'); // nameless item
  assert.strictEqual(s.byPaymentMethod[0].method, 'unknown'); // missing method
});

test('contactOrderTotals is zero for an unmatched / index-less contact', () => {
  const idx = buildOrderIndex(ORDERS);
  assert.deepStrictEqual(
    contactOrderTotals({ ids: { ecommerce: 'nobody' }, email: '', phone: '' }, idx),
    { totalOrders: 0, totalSpent: 0 }
  );
  assert.deepStrictEqual(
    contactOrderTotals({ ids: { ecommerce: 'u1' } }, null),
    { totalOrders: 0, totalSpent: 0 }
  );
});

// ── wallet: tx validation ──────────────────────────────────────────────────────

test('validateWalletTx accepts an allowed type + positive integer amount', () => {
  const r = validateWalletTx({ type: 'credit', amount: 5000, reason: ' Top up ' });
  assert.ok(r.ok);
  assert.deepStrictEqual(r.value, { type: 'credit', amount: 5000, reason: 'Top up' });
  // numeric-string amounts coerce; reason is optional
  const s = validateWalletTx({ type: 'debit', amount: '250' });
  assert.ok(s.ok);
  assert.strictEqual(s.value.amount, 250);
  assert.strictEqual(s.value.reason, '');
});

test('validateWalletTx rejects bad types and non-positive / non-integer amounts', () => {
  assert.strictEqual(validateWalletTx({ type: 'bogus', amount: 100 }).ok, false);
  assert.strictEqual(validateWalletTx({ type: 'credit', amount: 0 }).ok, false);
  assert.strictEqual(validateWalletTx({ type: 'credit', amount: -50 }).ok, false);
  assert.strictEqual(validateWalletTx({ type: 'credit', amount: 12.5 }).ok, false);
  assert.strictEqual(validateWalletTx({ type: 'credit', amount: 'abc' }).ok, false);
  assert.strictEqual(validateWalletTx({ amount: 100 }).ok, false); // missing type
});

test('validateWalletTx caps an over-long reason', () => {
  const long = 'x'.repeat(300);
  assert.strictEqual(validateWalletTx({ type: 'credit', amount: 10, reason: long }).ok, false);
});

// ── wallet: balance delta ──────────────────────────────────────────────────────

test('applyWalletDelta credits add and debits subtract', () => {
  assert.deepStrictEqual(applyWalletDelta(1000, 'credit', 500), { ok: true, balanceAfter: 1500 });
  assert.deepStrictEqual(applyWalletDelta(1000, 'refund', 200), { ok: true, balanceAfter: 1200 });
  assert.deepStrictEqual(applyWalletDelta(1000, 'adjustment', 200), { ok: true, balanceAfter: 1200 });
  assert.deepStrictEqual(applyWalletDelta(1000, 'debit', 400), { ok: true, balanceAfter: 600 });
  // a debit to exactly zero is allowed
  assert.deepStrictEqual(applyWalletDelta(400, 'debit', 400), { ok: true, balanceAfter: 0 });
});

test('applyWalletDelta refuses a debit that would overdraw', () => {
  const r = applyWalletDelta(300, 'debit', 400);
  assert.strictEqual(r.ok, false);
  assert.ok(/insufficient/i.test(r.message));
});

test('applyWalletDelta treats a missing balance as zero and validates the amount', () => {
  assert.deepStrictEqual(applyWalletDelta(undefined, 'credit', 100), { ok: true, balanceAfter: 100 });
  assert.strictEqual(applyWalletDelta(100, 'credit', 0).ok, false);
  assert.strictEqual(applyWalletDelta(100, 'debit', -5).ok, false);
});

// ── wallet: ledger summary ─────────────────────────────────────────────────────

const WALLET_TX = [
  { type: 'credit', amount: 5000, createdAt: '2026-01-10' },
  { type: 'debit', amount: 1500, createdAt: '2026-02-01' },
  { type: 'refund', amount: 1000, createdAt: '2026-01-20' },
  { type: 'adjustment', amount: 200, createdAt: '2026-01-05' },
];

test('summarizeWallet totals credits vs debits, net and last activity', () => {
  const s = summarizeWallet(WALLET_TX);
  assert.strictEqual(s.credited, 6200); // credit 5000 + refund 1000 + adjustment 200
  assert.strictEqual(s.debited, 1500);
  assert.strictEqual(s.net, 4700);
  assert.strictEqual(s.count, 4);
  assert.strictEqual(s.lastActivityAt, new Date('2026-02-01').toISOString());
});

test('summarizeWallet handles an empty ledger', () => {
  assert.deepStrictEqual(summarizeWallet([]), {
    credited: 0,
    debited: 0,
    net: 0,
    count: 0,
    lastActivityAt: null,
  });
});
