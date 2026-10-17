const test = require('node:test'), assert = require('node:assert/strict');
const shoppingLocation = require('../middleware/shoppingLocation.middleware');
const { corsOptions } = require('../config/cors');
test('personalized request is private and CORS permits the location header', () => {
  const req = { get: () => '{"lat":0,"lon":0}' }, headers = {};
  const res = { set(k,v) { headers[k] = v; }, vary(v) { headers.Vary = v; } };
  let error;
  shoppingLocation(req,res,value => { error = value; });
  assert.equal(error, undefined);
  assert.deepEqual(req.shoppingLocation, {lat:0,lon:0});
  assert.equal(headers['Cache-Control'], 'private, no-store');
  assert.ok(corsOptions.allowedHeaders.includes('x-shopping-location'));
});
test('coordinate-free responses also vary to prevent a shared cached result masking personalization', () => {
  let vary;
  shoppingLocation({ get: () => undefined }, { vary(value) { vary = value; } }, error => { if (error) throw error; });
  assert.equal(vary, 'x-shopping-location');
});
