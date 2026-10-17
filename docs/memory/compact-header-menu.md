---
name: Compact laptop header menu
description: Desktop navigation disclosure and inline shopping location control.
type: project
---

User requested the laptop location icon beside search, and a smaller menu that
uses less space. Use compact pin beside search at all sizes; remove desktop
address row. Keep Shop/Sale visible, group other existing routes under Browse.
Keep tenant routes accessible too. Reduce logo/search spacing and hide the Cart
word on laptop widths; preserve accessible names. Use a native details disclosure
with Escape, outside-click and navigation closing. Colocate changes in HeaderNav,
Header, HeaderSearch, HeaderLogo and HeaderActions; no routing/backend changes.

Implemented locally: one compact location pin control at all widths; desktop
address row removed. Native Browse details keeps all secondary routes, with
active-link feedback and Escape/outside/navigation closing. Logo is 144px on
laptops/160px on larger screens; search gets flexible width and tighter margins.
Cart word hides below xl while its icon/count/accessible label remain. Account
and wishlist icon controls also have accessible names. Tenant logos are capped
and tenant navigation receives the same compact grouping.

Regression test failed on the old expanded nav before implementation. It checks
link reachability, Escape/focus restoration, outside click and navigation closing.
Full storefront tests and type diagnostics recorded in /tmp/drinksharbour-compact-
header-{tests,types}.log. Whitespace check passed. Real browser layout inspection
is unverified. No dependency, commit, push or deployment; preserve unrelated work.

Final storefront suite: 131 passed, 0 failed. Type check reports 18 existing
diagnostics outside changed header/location files. Other ongoing work changed
the suite/diagnostic counts from the previous session; no unrelated edits reverted.
