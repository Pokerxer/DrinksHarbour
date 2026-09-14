---
name: Chatbot size consistency
description: Catalog volume grouping and preventing silent chatbot cart size substitution.
type: project
---

LATEST CORRECTION: User confirms Kopke's actual price is ₦28,500; ₦27,700
was the wrong chatbot quote. Prior agreement-only fix and lower-price fixture
were insufficient. Catalog projections now include saved Size/SubProduct price
overrides and Size wholesale input, as required by storefront pricing. Regression
DB stubs honor projections; prompt and cart offer must both contain ₦28,500.
66 chatbot tests pass. No stored prices changed; no deployment. Older notes
below describe the investigation history, not price authority.

2026-09-14: chatbot size labels now group equivalent plain volumes using
server/utils/chatbotSizes.js. Preserve true different sizes and pack labels.
Fallback search must never invent labels from array position. AI receives
catalog size constraints and retains catalog context on retry.

Storefront Chatbot/chatSizeSelection.ts accepts equivalent units and refuses
explicit unavailable sizes instead of choosing a different bottle. Unspecified
size keeps the existing first in-stock selection. First-offer-only behavior
remains; no database changes. 59 server chatbot + 2 selector tests pass.
See ../superpowers/specs/RESUME-chatbot-sizes.md for verification limits.
Full server suite: 2691 pass / 97 route-harness port failures. Local platform
typecheck has errors outside chatbot files; no changed-file diagnostics.

Screenshot follow-up: the visible problem was also a PRICE mismatch (Kopke
75cl: ₦27,700 reply vs ≈₦28,500 cart offer). Cart proposal resolution now uses
the same full catalog provided to Claude, ahead of independently priced search
results, and resolveCartSize picks the requested variant's price. No guessing
between multiple sizes. Five new tests including screenshot-amount regression;
64 chatbot server tests pass. Live pricing not checked; not deployed.
Follow-up full suite: 2696 pass, same 97 route-harness port failures.
Correction full suite: 2698 pass, same 97 route-harness port failures.
