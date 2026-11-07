---
name: Brand information audio
description: Click-to-read About and story using shared Fish Audio reader, 2026-11-02.
type: project
---

Individual brand pages expose Listen to brand information beside About. It reads
displayed About paragraphs and story only after activation. Shared
components/UI/DescriptionAudio and description-audio own the reader and bounded
TTS requests; product imports retain compatibility exports. Preserve Stop,
abort on page/content change, loading/error announcements and blob cleanup.
Existing Fish Audio server model/voice configuration is authoritative; no browser
credentials or new provider. Fresh checks: 27 directory/shop/store tests,
10 product-audio tests, 142 module checks and TypeScript pass. Real Glenfiddich
browser activation reaches Reading status; Stop restores Listen. Handoff:
docs/superpowers/specs/RESUME-brand-information-audio.md. No deployment.

Continuous-voice follow-up: the shared reader now uses up to 4,800 characters
per recording instead of 280, preferring sentence boundaries for longer copy.
Server route/service accept up to 5,000 and reject longer input rather than
truncating it. Fish Audio receives the same pinned/configured reference voice,
`condition_on_previous_chunks: true` and temperature 0.3. Cache identity includes
`continuous-v1` to bypass older synthesis. This reduces independent-voice resets
and generation gaps on ordinary brand/product copy, at the cost of initial wait.
Very long copy still splits and can pause between passages; do not promise
perfectly gapless audio or identical human-perceived timbre.

Release server before/with frontend: the old server truncates at 300 characters.
Do not deploy the new long-passage client against that old server. Focused checks
pass: 11 product-audio, 27 shop/brand/store and 8 voice/route tests; TypeScript and
server syntax pass. Full-server verification recorded in the resume file.

Continuation: live updated Fish Audio service accepts a 1,415-character passage
as one recording; fresh generation takes 42 seconds and returns 82 seconds of
valid MP3. Full decode passes and no silence >=1.5s is detected at -40dB.
Playback sample and exact checks are in the resume file. This confirms provider
integration, not a human judgement of voice timbre. Still undeployed.

Same reader now covers product, category and subcategory detail pages; see
catalog-information-audio.md and RESUME-catalog-information-audio.md for wiring
and current page checks. Do not fork playback implementations per entity.

Screenshot error follow-up: local frontend uses localhost:5001, but the API
listener had stopped. Restoring the exported Express API on that port fixes
actual brand playback and cached retries; Stop works. Local API left running,
without startup index reconciliation or cron. Launch/log details in resume file.
Shared errors distinguish unreachable service, throttling (429) and temporary
unavailability (503). Three new regressions pass; fresh audio/page 20, directory
27, module 142 and TypeScript checks pass. No deployment or new backend code.
