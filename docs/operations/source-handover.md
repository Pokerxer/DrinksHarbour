# Source-code handover

DrinksHarbour is the product name. Product branding does not establish rights to
redistribute third-party starter code, fonts, icons, images, templates or data.
Inventory these dependencies/assets and retain their license notices. Confirm
the owner's rights and buyer terms before offering a source-code license; do
not promise resale rights that have not been documented.

Before a handover:

- Select a reviewed, tagged commit with successful checks and production builds.
- Resolve high/critical dependency findings or document an explicit, reviewed
  reachability assessment and mitigation; CI currently blocks on those levels.
- Rotate exposed credentials, inspect their use and provide new buyer-owned
  configuration. Revoke seller access after the agreed transition.
- Include startup, environment examples, architecture, API, test, deployment,
  migration, rollback, support and backup/restore instructions.
- Provision synthetic demo data. Exclude live tenant/customer/employee records,
  financial exports, appraiser scores, private PDFs, backups and internal notes.
- Use `git archive` of the approved release with the committed `.gitattributes`
  exclusions; inspect the archive before delivery. A raw copy of this working
  directory or a Git clone can expose files/history excluded from an archive.
- Review `server/scripts/` for business-specific identifiers and operational
  tools before delivery. Archive exclusions are not a complete privacy review.
- Decide whether the buyer gets a source archive or repository history; history
  has separate credential/privacy exposure and cannot be certified by a clean
  scan of current files.

Do not advertise this code as production-ready solely because unit tests pass.
Buyer-specific hosting, recovery, monitoring, licensing and end-to-end flows
need verified evidence.

## Starter-code cleanup

The admin README is DrinksHarbour documentation. Unreferenced starter account/order
email actions and templates were removed: they contained demo recipients, products,
tracking/address/payment claims and SMTP debug defaults. Backend transactional email
services remain authoritative. This cleanup does not resolve starter-code license
provenance. Preserve third-party notices and verify the owner's redistribution terms.
Internal `isomorphic-core` imports and persisted storage keys retain compatibility;
renaming those requires a separate migration rather than a cosmetic replacement.
