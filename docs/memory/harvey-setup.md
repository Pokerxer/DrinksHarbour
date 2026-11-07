---
name: Harvey customer acquisition installation
description: Local Harvey sales setup for Abuja beverage businesses; private Codex runtime, mailbox pending, no outreach sent.
type: project
updated: 2026-10-18
---

# Harvey customer acquisition installation

Installed upstream `ethanplusai/harvey` revision
`e114e95471b1bf155454fca108f0730b66a47a01` under `.local/harvey/` with a Python
3.11 environment; all `.local/` content is excluded from application Git history.
Use `bash scripts/harvey.sh ...` to run it. Its dashboard is loopback port 5555.

Claude auth status said logged in, but live inference failed because the
organization disabled Claude Code subscription access. Do not treat saved login
as a successful connection check. Installed a separate Codex CLI 0.159.3 under
`.local/harvey-codex/`; the launcher prepends its bin directory only for Harvey.
Desktop Codex remains unchanged. `gpt-5.5` from upstream docs was unavailable;
the live account catalogue and preflight verified `gpt-6.1-sol` as tool-free.

Sales knowledge uses local ERM prices, Abuja beverage targeting, a 20-minute
demo, and Africa/Lagos hours. User subsequently supplied mailbox settings in a
screenshot: `business@drinksharbour.com`, SMTP `premium356.web-hosting.com:465`
(implicit TLS), IMAP same host on 993 (SSL). These are saved and verified in the
local config; provider is smtp. Password remains missing, so authentication has
not been tested. Enter it locally in dashboard Settings; IMAP falls back to SMTP
password. Display name remains DrinksHarbour Technologies.
Email and LinkedIn disabled; sending also paused; individual approval required.
All 23 prospect signals remain proposed for the user to confirm. No sales loop,
campaign, external message or paid discovery activated by setup.

Upstream free OSM discovery did not support beverage businesses. Added six
category mappings locally. Preserve/reapply the patch and regression tests in
`docs/tenant-outreach/`. Tests: 537 passed, 22 skipped, one upstream Starlette
deprecation warning. No DrinksHarbour application code was changed.

Mailbox password/authentication and an email-verification key remain required.
Setup and restart instructions: `docs/tenant-outreach/harvey.md`.
Handoff and latest checks: `docs/superpowers/specs/RESUME-harvey.md`.

## Mailbox verification — 18 October 2026

The user saved the mailbox password in local Settings. A live provider
`test_connection()` succeeded for both SMTP and IMAP as
`business@drinksharbour.com`; this supersedes earlier password-pending notes.
No email was sent. Email remains disabled and sending paused, with individual
approval required. No supported email-verification key is configured yet.
Credentials remain only in the ignored local environment file and are not
recorded in these notes.

## Reoon verification — 18 October 2026

User saved the Reoon key locally. The account-balance API returned HTTP 200,
status success and api_status active, with 20 remaining daily credits and
100 remaining instant credits at check time. This supersedes earlier verifier-
pending notes. No contact verification credits consumed by this balance check,
and no email sent. Mailbox and AI connection checks previously passed.
Sending remains disabled and paused; individual approval required. Prospect
signals remain proposed for human confirmation before prospecting. Never
record the key in documentation or chat.

## Running state — 19 October 2026

User explicitly requested running Harvey. Restarted loopback dashboard on 5555.
Upstream dashboard Start launches python -m harvey without the required run
subcommand and exits with help. Worked around without source changes: launched
`bash scripts/harvey.sh run` detached, logs at `.local/harvey/data/harvey.log`,
PID recorded in `.local/harvey/data/harvey.pid` for dashboard monitoring/Stop.
Verified dashboard reports running and log confirms successful Codex preflight.
First cycle sleeps one hour because account utilization is 56%, exceeding the
configured 20% quota gate; this cap was preserved. Email remains disabled,
sending paused and individual approval required. Signals remain unconfirmed.
No launch-at-login service installed. Use the launcher with run to restart;
do not assume the upstream Start button works.

## Nigerian prospect research — 19 October 2026

User requested another attempt and companies in Nigeria that may need the
software. Retried live Codex usage: quota gauge unavailable, not a confirmed
remaining-limit value. Preserved quota cap, sending pause and signal governance.
Completed direct web research using official company pages and OKF's official
stockist list. Saved 10 records with source URLs, published contacts, source
quality, inferred fit, and qualification questions in
`docs/tenant-outreach/prospects/2026-10-19-nigeria.md` and CSV alongside it.

Imported all 10 through Harvey StateManager.add_company, deduplicated by domain
or stable manual external_id for the two businesses without established sites.
Read back all 10 records and verified unique IDs. These are Companies only;
no fictitious person contacts, verified emails, messages or campaigns created.
Generic email addresses are preserved in notes as unverified. Mail sending is
still disabled and paused, with individual approval required.

Prioritise Everyday Wine Shop (three Abuja outlets), Ambick (Abuja beverage/event
supply, indexed evidence), and Kosman (Port Harcourt wholesale/WhatsApp ordering).
Also saved The Drink Shop, El Vinedo, Stevenchuks, Spirits NG, Barrels, Castel Wine
and Manny Ventures. Need, budget, operating status, current software and buyer
identity are unconfirmed. Three official-site fetches failed/timed out; those
records are explicitly labelled search-index evidence for rechecking.
Supplier listings establish published stockist relationships, not buying intent.
Full source report distinguishes retrieved pages from search-index evidence.
No contact-verification credits or paid discovery used.

## Nationwide expansion — 19 October 2026

