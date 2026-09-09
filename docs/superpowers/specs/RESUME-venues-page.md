---
title: Venues directory redesign
status: complete
updated: 2026-09-09
---

# Venues directory redesign

## Delivered

- Replaced the bare `/venues` list with a dedicated venue directory component.
- Added an editorial venue hero, venue cards, logo/initial fallbacks, city labels, and a shop-the-bar call to action.
- Added live search and city filtering against the existing public `GET /api/venues` response.
- Added loading skeletons, retryable error state, and a useful empty state.
- Kept the existing authenticated booking endpoint and payload contract, while moving the form into an expandable per-venue booking flow.
- Added inline booking feedback, request errors, disabled/loading states, and a redirect-compatible sign-in hint through `fetchWithAuth`.
- Added a three-step “Your night, arranged” section to clarify the reservation journey and improved the booking handler to safely reset the form after async submission.
- Fixed the Phosphor icon export to use `PiPaperPlaneTilt`, matching `react-icons/pi`.

## Files

- `client/apps/platform/src/app/venues/page.tsx`
- `client/apps/platform/src/components/Venues/VenuesDirectory.tsx`

## Verification

- Focused ESLint passes for the two changed files after the second design pass.
- The full production build reached compilation but was manually stopped after prolonged silence; the reported missing-export error is resolved and no longer present in the source.
- App-wide `pnpm --dir client/apps/platform type:check` remains blocked by pre-existing errors in checkout, shop, banner, privacy/terms content, loyalty, and dynamic API route parameter types. No errors were reported from the changed venue files.

## Follow-up

- Add venue detail pages when the API exposes richer venue metadata (address, hours, hero image, amenities, and reservation policies).
- Consider replacing the static venue-card artwork with a dedicated public venue cover image field once available.
