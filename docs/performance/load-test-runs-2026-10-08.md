# Raw before/after load runs — 2026-10-08

600 successful requests per row; zero unexpected statuses or response mismatches.
600 / elapsed seconds determines throughput; percentiles use nearest-rank sorted latency.

| Round | Version | Scenario | Clients | Mean ms | p50 ms | p95 ms | p99 ms | Req/s | Aggregates | Finds | Updates | Body bytes/req | Wire bytes/req |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | before | hot | 1 | 77.7 | 74.2 | 108.2 | 170.5 | 12.8 | 600 | 1800 | 1200 | 37491 | 1368 |
| 1 | before | hot | 10 | 194.8 | 193.9 | 236.7 | 260.0 | 50.9 | 600 | 1800 | 1200 | 37491 | 1368 |
| 1 | before | hot | 50 | 1060.5 | 1063.6 | 1350.8 | 1442.9 | 45.9 | 600 | 1800 | 1200 | 37491 | 1368 |
| 1 | before | mixed | 1 | 35.2 | 32.2 | 49.6 | 55.1 | 28.1 | 600 | 1800 | 1200 | 37526 | 1374 |
| 1 | before | mixed | 10 | 108.6 | 102.5 | 152.6 | 171.0 | 91.1 | 600 | 1800 | 1200 | 37526 | 1374 |
| 1 | before | mixed | 50 | 549.9 | 531.5 | 695.2 | 720.6 | 88.3 | 600 | 1800 | 1200 | 37526 | 1374 |
| 1 | after | hot | 1 | 39.6 | 36.6 | 56.8 | 81.2 | 25.0 | 600 | 1800 | 600 | 37491 | 1368 |
| 1 | after | hot | 10 | 61.2 | 59.9 | 71.9 | 80.8 | 161.8 | 60 | 1260 | 600 | 37491 | 1368 |
| 1 | after | hot | 50 | 152.7 | 125.5 | 295.7 | 315.0 | 323.1 | 12 | 1212 | 600 | 37491 | 1368 |
| 1 | after | mixed | 1 | 42.6 | 42.7 | 46.1 | 52.4 | 23.2 | 600 | 1800 | 600 | 37526 | 1374 |
| 1 | after | mixed | 10 | 97.1 | 96.0 | 121.6 | 139.3 | 102.0 | 600 | 1800 | 600 | 37526 | 1374 |
| 1 | after | mixed | 50 | 468.0 | 459.4 | 600.4 | 641.8 | 104.1 | 600 | 1800 | 600 | 37526 | 1374 |
| 2 | after | hot | 1 | 64.9 | 49.0 | 151.7 | 278.9 | 15.2 | 600 | 1800 | 600 | 37491 | 1368 |
| 2 | after | hot | 10 | 89.1 | 80.6 | 148.9 | 175.7 | 111.3 | 60 | 1260 | 600 | 37491 | 1368 |
| 2 | after | hot | 50 | 153.1 | 148.3 | 194.4 | 212.9 | 322.7 | 12 | 1212 | 600 | 37491 | 1368 |
| 2 | after | mixed | 1 | 38.6 | 39.4 | 47.7 | 54.9 | 25.6 | 600 | 1800 | 600 | 37526 | 1374 |
| 2 | after | mixed | 10 | 84.3 | 83.5 | 99.3 | 117.8 | 117.7 | 600 | 1800 | 600 | 37526 | 1374 |
| 2 | after | mixed | 50 | 417.0 | 410.8 | 475.2 | 575.2 | 116.5 | 600 | 1800 | 600 | 37526 | 1374 |
| 2 | before | hot | 1 | 45.7 | 44.7 | 62.7 | 76.2 | 21.6 | 600 | 1800 | 1200 | 37491 | 1368 |
| 2 | before | hot | 10 | 87.5 | 85.4 | 118.6 | 135.5 | 113.1 | 600 | 1800 | 1200 | 37491 | 1368 |
| 2 | before | hot | 50 | 502.8 | 451.4 | 799.3 | 890.9 | 95.8 | 600 | 1800 | 1200 | 37491 | 1368 |
| 2 | before | mixed | 1 | 54.1 | 48.7 | 86.2 | 141.0 | 18.3 | 600 | 1800 | 1200 | 37526 | 1374 |
| 2 | before | mixed | 10 | 160.2 | 157.2 | 210.0 | 234.9 | 61.8 | 600 | 1800 | 1200 | 37526 | 1374 |
| 2 | before | mixed | 50 | 1607.8 | 1142.6 | 3512.3 | 3909.8 | 29.4 | 600 | 1800 | 1200 | 37526 | 1374 |
| 3 | before | hot | 1 | 78.3 | 72.2 | 128.5 | 175.0 | 12.7 | 600 | 1800 | 1200 | 37491 | 1368 |
| 3 | before | hot | 10 | 202.1 | 169.2 | 390.3 | 527.5 | 49.0 | 600 | 1800 | 1200 | 37491 | 1368 |
| 3 | before | hot | 50 | 818.9 | 806.0 | 952.0 | 991.6 | 59.6 | 600 | 1800 | 1200 | 37491 | 1368 |
| 3 | before | mixed | 1 | 57.6 | 53.8 | 81.2 | 111.9 | 17.2 | 600 | 1800 | 1200 | 37526 | 1374 |
| 3 | before | mixed | 10 | 171.7 | 164.4 | 231.3 | 411.0 | 57.7 | 600 | 1800 | 1200 | 37526 | 1374 |
| 3 | before | mixed | 50 | 972.4 | 963.2 | 1106.9 | 1341.4 | 50.0 | 600 | 1800 | 1200 | 37526 | 1374 |
| 3 | after | hot | 1 | 75.0 | 74.1 | 100.9 | 135.1 | 13.2 | 600 | 1800 | 600 | 37491 | 1368 |
| 3 | after | hot | 10 | 56.2 | 53.4 | 66.2 | 162.2 | 176.1 | 60 | 1260 | 600 | 37491 | 1368 |
| 3 | after | hot | 50 | 118.4 | 118.2 | 141.1 | 143.9 | 416.9 | 12 | 1212 | 600 | 37491 | 1368 |
| 3 | after | mixed | 1 | 64.7 | 57.5 | 105.9 | 152.5 | 15.3 | 600 | 1800 | 600 | 37526 | 1374 |
| 3 | after | mixed | 10 | 170.3 | 143.7 | 320.7 | 445.4 | 57.7 | 600 | 1800 | 600 | 37526 | 1374 |
| 3 | after | mixed | 50 | 796.8 | 760.0 | 1181.5 | 1272.3 | 61.0 | 600 | 1800 | 600 | 37526 | 1374 |

## Frozen source SHA-256

```yaml
before/catalog.js: 16307d4525e9b332d08d7a686691e75eb60c21ac831ac917c53dc6bf6015dcde
before/keys.js: ae181c3dd93798369e14140d0905915a1c1e5f934e316bd0bf9dfe30cebd2b92
before/logger.js: ecaf5403fa10ba630fc3192abc8354e824f764b14a93833b838dc5cd841e65b5
after/catalog.js: f73d40236dc4b4fc2a107013a2d0af664b3367903bd6765b418de56c7f214a44
after/keys.js: 8b11de59807dc01a52cac554e5dafee21d8a2ff9accd0bfe135313c0a350539f
after/logger.js: bb55a366619a21d9598364b4bd14f1d2b2f022e696c09713b04e6abe045a1d6c
```

The before catalogue and key implementations are reconstructed from the source
present immediately before the optimization, not Git HEAD. Both snapshots use
shared live dependencies from this checkout. Sources are stored under
server/scripts/performance-load/snapshots/{before,after}. API source was not
modified or deployed by this load-test session.
