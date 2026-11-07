# Security process

Do not publish credentials or customer records in issues, pull requests or logs.
Contact the repository owner privately through the established business channel;
no dedicated vulnerability-reporting address has been configured in this repo.
Include affected version/commit, a minimal reproduction and expected impact.

Assess findings, contain the affected surface, reproduce with disposable data,
apply a tested fix, deploy it, and record the affected and fixed versions. Review
tenant isolation, access control, payments and inventory integrity for every
security fix. Security findings must not be hidden by skipping failing checks.

For an exposed credential, replace it at the issuing service, update every
consumer, verify the replacement works, revoke the old value and inspect access
logs. Removing it from the current source does not revoke it or erase Git history.
History rewriting requires a separately coordinated recovery plan.

The local credential checker catches a limited set of high-confidence patterns;
it is not a complete secret scanner or a Git-history audit. Enable GitHub secret
scanning/push protection where the account supports them. Run the dependency
audits in CI, review automated update PRs and retest supported releases.
