# Popup artwork click-through

The platform modal in `client/apps/platform/src/components/Banner/PopupBanner.tsx` links its artwork to the configured `ctaLink`, unless `imageClickable` is explicitly false. CTA text is optional. A separate native link covers the artwork, leaving close controls independent, and tracks the click with fetch keepalive before dismissal.

Handoff: `docs/superpowers/specs/RESUME-popup-banner-portrait.md`.

2026-09-09 commit check: reviewed the link, opt-out, external-link attributes
and keepalive tracking changes; whitespace checks pass. No new browser test
performed for this commit. No push or deployment requested.