User requested more companies across Nigeria. Researched 16 additional businesses
across 13 states and five zones, without duplicating batch 1. Saved report/CSV at
`docs/tenant-outreach/prospects/2026-10-19-nigeria-expansion.*`. Six company-site
records and ten official OKF supplier-listed businesses; contacts unverified and
buying intent unknown. Jamek retrieval timed out; XO, Asia and TML source-quality
limitations recorded. No suitable North East business was added merely for coverage.
Company candidates are Mainframes, Jamek, JOACO, Asia Beverages, XO Wine, TML,
Braw, Oluwanifemi, Lamas T5, OUK, Dominion Mart, Pinnacle, Precious Drink Stores,
Iremide Wine Shop, Deemall and Kuala Lounge. Chains count once. Generic retailers
need beverage-scope qualification; venue functionality requires demonstration.
Imported through StateManager.add_company with stable domain/external_id dedup,
then read back all 16 records; total manually researched companies is 26.
No named-person contacts fabricated, no outreach, no verifier credits consumed.
Sending remains disabled and paused with individual approval required.

## Narrowed target — 19 October 2026

User now prioritises big Nigerian wine retailers without a current business-owned
website. This supersedes broad prospect research; earlier lists remain historical.
Created `docs/tenant-outreach/prospects/large-wine-retailers-without-websites.md`
with strict retail/scale/website gates, evidence and exclusions. No fully verified
match established. Saved three QUALIFICATION REQUIRED records in Harvey: Deluxe
Winery, Cappachinnos Wine Shop and Owo Resources/Mosconi and Gordiano Wines.
Scale indicators and missing/failed website evidence are explicitly provisional.
No confirmed NO_WEBSITE observations created; no messages or campaigns generated.
Verified all three records and retained sending pause. Local product_knowledge.md
now instructs future calls to qualify this narrower target before promoting leads.
Pinnacle was found to have pinnacle.shop; Everyday has a Carrd site. Both excluded
from the no-website segment. Known website-owning earlier companies also excluded.
No revenue, headcount or current branch count invented. Underlying geographic/loop
configuration was not changed; this is a research and knowledge-file update.

## Retail-scale focus reinforced — 19 October 2026

User emphasised big businesses selling wine at retail. Retained the saved
no-current-website filter; broad distributor/bar/small-shop lists remain historical.
Updated private Harvey ICP to wine shop/liquor store, evidenced retail scale,
retail/operations/IT buyers and eight Nigerian city searches. Config validates;
email disabled, approval required and sending paused. A running loop loads config
at startup; saved ICP changes take effect on restart, which was not performed here.
Added D Wine Bank Lagos as qualification-required research, with no claimed owned
website, verified scale or confirmed NO_WEBSITE signal. Do not merge its Lagos
and Abuja listings without ownership evidence. Barrels, Bottles & Glasses,
Drinks.ng and Prince Ebeano have published multiple retail locations and websites;
they are benchmarks excluded under the website filter. No fully qualified
large/no-website retailer established. See the focused prospect file for sources.

## Further scale candidates — 19 October 2026

User requested more like the established wine-retail targets. Preserved the
no-current-company-website filter. Researched and saved De Prince Supermarket,
Renee Supermarket and Westlog as QUALIFICATION REQUIRED in Harvey. All three
read back successfully; no confirmed NO_WEBSITE observations or named contacts.
Report/CSV: docs/tenant-outreach/prospects/2026-10-19-large-wine-retailers-followup.*.
De Prince's listed domain redirects to a for-sale page; replacement/parent site
still unruled out. Supplier confirms multiple De Prince locations and a wine
brand lists it. Renee's branch clues are corroborated by suppliers/directories,
and Valinno's own page lists it as a software customer: never claim it lacks POS.
Westlog's company profile describes large retail outlets; listed domain failed
retrieval, which does not establish no website. Published contacts unverified.
Kept Wine Nation/Pelssy/Guntrum and weaker scale candidates on holds; excluded
identified website owners. No messages or verifier credits; sending disabled
and paused, individual approval required. Retail size and website absence must
still be confirmed directly before treating these as fully qualified prospects.

## Beverage-only retail focus — 19 October 2026

User clarified target stores should sell mostly beverage products for now.
Created docs/tenant-outreach/prospects/target-profile.md as the current gate:
beverage-specialist retail + established scale + retained no-current-owned-site
preference. General supermarkets are excluded, not qualified merely for selling
wine. De Prince/Renee and earlier Deemall/Dominion/OUK/Pinnacle records have
explicit out-of-scope notes; no research deleted. Westlog marked hold pending
retail merchandise-mix confirmation. Updated focused reports, follow-up CSV,
README, private ICP and product knowledge. Config validation and six excluded
record readbacks passed. Existing running loop requires restart to load saved
ICP changes; no restart performed. Sending remains disabled and paused.

## Ten-city-focus candidate list — 19 October 2026

Saved `docs/tenant-outreach/prospects/2026-10-19-ten-beverage-retailers.md`
and adjacent CSV: 10 candidates, 3 Abuja / 4 Lagos / 3 Port Harcourt.
Four existing Harvey records reused; six additional records imported with stable
external IDs. Verified all 10 by ID and confirmed sending remains paused.
These are qualification candidates, not ten verified large retailers without
websites. No record clears every current gate. Current activity, retail scale,
beverage focus, identity and site status require qualification. No emails sent.

## UK research — 23 October 2026

User switched to the UK and explicitly allowed retailers with websites. Saved
`docs/tenant-outreach/prospects/2026-10-23-uk-beverage-retailers.md` and CSV;
10 company records imported/deduplicated by domain and read back. Sending paused.
UK product/payment/currency/tax suitability and software needs are unverified.
KWM scale unconfirmed; Cheers current second branch needs checking.
Updated target-profile and saved Harvey ICP/geography/product knowledge. Running
Harvey process was not restarted; new targeting applies on next config load.
Historical Nigerian records retained; no messages sent.
