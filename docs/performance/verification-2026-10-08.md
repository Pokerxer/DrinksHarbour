# Server performance verification — 2026-10-08

Changes left uncommitted. No production data writes or deployment performed.

| Check | Result |
|---|---|
| Focused performance/logger/key/catalogue unit tests | 16 passed |
| Real isolated MongoDB performance suite | 6 passed |
| Existing real transactional storefront integration suite | 8 passed |
| Final complete backend suite | 3,446 passed, 2 failed, 5 skipped |
| Isolated MFA tests | 4 passed, same 2 failed |
| ERM access isolated rerun | 21 passed |
| Changed JavaScript syntax and git diff whitespace checks | Passed |

Full-suite failures (outside the performance files):

- `mfaVerifiedToken.test.js`: verifyLoginMfa: returns an mfa-verified token the middleware accepts
- `mfaVerifiedToken.test.js`: verifyLoginMfa: also sets the dh_mfa cookie

The controller's User identity lookup is not stubbed by these tests; without a
connected database it buffers/errors and neither response nor cookie is issued.
No MFA controller or fixture changes were made in this task.

## Repeat

Run the complete suite from server: `node --test '__tests__/*.test.js'`.
HTTP tests require permission to bind local sockets.

For performance integration, set `DRINKSHARBOUR_PERF_TEST_MONGO_URI` to
`mongodb://127.0.0.1:27918/drinks_perf_test_<unique>?replicaSet=dhperf`, using an
isolated local replica set. Run `node --test __tests__/serverPerformanceMongo.test.js`.
The URI is strictly guarded; that test deletes only its isolated database.

The existing storefront integration accepts
`DRINKSHARBOUR_TEST_MONGO_URI=mongodb://127.0.0.1:27918/drinks_rest_test_<unique>?replicaSet=dhperf`
and runs through `__tests__/storefrontMongo.integration.test.js`.

Both real suites use synthetic records. Key concurrency enforces 60/minute
across 100 requests. Catalogue concurrency produces one aggregate for 100
identical reads; subsequent read sees a new price. Index scans examine 10
matching documents out of 2,000 without forcing an index hint. Existing indexes
survive idempotent rollout. These are database-work measurements, not live
latency or tenant-capacity benchmarks.

## Load-test follow-up, later in this session

36 HTTP workloads completed: 21,600 measured + 3,600 warmup requests all
successful, identical validated payloads. Report:
[before/after load comparison](load-test-2026-10-08.md).

Fresh full suite after measurement: **3,454 passed, 0 failed, 5 skipped**
(3,459 total). Earlier MFA failures did not recur; no MFA/application source
was changed by the load-test follow-up. All benchmark script syntax checks
and diff whitespace checks passed. Fixture DBs removed and dedicated mongod
stopped. No production writes, index rollout or deployment.
