---
title: Harvey customer acquisition setup
updated: 2026-10-18
status: integrations-verified-outreach-paused
---

# Harvey for DrinksHarbour

Local installation: `.local/harvey/`, upstream `ethanplusai/harvey`, revision
`e114e95471b1bf155454fca108f0730b66a47a01`. Keep the checkout, environment,
credentials and prospect data out of DrinksHarbour Git history.

## Files

- `.local/harvey/harvey.local.yaml`: DrinksHarbour positioning, Abuja targeting,
  channels, subscription provider and Africa/Lagos business hours.
- `.local/harvey/skills/product_knowledge.md`: product facts and sales boundaries.
- `.local/harvey/skills/competitive_intel.md`: evidence boundaries for comparisons.
- `.local/harvey/.env`: mailbox and optional discovery/verifier credentials.
- `.local/harvey/data/`: Harvey's own local pipeline state; never application data.
- `scripts/harvey.sh`: launch Harvey from any working directory.
- `docs/superpowers/specs/RESUME-harvey.md`: verification and remaining setup.


## Current target (supersedes initial operating target)

Established Nigerian wine retailers with corroborated scale and no current
business-owned website. See `prospects/large-wine-retailers-without-websites.md`.
Current candidates are qualification-required, not verified matches. Earlier
broad lists do not establish eligibility; sending remains paused.

## Initial operating rules

Target beverage shops and licensed adult hospitality businesses in Abuja.
The objective is a reply leading to a 20-minute product demonstration.
Use published business contact details. Do not invent identities, prospect pain
points, competitor claims, revenue outcomes or production availability.
Prices come from `server/config/erm-plans.js`; specialist features require a demo.

Claude's saved login is present, but a live check reports that the organization
disabled Claude Code subscription access. Use a separate Codex CLI 0.159.3 in
`.local/harvey-codex/` with model `gpt-6.1-sol` and low reasoning. The documented
upstream example `gpt-5.5` is absent from this account's catalogue; preflight
confirmed `gpt-6.1-sol` is available and tool-free. The launcher adds only that
private runtime to Harvey's PATH.
The desktop Codex version is not in Harvey's allowlist; do not downgrade it or
modify the user's Codex configuration. The runtime, login, isolation and model
preflight passed. After updating Harvey, rerun `status --check` before use.
No website-based training is needed: local product documentation is the source.

Sending starts disabled and paused, with approval required for every message.
Connecting a mailbox requires the user's sender identity, provider and credentials
or OAuth login. Never paste credentials into chat or reuse transactional email
credentials from the DrinksHarbour backend. LinkedIn remains disabled.
Signal choices remain proposed until the user confirms them in the dashboard.
Starting outreach or a recurring sales loop requires explicit user direction.

## Local discovery adjustment

Upstream's free OpenStreetMap discovery maps trades only. Add beverage/hospitality
category mappings locally and preserve the patch as `harvey-beverage-categories.patch`
beside this file. Reapply it after recreating the checkout, copy the adjacent
`harvey-beverage-categories.test.py` to `tests/test_drinksharbour_categories.py`
in the checkout, then run Harvey's tests.
Map coverage is an incomplete lead source; no results is not proof of no demand.

## Commands

```sh
bash scripts/harvey.sh status --check
bash scripts/harvey.sh dashboard --host 127.0.0.1 --port 5555
bash scripts/harvey.sh signals
bash scripts/harvey.sh discover --estimate --max-spend 0
```

Recreate the private Codex runtime with:
`npm install --prefix .local/harvey-codex --no-audit --no-fund @openai/codex@0.159.3`.
Use the launcher for all Harvey commands so it finds the supported runtime.
The dashboard is bound to loopback only. It runs while its local process and
this Mac remain active; no login service or scheduled campaign was installed.

## Confirmed mailbox settings

The user's screenshot supplied `business@drinksharbour.com`, incoming
`premium356.web-hosting.com:993`, outgoing `premium356.web-hosting.com:465`.
Configured provider `smtp`, sender/SMTP/IMAP username `business@drinksharbour.com`,
SMTP implicit TLS on 465 and IMAP SSL on 993. Harvey supports these settings.
Sender display name remains DrinksHarbour Technologies.

Enter the mailbox password in the local dashboard's Settings → SMTP + IMAP
Password field, click Save SMTP, then ask for a connection check. IMAP falls back to the SMTP
password when `IMAP_PASSWORD` is blank. No password was supplied in the screenshot;
authentication is untested. Add a supported email verifier before outreach;
guessed addresses cannot receive mail. Keep approval enabled and sending paused.

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

Current saved ICP: established wine retail businesses with evidenced scale and
no current company-owned website. Research and caveats are in
`prospects/large-wine-retailers-without-websites.md`. Prior general distributor
and venue batches are historical. Saved ICP changes require a loop restart.

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
