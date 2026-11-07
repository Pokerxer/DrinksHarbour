---
name: Product description audio
description: Full description read-aloud on /product/[slug] using the search modal Fish Audio proxy.
type: project
---

## Behavior — 2026-10-29

The Description tab in `client/apps/platform/src/components/Product/Detail/index.tsx`
mounts `ProductDescriptionAudio` beside Product Description. Click Listen to
description to start; Stop cancels generation/playback. No automatic playback.
Full description wins over shortDescription; blank descriptions use the short one.
HTML is decoded into prose, block boundaries become spaces, and script/style/template
content is excluded. Errors restore the button and show retry guidance.

`description-audio.ts` uses the same `fetchWithAuth` POST `/api/tts` integration as
ModalSearch. Fish Audio model is configured server-side via FISH_AUDIO_MODEL
(default `s2.1-pro-free`), with FISH_AUDIO_VOICE_ID overriding the fixed default reference voice. No credentials in the
client. Search remains unchanged. Existing server disk cache applies to each chunk.

Both tts.routes.js and fishAudio.service.js truncate input at 300 characters. The
new reader sends ordered chunks <=285 characters without dropping trailing text;
tiny final chunks are merged to satisfy the API's five-character minimum. Each
chunk is fetched after the prior finishes. Stop, product/description change,
Description tab unmount, and page navigation abort pending work and pause audio.
Object URLs and event listeners are released. Late responses never start playback.

## Operational limits

The existing IP limit remains 30 requests per 15 minutes across search and this
reader. Extremely long descriptions or repeated starts can reach it; failures
show retry guidance. The existing service's character sanitization and voice/model
configuration remain authoritative. There is a generation gap between chunks.
Actual device autoplay/audio support and configured Fish Audio are required.

## Verification

318 platform tests passed: 10 audio, 284 Node, 11 venue and 13 shipment/order.
Final platform type check passed. Full server suite: 4,386 passed, 23 failed,
204 skipped; failures are Mongo integration tests with an empty dedicated venue
test URI, unrelated to this frontend change. Details and failing file names:
`docs/superpowers/specs/RESUME-product-description-audio.md`; full server output:
/tmp/drinksharbour-audio-server-unrestricted.log. Scoped manual review and diff
whitespace checks passed; CodeRabbit CLI absent. No live Fish Audio/browser sound
check. Automated tests mock media and HTTP boundaries.
No schema changes, commits, pushes or deployments. The voice follow-up below changes the shared TTS service.


## One voice follow-up — 2026-10-29

Superseded length behavior, 2 November 2026: shared playback now lives under
components/UI with compatibility product exports. Typical descriptions use one
up-to-4,800-character recording; server input cap is now 5,000, with explicit
oversize rejection. Provider continuity and restrained variation are explicit,
with versioned cache identity. Server must release before/with client to avoid
the old 300-character truncation. See brand-information-audio.md and
docs/superpowers/specs/RESUME-brand-information-audio.md for current verification.

User requires one voice for the entire reading. Local FISH_AUDIO_VOICE_ID was
unset, so every independent generation omitted reference_id. The shared
fishAudio.service now always sends one resolved reference_id: configured nonblank
FISH_AUDIO_VOICE_ID or `802e3bc2b27e49c2995d23ef70e6ac89` (Energetic Male).
Official voice: https://fish.audio/m/802e3bc2b27e49c2995d23ef70e6ac89/ .
The cache key includes that resolved reference, bypassing previous unspecified
voice entries without deleting cached files. This also makes search audio use the
same fixed default. Existing explicit voice overrides are preserved.

Four service tests cover repeated-section identity, blank config, explicit override
and separation from old unspecified-voice cache entries. Three failed before the
fix; all four pass afterward. The ten platform audio tests also pass. Full server
rerun: 4,390 passed, 23 failed, 204 skipped; the same missing dedicated Mongo
test URI failures as the prior run. Log: /tmp/drinksharbour-fixed-voice-server-tests.log. No paid/live synthesis was run;
voice selection is verified at the outgoing provider request boundary.
Restart/redeploy the backend to load the new service default. There is no .env edit.
