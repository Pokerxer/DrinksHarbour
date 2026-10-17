---
name: Sub-product creation dialogs
description: Shared dialog shell and compact catalog matching UI in sub-product creation.
type: memory
---

`components/FormDialog.tsx` uses the existing Headless UI dependency for dialog
title/description, focus management and dismissal. The body scrolls within the
viewport while header/footer remain visible. During submission, dismissal is
disabled. Footer submit buttons target the form via its unique `useId()` ID.

The brand modal delegates fields to `BrandNameFields` and `BrandDetailsFields`;
labels target their controls and AI icon buttons have accessible names. Existing
generation and brand creation requests remain unchanged.

`SingleItemConfirmation` replaces the size-mode confirmation UI; confirm still
sets `sellWithoutSizeVariants`, keeping the unsaved variants for restoration.

`CatalogMatchRow` is shared by the picker and new-name suggestions. It wraps long
names, uses contained images, displays match/pending information and selects only
on an explicit click. Search loading now renders the results panel immediately;
the panel has independent scrolling with a visible creation action.

See `docs/superpowers/specs/RESUME-sub-product-modals.md` for verification.

Verified October 11, 2026: full admin suite 2,692 passed (306 files), plus the
new brand submission integration test passed independently. Type check retains
390 existing diagnostics; no new-component diagnostics. Browser startup remains
unavailable, so live visual viewport checks are outstanding.
