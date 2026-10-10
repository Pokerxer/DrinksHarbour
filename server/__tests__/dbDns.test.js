const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns').promises;
const dbPath = require.resolve('../config/db');
const originalServers = dns.getServers();
const originalSetting = process.env.NODE_DNS_SERVERS;

test.afterEach(() => {
  dns.setServers(originalServers);
  if (originalSetting === undefined) delete process.env.NODE_DNS_SERVERS;
  else process.env.NODE_DNS_SERVERS = originalSetting;
  delete require.cache[dbPath];
});

test('configured resolvers are active before the driver starts SRV/TXT lookup', () => {
  dns.setServers(['192.0.2.1']);
  process.env.NODE_DNS_SERVERS = ' 1.1.1.1, 8.8.8.8 ';
  require('../config/db');
  assert.deepEqual(dns.getServers(), ['1.1.1.1', '8.8.8.8']);
});

test('unset DNS override preserves the environment resolver', () => {
  dns.setServers(['192.0.2.1']);
  delete process.env.NODE_DNS_SERVERS;
  require('../config/db');
  assert.deepEqual(dns.getServers(), ['192.0.2.1']);
});

test('invalid DNS override fails before any connection can be attempted', () => {
  process.env.NODE_DNS_SERVERS = 'not-an-ip';
  assert.throws(() => require('../config/db'), /NODE_DNS_SERVERS/);
});
