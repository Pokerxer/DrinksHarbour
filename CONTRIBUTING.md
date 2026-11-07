# Developing DrinksHarbour

Use Node from `.nvmrc`, npm for the API and pnpm11.9 for the client workspace.
Keep `server/package-lock.json` and `client/pnpm-lock.yaml` with their manifests.
Do not run npm inside the pnpm client workspace or accept lockfile rewrites
without reviewing the dependency changes.

```sh
npm --prefix server ci
pnpm --dir client install --frozen-lockfile
npm run check
```

Use a focused branch such as `codex/fix-checkout-timeout`, small commits and a pull
request explaining the problem, resulting behavior, verification and rollout.
Never bundle unrelated edits from a shared working directory. Do not commit
customer data, credentials, production exports, backups or generated builds.

Before merging, require **Quality checks** for the exact proposed commit. The
repository owner must configure branch protection/rulesets in GitHub; a YAML
file cannot enable those account settings. Protect main against force pushes,
require review, and invalidate approvals when the reviewed code changes.

Tags identify releases; use SemVer and include the commit SHA, migrations,
verified test/build evidence, dependency audit, rollback target and owner in the
release record. Never tag a dirty checkout as though its uncommitted changes
were included. Follow [release procedure](docs/operations/release.md).
