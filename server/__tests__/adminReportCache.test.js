const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminReportCache } = require('../services/adminReportCache');
function fixture() {
  const rows = new Map();
  const ttls = [];
  const client = {
    mGet: async keys => keys.map(k => rows.get(k) ?? null),
    eval: async (_script, { keys, arguments: args }) => {
      if ((rows.get(keys[0]) || '0') !== args[0] || (rows.get(keys[1]) || '0') !== args[1]) return 0;
      rows.set(keys[2], args[2]); ttls.push(Number(args[3])); return 1;
    },
    multi() {
      const writes = [];
      return { set(k, v, options) { writes.push([k, v, options]); return this; }, async exec() { for (const [k, v, options] of writes) { rows.set(k, v); ttls.push(options.EX); } } };
    },
  };
  const run = async fn => fn(client);
  return { rows, ttls, run, cache: createAdminReportCache({ run, isEnabled: () => true }) };
}
const context = (tenant = 'A', user = 'user-1', query = {}) => ({ scope: `tenant:${tenant}`, principal: { user, role: 'tenant_admin', tenant }, resource: 'dashboard', query });
const result = data => ({ status: 200, body: { success: true, data } });

test('a second instance shares the cached report without another loader', async () => {
  const { cache, run, ttls } = fixture(); let reads = 0;
  const load = async () => { reads++; return result({ revenue: 10 }); };
  const first = await cache.read(context(), load);
  const second = await createAdminReportCache({ run, isEnabled: () => true }).read(context(), load);
  assert.deepEqual(second, first); assert.equal(reads, 1); assert.equal(ttls[0], 30);
});
test('tenants, users, filters and permissions do not share reports', async () => {
  const { cache } = fixture(); let reads = 0;
  const load = async () => result(++reads);
  await cache.read(context(), load);
  await cache.read(context('B'), load);
  await cache.read(context('A', 'user-2'), load);
  await cache.read(context('A', 'user-1', { period: 'year' }), load);
  const changed = context(); changed.principal.permissions = ['limited'];
  await cache.read(changed, load);
  assert.equal(reads, 5);
});
test('query parameter ordering reuses the same filtered report', async () => {
  const { cache } = fixture(); let reads = 0;
  const load = async () => result(++reads);
  await cache.read(context('A', 'user-1', { from: 'a', to: 'b' }), load);
  await cache.read(context('A', 'user-1', { to: 'b', from: 'a' }), load);
  assert.equal(reads, 1);
});
test('invalidation and fresh requests force an authoritative reload', async () => {
  const { cache } = fixture(); let reads = 0;
  const load = async () => result(++reads);
  await cache.read(context(), load);
  await cache.invalidate(['tenant:A']);
  assert.equal((await cache.read(context(), load)).body.data, 2);
  assert.equal((await cache.read(context(), load, { fresh: true })).body.data, 3);
});
test('a fill that races a mutation cannot republish its stale generation', async () => {
  const { cache } = fixture(); let release; let started;
  const loading = new Promise(resolve => { started = resolve; });
  const first = cache.read(context(), () => { started(); return new Promise(resolve => { release = resolve; }); });
  await loading;
  await cache.invalidate(['tenant:A']);
  release(result('old')); await first;
  assert.equal((await cache.read(context(), async () => result('new'))).body.data, 'new');
});
test('failed, oversized and corrupt entries never replace a live response', async () => {
  const { cache, rows } = fixture(); let reads = 0;
  const failure = async () => { reads++; return { status: 403, body: { success: false } }; };
  await cache.read(context(), failure); await cache.read(context(), failure); assert.equal(reads, 2);
  const large = result('x'.repeat(100001));
  await cache.read(context(), async () => large); assert.equal(rows.size, 0);
  await cache.read(context(), async () => result('ok'));
  for (const key of rows.keys()) rows.set(key, '{bad');
  assert.equal((await cache.read(context(), async () => result('live'))).body.data, 'live');
});
test('Redis absence/outage uses the original loader', async () => {
  const noRedis = createAdminReportCache({ isEnabled: () => false });
  assert.deepEqual(await noRedis.read(context(), async () => result('live')), result('live'));
  const outage = createAdminReportCache({ isEnabled: () => true, run: async () => { throw new Error('unavailable'); } });
  assert.deepEqual(await outage.read(context(), async () => result('live')), result('live'));
});
