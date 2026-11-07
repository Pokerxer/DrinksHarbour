---
date: 2026-10-22
status: verified-with-remaining-findings
scope: server dependency migration; isolated synthetic verification
---

# Server security migration

The final candidate removes the server production graph's critical and high
findings. `npm audit --omit=dev --json` reports10 moderate, 0 high, 0 critical,
compared with the previous13 findings including 1 critical/6 high. This is a
production dependency count, not an all-dependencies or application certification.

## Changes

- Replaced `@xenova/transformers`2.17.2 with maintained
  `@huggingface/transformers`3.8.1. Same `Xenova/all-MiniLM-L6-v2` text model,
  q8 quantization, mean pooling and normalized384-value vectors.
- Scoped Sharp0.35.5 override for that runtime. The0.34→0.35 boundary was
  explicitly tested with real native image generation/resizing and inference.
- Migrated Nodemailer to10.2.1 and server SheetJS to the official0.20.3 tarball.
  The lockfile retains resolved versions and tarball integrity.
- Fixed existing inference bugs: browser caching under Node and reading an
  asynchronous tensor before awaiting it. Retained caching/provider cooldown.
- Added model disposal during graceful shutdown. Model cache uses writable OS
  temp storage or `EMBEDDING_CACHE_DIR`, rather than requiring writable app files.
- Added mocked model regression tests, real offline mail/workbook/image checks,
  opt-in native smoke script and a bounded CI native compatibility step.

## Candidate selection

Transformers.js4.3.1/ONNX1.30 initially passedfocused compatibility checks
and removed additional moderate findings, but its published package lacked the
darwin/x64 binding. The official installer did not repair it. That candidate
was rejected after actual native import failed on this Intel Mac. A passing
audit or mocked test did not override that evidence.

The documented stable3.8.1/ONNX1.21 candidate ran native inference successfully.
Its older diagnostic dependency chain contributes moderate findings; those are
disclosed rather than suppressed. Do not upgrade back to4.x without verifying
native packaging on supported development and deployment platforms.

## Evidence

- Clean locked install in an isolated copy, with no real environment files.
- 56 focused tests passed: actual Sharp operation, spreadsheet round-trip,
  document text extraction, mail composer/privacy/rejection checks, CommonJS
  loading, asynchronous model output, initialization sharing and cached vectors.
- Native MiniLM smoke:384 finite normalized values, related wine cosine0.9211
  versus unrelated engine-repair cosine0.1063; pipeline disposed afterward.
- Cache-path regression observed failing before the configuration change and
  passing afterward (7 focused cache/provider tests).
- Final full server suite: 4,167 passed, 37 optional tests skipped, zero failures
  or cancellations; serial execution completed in 398 seconds. The previous
  concurrent run timed out in two schema-test files; those passed separately
  and in this complete serial rerun. No timeouts were hidden or extended.
- Final cache configuration: 10 focused tests passed and real native inference
  repeated successfully from writable temporary storage.
- Production dependency high/critical audit gate exited 0. Manifest/lock agreement,
  JavaScript syntax, CI YAML and relevant whitespace checks passed.
- Redacted working-tree credential scan:0findings. Existing credential history
  still requires owner rotation. No live data, SMTP delivery or deployment used.

Temporary evidence paths use `/private/tmp/drinksharbour-stable-*`; temporary
files are not durable records. This document and the readiness RESUME retain the
results for future sessions.

## Remaining gates

Production moderate findings include sanitize-html, mammoth/argparse/sprintf-js,
node-cron/uuid and the stable ONNX diagnostic chain
(global-agent/roarr/sprintf-js). Do not follow the audit's obsolete Mammoth
downgrade suggestion. These need separate reviewed migrations or reachability
and mitigation evidence. Development-only findings are outside the count above.

The client workspace's last measured15high findings remain. Hosted CI, Linux
native smoke, staging journeys, exposed credential rotation, backup restore,
deployment controls and source provenance are still required before release.
No overall production-ready or source-resale certification is implied.

Implementation plan and cache operating notes:
`docs/operations/server-security-migration.md`, `server/README.md`.
