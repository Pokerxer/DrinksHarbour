# Brand publication boundary

Public brand discovery and ID/slug detail expose only `status: active`. Brand
publication uses this status; there is no separate approved requirement. `verified`
is an optional editorial badge, not a publication gate. Caller `status` query
parameters (including all, arrays and pending) cannot override public visibility.
Public filter option status counts also include only active brands.

Platform admins review all statuses at authenticated `GET /api/brands/admin` and
`GET /api/brands/admin/:id`; only `admin` and `super_admin` pass the existing auth
policy. The detail route precedes wildcard routes. Proposal creation and guarded
CRUD policies are unchanged. Admin detail and edit consumers use the protected
read; server-rendered edit metadata/form attach the existing session token.
Deploy server and admin changes together (or server first), since the protected
detail route is new. Existing admin clients using public detail cannot inspect
unpublished brands after server rollout until updated. Public storefront calls
continue using their existing paths and response envelope.

Regression tests:
- `cd server && node --test __tests__/brandPublicVisibility.test.js __tests__/brandRouteAuth.test.js __tests__/brandPendingStatus.test.js __tests__/brandControllerExports.test.js`
- `cd client/apps/admin && npm test -- --run src/services/brand.service.test.ts 'src/app/(hydrogen)/brands/[id]/edit/page.test.tsx'`

2026-11-02: 23 new server cases first produced 16 expected failures / 7 passes,
then 40/40 targeted server cases passed with existing auth/proposal tests. Three
new admin cases first failed, then targeted admin checks passed 6/6. The database
boundary is stubbed; HTTP router, auth, controller and service execute normally.
No business database writes. Full-suite/integrated browser evidence belongs in
`docs/superpowers/specs/RESUME-brands-directory.md`.
