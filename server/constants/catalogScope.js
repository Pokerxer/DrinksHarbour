'use strict';
// Catalogue scope (docs/audits/general-saas-evolution/architecture.md §1):
// A Product is EITHER a canonical marketplace identity (public surfaces,
// super-admin moderated) OR a tenant-private identity (owner-only, never
// published). Legacy documents have no publicationScope field and read as
// canonical — this is additive with zero backfill, exactly like catalogKind.
//
// GENERAL_CATALOG_SCOPE_ENABLED is the creation flag only: when false, new
// tenant-created Products keep the legacy pending-canonical lifecycle. Rows
// that already exist as tenant_private stay private regardless of the flag,
// and the canonical read filter (defense-in-depth against leaks) applies
// unconditionally on every public surface, not only when the flag is on.

const CANONICAL = 'canonical';
const TENANT_PRIVATE = 'tenant_private';
const SCOPES = { [CANONICAL]: CANONICAL, [TENANT_PRIVATE]: TENANT_PRIVATE };

const enabled = () => process.env.GENERAL_CATALOG_SCOPE_ENABLED === 'true';

// Matches legacy documents (no field) and canonical documents, and never
// tenant-private ones. Safe to add unconditionally to public queries —
// missing-field docs (all pre-scope data) always match.
const canonicalReadMatch = () => ({ publicationScope: { $ne: TENANT_PRIVATE } });

module.exports = { CANONICAL, TENANT_PRIVATE, SCOPES, enabled, canonicalReadMatch };
