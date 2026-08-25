const test = require('node:test');
const assert = require('node:assert/strict');

const { VENUE_BUSINESS_TYPES } = require('../services/posVenue.service');

test('venue business types match the spec list exactly', () => {
  // Guards against someone editing the list without re-deciding Hotel.
  assert.deepEqual(VENUE_BUSINESS_TYPES, ['Restaurant', 'Bar / Lounge', 'Nightclub / Club']);
});

const { isVenueBusinessType } = require('../services/posVenue.service');

test('isVenueBusinessType recognises venues and rejects Hotel/resellers', () => {
  for (const t of ['Restaurant', 'Bar / Lounge', 'Nightclub / Club']) {
    assert.equal(isVenueBusinessType(t), true, t);
  }
  assert.equal(isVenueBusinessType('Hotel'), false);
  assert.equal(isVenueBusinessType('Liquor Store'), false);
  assert.equal(isVenueBusinessType(undefined), false);
});

const { venueBlocked } = require('../services/posVenue.service');

function fakeRes() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

test('venueBlocked sends 400 when flag off, passes when on', () => {
  const off = fakeRes();
  assert.equal(venueBlocked({ tenant: {} }, off), true);
  assert.equal(off.code, 400);
  assert.equal(off.body.message, 'venue mode disabled');

  const on = fakeRes();
  assert.equal(
    venueBlocked({ tenant: { posSettings: { isBarRestaurant: true } } }, on),
    false
  );
  assert.equal(on.code, null);
});
