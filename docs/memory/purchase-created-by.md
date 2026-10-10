# Shared purchase/transfer creator identity

2026-10-04. Handoff: docs/superpowers/specs/RESUME-purchase-created-by.md.

/purchases list and grid show Created by using document-author-cell.tsx. Transfer
author cell re-exports that shared component. List/detail API reads select stored
User identity fields and use documentCreator.js; stockTransfer.creator.js keeps
the old export alias. Convert Mongoose documents toObject before normalizing;
lean transfer DTOs are already plain objects. Don't use User.name populate or
depend on virtual names in lean reads. Preserve null/raw creator references and
show Unknown user rather than guessing creator. Keep name/email/initials consistent
on purchase and transfer lists. Tests cover scoped API projection and DTO identity.
