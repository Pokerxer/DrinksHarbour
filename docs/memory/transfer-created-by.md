# Transfer creator identity

2026-10-04. Handoff: docs/superpowers/specs/RESUME-transfer-created-by.md.

User has stored firstName/lastName/displayName/email, not name. Lean user populate
doesn't provide fullName virtual. Transfer list/detail must select real identity
fields and normalize creator name for existing name-based readers. Prefer display
name, then full name, legacy name, email. Don't rewrite creator references or
attribute missing historical creators to the logged-in viewer. UI column Created
by shows initials/name/email and Unknown user when unavailable. Preserve tenant
scope of transfer reads. See API projection and creator cell tests.

Purchase follow-up shares implementation in documentCreator.js and
document-author-cell.tsx; original transfer exports remain compatibility wrappers.
See docs/superpowers/specs/RESUME-purchase-created-by.md.
