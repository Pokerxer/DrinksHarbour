import { afterEach, expect, test, vi } from 'vitest';
import {
  advancePreparationItem,
  createServiceSession,
  createStation,
  fireCourse,
  getSessionPreparation,
  getStations,
  getOpenVisitSnapshot,
  holdCourse,
  listPrintJobs,
  registerDeviceBridge,
  reprintPrintJob,
  revokeDeviceBridge,
  setCourses,
  updatePreset,
  updateStation,
} from './ops';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Fetcher contracts mirror the S3 venue-ops routes EXACTLY — path, method, body. */
async function capture(method: string, run: () => Promise<unknown>) {
  const fetcher = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: { ok: true } }) }));
  vi.stubGlobal('fetch', fetcher);
  await run();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toContain('/api/venue-ops');
  expect((options as RequestInit).method).toBe(method);
  return { url: String(url).replace(/^.*\/api\/venue-ops/, ''), options: options as RequestInit };
}

test('station config routes match the S3 batch-2 pattern', async () => {
  const get = await capture('GET', () => getStations('t', 'loc'));
  expect(get.url).toBe('/locations/loc/stations');
  const post = await capture('POST', () => createStation('t', 'loc', { name: 'Grill', categories: ['grill'], staffIds: [], deviceIds: [], alertThresholdMins: 15, isDefault: false }));
  expect(post.url).toBe('/locations/loc/stations');
  expect((JSON.parse(post.options.body as string) as { input: { name: string } }).input.name).toBe('Grill');
  expect((post.options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  const patch = await capture('PATCH', () => updateStation('t', 'loc', 'st1', { expectedVersion: 2, input: { name: 'Grill', categories: [], staffIds: [], deviceIds: [], alertThresholdMins: 15, isDefault: true } }));
  expect(patch.url).toBe('/locations/loc/stations/st1');
  expect((JSON.parse(patch.options.body as string) as { expectedVersion: number }).expectedVersion).toBe(2);
});

test('preset update keeps the versioned PATCH contract', async () => {
  const patch = await capture('PATCH', () => updatePreset('t', 'loc', 'p1', { expectedVersion: 4, input: { name: 'Dinner', allowedModes: ['dine-in'], hours: [], exceptions: [], requiredGuestFields: [], paymentTiming: 'deferred' } }));
  expect(patch.url).toBe('/locations/loc/service-presets/p1');
  expect(JSON.parse(patch.options.body as string)).toEqual({ expectedVersion: 4, input: { name: 'Dinner', allowedModes: ['dine-in'], hours: [], exceptions: [], requiredGuestFields: [], paymentTiming: 'deferred' } });
});

test('course commands ride the fire/hold/set routes with the visit version', async () => {
  const fire = await capture('POST', () => fireCourse('t', 's1', 'starters', 7));
  expect(fire.url).toBe('/service-sessions/s1/courses/starters/fire');
  expect(JSON.parse(fire.options.body as string)).toEqual({ expectedVersion: 7 });
  const hold = await capture('POST', () => holdCourse('t', 's1', 'mains', { expectedVersion: 8, to: 'hold' }));
  expect(hold.url).toBe('/service-sessions/s1/courses/mains/hold');
  expect(JSON.parse(hold.options.body as string)).toEqual({ expectedVersion: 8, to: 'hold' });
  const set = await capture('PUT', () => setCourses('t', 's1', { expectedVersion: 9, courses: [{ courseId: 'mains', name: 'Mains' }] }));
  expect(set.url).toBe('/service-sessions/s1/courses');
  expect(JSON.parse(set.options.body as string)).toEqual({ expectedVersion: 9, courses: [{ courseId: 'mains', name: 'Mains' }] });
});

test('preparation read and advance match the Task-5 routes', async () => {
  const list = await capture('GET', () => getSessionPreparation('t', 's1'));
  expect(list.url).toBe('/service-sessions/s1/preparation');
  const filtered = await capture('GET', () => getSessionPreparation('t', 's1', 'st1'));
  expect(filtered.url).toBe('/service-sessions/s1/preparation?stationId=st1');
  const advance = await capture('POST', () => advancePreparationItem('t', 'i1', { to: 'preparing', reason: 'on the pass' }));
  expect(advance.url).toBe('/preparation/i1/advance');
  expect(JSON.parse(advance.options.body as string)).toEqual({ to: 'preparing', reason: 'on the pass' });
  expect((advance.options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
});

test('session create passes the S3 preset snapshot fields and the bill read is the snapshot source', async () => {
  const create = await capture('POST', () => createServiceSession('t', { locationId: 'loc', tableIds: ['t1'], expectedTableVersions: [0], presetId: 'p1', serviceMode: 'dine-in', guest: { name: 'Ada', partySize: 4 } }));
  expect(create.url).toBe('/service-sessions');
  const body = JSON.parse(create.options.body as string) as Record<string, unknown>;
  expect(body.presetId).toBe('p1');
  expect(body.serviceMode).toBe('dine-in');
  expect(body.guest).toEqual({ name: 'Ada', partySize: 4 });
  const bill = await capture('GET', () => getOpenVisitSnapshot('t', 's1'));
  expect(bill.url).toBe('/service-sessions/s1/bill');
});

test('S4 print-job and bridge routes match the venue-ops paths exactly', async () => {
  const list = await capture('GET', () => listPrintJobs('t', 's1'));
  expect(list.url).toBe('/service-sessions/s1/print-jobs');
  const reprint = await capture('POST', () => reprintPrintJob('t', 's1', 'pj:0123456789abcdef0123'));
  expect(reprint.url).toBe('/service-sessions/s1/print-jobs/pj:0123456789abcdef0123/reprint');
  expect((reprint.options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  // Bridge register/revoke are stations.write routes — no ledger operation, but
  // the shared client still attaches its Idempotency-Key idiom to every POST.
  const register = await capture('POST', () => registerDeviceBridge('t', 'loc'));
  expect(register.url).toBe('/locations/loc/device-bridge/register');
  expect((register.options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  const revoke = await capture('POST', () => revokeDeviceBridge('t', 'loc'));
  expect(revoke.url).toBe('/locations/loc/device-bridge/revoke');
});
