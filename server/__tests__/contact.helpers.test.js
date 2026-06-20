// server/__tests__/contact.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  isValidEmail,
  normalizeEmail,
  normalizePhone,
  normalizePosCustomer,
  normalizeEcommerceUser,
  contactKey,
  mergePair,
  mergeContacts,
  buildInstoreFilter,
  buildEcommerceFilter,
  buildContactFilter,
  validateContactCreate,
  validateContactUpdate,
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

// ── document normalisers ──────────────────────────────────────────────────────

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
