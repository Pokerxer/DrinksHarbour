# Wyn City all-history attendance scores

Calculated 2026-10-19T19:40:48.000Z. Audit 6ad672461020ce9c79cd01cc.

| Employee | Score /100 | Attended | Expected | Absent |
|---|---:|---:|---:|---:|
| Joshua | 72 | 5 | 6 | 1 |
| Janice | 79 | 21 | 23 | 2 |
| Faith | 85 | 26 | 36 | 10 |
| Oluchi | 89 | 28 | 36 | 8 |

Weekly quota evaluator is local code; existing deployed API needs these code changes before Faith/Oluchi dashboard scores update.

Clock-in/out times, sources, statuses and worked minutes were preserved. Long records below require manager review, not guessed corrections.

## Joshua

Published-shift scoring; underlying live records corrected. Joshua's confirmed
start date is 7 October. Six existing punch links were repaired across the work.

2 on-time; 3 late; 1 early departure. Today's unfinished overnight shift is excluded.

Records requiring review (UTC):

| Record | Clock-in | Clock-out |
|---|---|---|
| 6acddd65b251e585675c9b57 | 2026-10-13T07:27:33.000Z | 2026-10-15T07:55:08.000Z |
| 6ad087c4cba8e9492b112b53 | 2026-10-15T07:59:00.000Z | 2026-10-17T07:38:56.000Z |

## Janice

Published-shift scoring; underlying live records corrected.

11 on-time; 10 late; 4 early departures. 2 punch links repaired.

Records requiring review (UTC):

| Record | Clock-in | Clock-out |
|---|---|---|
| 6a8d4cf95d517cc076818ff8 | 2026-08-25T08:06:16.000Z | 2026-08-28T07:23:56.000Z |
| 6a9921a0007f43c1c1022655 | 2026-09-03T07:28:25.000Z | 2026-09-05T07:36:26.000Z |
| 6aa69c33b93c9b6c2bca50ad | 2026-09-13T12:50:58.000Z | 2026-09-17T07:58:10.000Z |
| 6ab910e00fed77eee4d7974e | 2026-09-27T12:49:00.000Z | 2026-10-01T08:38:00.000Z |
| 6ad08656cba8e9492b112b06 | 2026-10-15T07:38:00.000Z | 2026-10-17T08:08:00.000Z |

## Faith

Four weekdays/week, 08:40–17:00; coverage from 2026-08-17. Only complete weeks count. Requires deployment for dashboard display.

23 on-time; 3 late; 0 early departures. 0 punch links repaired.

| Week start | Required | Credited | Missed |
|---|---:|---:|---:|
| 2026-08-17 | 4 | 3 | 1 |
| 2026-08-24 | 4 | 3 | 1 |
| 2026-08-31 | 4 | 3 | 1 |
| 2026-09-07 | 4 | 2 | 2 |
| 2026-09-14 | 4 | 3 | 1 |
| 2026-09-21 | 4 | 3 | 1 |
| 2026-09-28 | 4 | 3 | 1 |
| 2026-10-05 | 4 | 3 | 1 |
| 2026-10-12 | 4 | 3 | 1 |

Records requiring review (UTC):

| Record | Clock-in | Clock-out |
|---|---|---|
| 6a8bf070b6e5eb8cc8f3c831 | 2026-08-24T07:19:12.000Z | 2026-08-26T07:22:18.000Z |
| 6aace0525fcad0ca3e78a973 | 2026-09-18T06:55:13.000Z | 2026-09-21T07:21:47.000Z |
| 6ac88d7fff074492184d97f6 | 2026-10-09T06:45:19.000Z | 2026-10-12T06:39:26.000Z |

## Oluchi

Four weekdays/week, 08:40–17:00; coverage from 2026-08-17. Only complete weeks count. Requires deployment for dashboard display.

26 on-time; 2 late; 0 early departures. 0 punch links repaired.

| Week start | Required | Credited | Missed |
|---|---:|---:|---:|
| 2026-08-17 | 4 | 3 | 1 |
| 2026-08-24 | 4 | 2 | 2 |
| 2026-08-31 | 4 | 3 | 1 |
| 2026-09-07 | 4 | 2 | 2 |
| 2026-09-14 | 4 | 4 | 0 |
| 2026-09-21 | 4 | 3 | 1 |
| 2026-09-28 | 4 | 4 | 0 |
| 2026-10-05 | 4 | 3 | 1 |
| 2026-10-12 | 4 | 4 | 0 |

Records requiring review (UTC):

| Record | Clock-in | Clock-out |
|---|---|---|
| 6a8dbc3a9bd30c9972628345 | 2026-08-25T16:00:56.000Z | 2026-08-27T07:27:03.000Z |
| 6aa25297bbeb819a41259104 | 2026-09-10T06:47:51.000Z | 2026-09-11T07:15:00.000Z |
| 6aace6d2e52c41432331b744 | 2026-09-18T07:22:57.000Z | 2026-09-22T07:10:25.000Z |

## Additional review item

Joshua record `6ad466974854f9f275f74309` lasts about two minutes (18 October, 07:26–07:28 Lagos). The existing matching rule attaches it to the overnight Shift 1 start on 17 October. It counts as late attendance and early departure. Actual hours require manager confirmation; no times were guessed.

Verification: 4,085 server tests and 83 admin attendance tests passed; 36 server tests skipped. Independent readback matched all four scores and preserved all eight repaired punches’ original clock times, source, status and worked minutes.
