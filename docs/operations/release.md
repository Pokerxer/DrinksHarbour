# Release procedure

1. Select a reviewed commit on main. Run Quality checks for that exact commit:
   credentials, backend unit/HTTP/transaction tests, frontend types/lint/tests,
   production builds and production dependency audits. A failed or skipped
   required check blocks release. Review optional integration-test skips.
2. Record commit, release tag, test/build/audit evidence, migration/import changes,
   known limitations, owner, prior artifact/deployment ID and recovery procedure.
3. Verify database backups and an isolated restore. Use backward-compatible
   migrations; never run a destructive import or backfill during application
   startup as a substitute for a reviewed migration.
4. Deploy to staging with test Paystack keys and synthetic tenants. Exercise
   sign-in/MFA, cross-tenant denial, catalog, POS/checkout, signed payment
   callbacks/replays, stock movement/return and admin permissions. Verify mobile
   layouts, error states and loss-of-network recovery. Never charge a real card
   or email customers as a smoke test.
5. Monitor the deployed API `/health` (process liveness) and `/ready` (database
   ping,503 on failure). Verify checkout/queue/webhook health separately; a DB
   ping alone cannot prove the business works.
6. For the web apps, configure protected GitHub environments `production-admin`
   and `production-platform`. Each needs its own VERCEL_ORG_ID,
   VERCEL_PROJECT_ID and VERCEL_TOKEN secrets, required reviewers and allowed
   main branch. Project root directories must match the selected application. Enable access to
   files outside the project root for shared workspace packages and quality scripts.
   Both web Vercel configs install from the client workspace using the frozen pnpm
   lockfile; do not replace this with nested npm installs.
7. Run **Release web application** manually on the reviewed main commit. It
   requires successful CI for that same SHA, builds with a pinned Vercel CLI and
   deploys that prebuilt artifact. Do not use deployment hooks that silently
   select a newer commit. The workflow is unactivated until committed/pushed
   and GitHub/Vercel environments are configured.
8. API deployment must use the actual backend provider's reviewed procedure.
   That provider, production release permissions and deployment artifact
   controls have not been verified; do not invent an SSH host or cloud account.
9. Verify public/tenant/admin routes, API readiness, error rates, payment
   processing, stock invariants and logs after release. Roll back on regression.

Existing Vercel Git integration can deploy independently of this workflow.
Configure Vercel Deployment Checks/production-branch controls so it cannot bypass
required CI. This is an account setting, not established by adding YAML here.
