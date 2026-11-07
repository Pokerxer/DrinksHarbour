# Server dependency migration — 22 October 2026

Scope: remove the critical legacy Transformers/ONNX dependency chain and migrate
server mail/spreadsheet packages. Preserve unrelated checkout work. No deployment,
credential rotation, database writes or source redistribution is authorized here.

Files: `server/utils/localEmbeddingRuntime.js` owns maintained-runtime loading;
`server/utils/embeddings.js` keeps its existing cache/provider cooldown and public
API. Regression tests cover asynchronous inference and unchanged vector shape.
`server/__tests__/dependencyCompatibility.test.js` checks real offline spreadsheet
and mail behavior. Package manifests/lockfiles record the exact resolved graph.

Use `@huggingface/transformers`, retaining `Xenova/all-MiniLM-L6-v2`, mean pooling,
normalization and384 dimensions. Use q8 instead of the deprecated quantized flag;
disable browser cache in Node. Verify real native inference in an isolated copy
with synthetic text before accepting the migration. Do not bulk-reindex products.

Use the official pinned SheetJS tarball and a maintained Nodemailer version.
Verify workbook round-trip/document extraction and existing transport/Bcc/rejection
tests without sending mail. Validate a clean install and full server suite, refresh
the production audit and record any remaining findings. Never use forced audit
downgrades or suppress findings to obtain a green gate.

## Runtime selection

The first candidate, Transformers.js4.3.1/ONNX1.30, removed audit findings but
failed actual import on Intel macOS: its package contained darwin/arm64 only.
The official installer did not supply the missing darwin/x64 binding. Do not
describe that attempt as a successful native migration.

The next candidate is the documented stable Transformers.js3.8.1 (ONNX1.21).
Its scoped Sharp override0.35.5 fixes the image-runtime advisories; this crosses
Sharp's0.34→0.35 boundary and requires a real runtime/image operation check.
Only the local text-embedding feature uses Transformers here. Preserve its public
model, output dimensions and normalization. Audit and native evidence decide
whether this candidate is accepted; no forced downgrade to Xenova1.x is allowed.

Status: verified22October. Clean install and4,167 server tests passed (37
optional skips),56 focused compatibility checks passed, and real native inference
passed with the final writable-cache configuration. Production dependency gate:
0high/0critical,10moderate remaining. No deployment or live-data writes. See
`docs/audits/server-dependencies-2026-10-22.md` for the evidence and remaining gates.
