---
name: Wedding beverage budget and guest planning
type: project
date: 2026-10-21
---

User requested a wedding beverage planner using the whole drinks budget and total
guest count. This supersedes the earlier no-serving-estimate prompt convention.
Shared weddingBeveragePrompt.js is used by structured generation and follow-up
chat: claude-haiku-4-5 via existing server Anthropic SDK. Full event context,
adult/non-drinker mix, duration, water/mixers, explicit provisional assumptions,
latest corrections and one next question. No cart/order execution.

Server validates actual catalogue IDs/prices/stock,20 lines,16 sampled price tiers
per category, reserved manual quantities and kobo arithmetic. Target98–100%budget;
one bounded model revision. occasionPlanAssessment.js constrains AI quantities by
a validated provisional profile, fills coverage deficits and calculates actual
catalogue-volume capacities; RTDs are sealed drinks, ambiguous packs unknown.
Toast first; remaining shared alcoholic allocation split equally among selected
wine/beer/spirits, not a full quota of each per guest. These are provisional stock
planning defaults, not clinical units or guaranteed consumption/sufficiency.
Missing water/mixer/stock requirements are explicit; no invented service costs.

Prompt-only full-budget selection overbought spirits. Quantity envelope fixed
that but live300guest/5million test then spent53.82%. occasionBudgetUpgrade.js
now upgrades AI-selected units using same category, service type and bottle volume
without increasing supply or changing pinned selections; enforce stock/budget,
20lines and bounded512 iterations. Prices do not establish taste quality; final
brands need host confirmation. Model numeric prose is excluded from display.
Client supports20 proposed product actions, bounded long-reply history chunks and
180second generation deadline (ordinary chat90seconds).

Verification and latest live result: see
 docs/superpowers/specs/RESUME-wedding-beverage-budget-plan.md.
Local work only; no deployment, commit or push.

Superseded customer flow: RESUME-occasion-staff-review.md / docs/memory/occasion-staff-review.md. Wedding AI planning is now a private staff tool; profile Chat stores human conversation.
