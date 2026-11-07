import test from 'node:test';import assert from 'node:assert/strict';
import {venueLocalToInstant,venueWallTime} from './venue-time.ts';
test('an overseas browser requests Abuja wall time, with unique DST instants only',()=>{
 assert.equal(venueLocalToInstant('2026-11-01T20:00','Africa/Lagos'),'2026-11-01T19:00:00.000Z');
 assert.equal(venueWallTime('2026-11-01T19:00:00Z','Africa/Lagos'),'2026-11-01T20:00');
 assert.throws(()=>venueLocalToInstant('2026-11-01T01:30','America/New_York'),/ambiguous/);
 assert.throws(()=>venueLocalToInstant('2027-03-14T02:30','America/New_York'),/exist/);
 assert.throws(()=>venueLocalToInstant('2026-02-30T20:00','Africa/Lagos'),/exist/);
});
