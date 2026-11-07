---
name: Occasion empty plan diagnosis and fix
type: project
date: 2026-10-21
---

Screenshot300guests/NGN5000000/all5categories falsely produced a zero-value plan.
Same inputs succeeded on retry, so exact historical trigger is unknown. Fixed
reproduced paths: null catalogue failure no longer means empty stock; valid size
offers qualify before12-per-category cap; empty/invalid AI selections with actual
candidates fail with retry. Genuine no-fit response no longer pretends a zero
subtotal is a generated list. Successful empty catalogue shape{text:'',entries:[]};
null remains failure. Safe503 explicit retry keeps original brief;429 no retry.

238 storefront and4124 backend tests pass,36skip;types/lint pass. Real browser
300guest/5million/all5categories produced6products,447600subtotal/4552400remaining.
Local only,no deploy. Docs:docs/superpowers/specs/RESUME-occasion-empty-plan-fix.md.

Superseded wedding budgeting/guest-coverage behavior: wedding-beverage-budget-plan.md.
