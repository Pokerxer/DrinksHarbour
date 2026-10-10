---
name: api-error-envelope-contract
description: The API's error envelope has no data key, so any unchecked `return json.data` yields undefined and a truthy-but-empty payload; eight services still do this.
type: convention
---

# Unwrapping API responses must check the envelope

`client/apps/admin/src/services/*.service.ts` call an Express API whose success
and failure envelopes differ in shape:

```jsonc
// success
{ "success": true, "data": { ... } }
// failure — includes 404 route-not-found
{ "success": false, "message": "Route GET /api/analytics/x not found", "availableRoutes": [...] }
```

The failure envelope has **no `data` key**. So:

```js
// Wrong: yields undefined on every failure, and the caller builds a truthy
// object out of undefined fields.
return json.data;
```

Correct, as in `webAnalytics.service.ts` after the 2026-09-30 fix:

```js
if (!res.ok || json.success !== true) {
  throw new Error(`GET ${path} failed: HTTP ${res.status} ${json.message || ''}`);
}
return json.data;
```

**Why it is dangerous rather than merely wrong:** the caller does
`if (!data) return <PlaceHolder />`, and an object of `undefined` fields is
truthy, so the guard never fires. The failure then surfaces as a `TypeError`
several layers away — reading `.traffic` off an object that never had it. This
is how a missing route (a 404) presented as a component crash.

**Still unfixed in 8 services:** `attendance` and `shift` (10 unwraps each),
`timeOff` (8), `orgStructure` (4). Same class, same crash, not yet reached.

The server-side counterpart to check first: whether the endpoint is registered at
all. Probing the route beats reading the client. See
`docs/superpowers/specs/RESUME-analytics-dashboard-crash.md`.
