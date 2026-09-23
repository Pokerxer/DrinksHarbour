---
name: Linked-product 503 recovery
description: Basic Info preserves selection on database outages and retries the product read without writes.
type: memory
---

# Linked-product database outage recovery

See `docs/superpowers/specs/RESUME-sub-product-product-load-recovery.md`.

`Database temporarily unavailable. Please retry.` is the server API DB guard's
503 response. Local health was Connected on September 23; do not infer a bad
product or clear selection from this response.

`services/product-read.ts` retries GET once for 503 with a bounded Retry-After
wait. It preserves HTTP status and accepts an AbortSignal. No mutation retries.
Basic Info aborts old loads and exposes an inline Retry action without logging
expected read failures as console errors. Only 404 means a missing product.

Keep duplication/create separate from read recovery; retries must never POST.
