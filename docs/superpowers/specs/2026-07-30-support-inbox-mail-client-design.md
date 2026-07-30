# Support Inbox → Real Mail Client

**Date:** 2026-07-30
**Route:** `/support/inbox` (admin app)
**Status:** Design approved, not yet implemented

## Problem

`/support/inbox` is untouched Hydrogen template. Three components
(`message-list.tsx`, `message-details.tsx`, `inbox-tabs.tsx`) read a 1111-line
demo array at `src/data/support-inbox.ts`, shaped as support *tickets*
(Open/Closed, priority, category, Chat/Email) rather than email. Nothing exists
server-side: no inbox model, no IMAP dependency, no mail routes.

The goal is to read and send real mail from this page.

## Verified facts

IMAP is live and reachable from this machine using the credentials already in
`server/.env`:

```
host: premium356.web-hosting.com:993 (Dovecot, implicit TLS)
user: orders@drinksharbour.com  (SENDER_EMAIL_ADDRESS / MAIL_PASSWORD)
folders: INBOX, INBOX.Sent, INBOX.Drafts, INBOX.Archive,
         INBOX.Junk, INBOX.spam, INBOX.Trash
hierarchy separator: "."
capabilities include: MOVE, UIDPLUS, SORT, THREAD=REFERENCES, ESEARCH,
                      CONDSTORE, SPECIAL-USE, IDLE
```

SMTP on the same host is already in production use by `services/email.service.js`.

Available in-repo: `nodemailer` ^8, `multer` ^2, `react-quill-new` ^3.4.6.
Not available: any IMAP client, any MIME parser, any encryption helper.

Only the three inbox components import `data/support-inbox.ts`, so it can be
deleted outright.

## Decisions

| Question | Decision |
|---|---|
| Which mailboxes | Platform accounts from env (admin) **and** per-tenant mailbox config (tenants) |
| Product model | Mail client — folders, threads, compose. Not a ticket queue |
| Storage | **Live IMAP proxy. No mail persisted in Mongo, ever** |
| Compose scope | Full: rich text, To/Cc/Bcc, attachments both directions |

The live-proxy decision is load-bearing: what the page shows is always exactly
what is in the mailbox, actions taken here are real IMAP operations visible in
Roundcube/Outlook, and no customer email content accumulates in the database.

## Staging

**Stage 1** — server mail module, platform accounts from env, full inbox UI.
Independently shippable; the super_admin has a working mailbox today.

**Stage 2** — `tenant.mailSettings`, encrypted credential storage, Mail section
in tenant Settings. Purely additive; plugs into the stage-1 resolver with no UI
rework.

**Accepted liability:** stage 2 means DrinksHarbour stores tenants' mail
passwords. Encrypted at rest with AES-256-GCM, but a leaked
`MAIL_ENCRYPTION_KEY` plus a DB dump reads every tenant's customer email. This
is how helpdesk products conventionally work and the user accepted it
explicitly. Mitigation: document that tenants should supply an app-specific
password, not their primary mailbox password.

## Server architecture (stage 1)

New dependencies: `imapflow` (promise-based IMAP, nodemailer author),
`mailparser` (RFC822 → html/text/attachments).

### Files

| File | Responsibility |
|---|---|
| `server/services/mailAccount.service.js` | The **only** place credentials are read. `resolveAccount(user, accountId)` → `{imap, smtp, address, displayName}` or throws 403. `listAccounts(user)` → permitted accounts, credentials stripped |
| `server/services/imap.service.js` | Connection pool + IMAP verbs: folders, envelope paging, fetch body, flags, move, delete, append, search. Knows nothing about HTTP or users |
| `server/services/mailSend.service.js` | Per-account nodemailer transport (cached), builds MIME, sends, APPENDs result to the account's Sent folder |
| `server/controllers/mail.controller.js` | HTTP surface |
| `server/routes/mail.routes.js` | Route table + middleware |

`services/email.service.js` is **not** modified. It is the transactional
system-mail path (order confirmations) with a single env-bound transporter and
different concerns. Entangling the two would couple customer support mail to
order-confirmation delivery.

### Routes

All behind `protect` + `attachTenant`.

```
GET    /api/mail/accounts
GET    /api/mail/:accountId/folders
GET    /api/mail/:accountId/messages?folder=&page=&limit=&search=
GET    /api/mail/:accountId/messages/:uid?folder=
GET    /api/mail/:accountId/messages/:uid/attachments/:partId?folder=
POST   /api/mail/:accountId/messages/flags     { uids[], folder, add[], remove[] }
POST   /api/mail/:accountId/messages/move      { uids[], folder, to }
DELETE /api/mail/:accountId/messages?folder=&uids=
POST   /api/mail/:accountId/send               multipart
POST   /api/mail/:accountId/drafts
```

`POST /send` body: `to, cc, bcc, subject, html, inReplyTo, references, files[]`.

### Authorization

`accountId` is an **opaque handle**, re-validated against the caller's permitted
set on every request. This follows the `requireOwnTenant` rule already
established in this codebase:

- The client never sends a host, username, or password.
- There is no `?host=` / `?imapHost=` pivot parameter.
- A tenant admin requesting an account id outside their tenant gets 403 from the
  resolver, before any connection is opened.
- No super_admin bypass that would let one tenant's mail be read from another
  tenant's context.

### Connection handling

IMAP is stateful — one command in flight per connection. One lazily-opened
`ImapFlow` client per account, commands serialized via `getMailboxLock()`,
idle-closed after ~5 minutes. A ~30s in-memory envelope cache keyed by
`(accountId, folder, page, search)`, invalidated on any mutation from this
process. No persistence anywhere.

### Env for platform accounts

Account 1 is the existing config, so this works with no new env:

```
MAIL_HOST, MAIL_PORT, MAIL_SECURE, SENDER_EMAIL_ADDRESS, MAIL_PASSWORD
```

Additional accounts use indexed vars; host/port inherit from the defaults when
omitted:

```
MAIL_ACCOUNT_2_ADDRESS=support@drinksharbour.com
MAIL_ACCOUNT_2_PASSWORD=...
MAIL_ACCOUNT_2_DISPLAY_NAME=DrinksHarbour Support
MAIL_ACCOUNT_2_IMAP_HOST=      # optional
MAIL_ACCOUNT_2_IMAP_PORT=      # optional
MAIL_ACCOUNT_2_SMTP_HOST=      # optional
MAIL_ACCOUNT_2_SMTP_PORT=      # optional
```

Adding an account is env-only, no code change.

## Client architecture

### Routes

`/support/inbox` — three-pane view.
`/support/inbox/[id]` — mobile deep-link, where `id` is `base64url("<folder>|<uid>")`.
`config/routes.ts` keeps its existing helpers unchanged.

### Components (`app/shared/support/inbox/`)

| File | Job |
|---|---|
| `use-mail.ts` (new) | All data access over `lib/api-client.ts`. The only file that knows endpoint shapes |
| `folder-rail.tsx` (new) | Account switcher + IMAP folders with unread counts |
| `message-list.tsx` (rewrite) | Envelope list, search, paging, multi-select, bulk archive/delete/mark-read. Retains the existing skeleton loader and visual language |
| `message-view.tsx` (new, replaces `message-details.tsx` + `message-body.tsx`) | Reading pane: headers, attachment chips, sandboxed body, Reply / Reply All / Forward |
| `compose-drawer.tsx` (new) | `react-quill-new` editor, To/Cc/Bcc chips, file attach, send / save draft. One component seeded with different defaults serves compose, reply, and forward |

### Deleted

- `src/data/support-inbox.ts` (1111 lines)
- `app/shared/support/inbox/inbox-tabs.tsx`
- `app/shared/support/inbox/action-dropdown.tsx`
- `app/shared/support/inbox/create-folder.tsx`
- `app/shared/support/inbox/message-details.tsx`, `message-body.tsx` (superseded)

The page header's **Create Ticket** button becomes **Compose**. `back-button.tsx`
is retained.

### Body rendering

Customer HTML is hostile by default. Two independent layers:

1. **Server-side sanitization** — strip `<script>`, event handlers, `<base>`,
   form elements, and `javascript:` URLs.
2. **Sandboxed `<iframe srcdoc>`** — `sandbox="allow-popups
   allow-popups-to-escape-sandbox"`. No `allow-scripts`, no `allow-same-origin`,
   so the body cannot reach the admin DOM, cookies, or session.

Remote images stripped on first render with a **"Show remote images"** toggle,
so opening a message does not fire tracking pixels or leak the reader's IP.
Links rewritten to `target="_blank" rel="noopener noreferrer"`.

### Threading

Messages group by `References` / `In-Reply-To` chain within a folder, with
normalized-subject fallback (strip `Re:`/`Fwd:` prefixes, case-insensitive).
Outgoing replies set `In-Reply-To` to the parent's `Message-ID` and append it to
`References`, so replies thread correctly in the recipient's client.

## Error handling

Silent failure is the specific failure mode this repo has already been burned by
— prod SMTP was rejecting every send for days while the code logged success. No
error path here may present as an empty or successful state.

| Condition | Behavior |
|---|---|
| IMAP auth rejected | 502; UI shows "the mailbox rejected the configured credentials". Never an empty inbox |
| IMAP unreachable / timeout | Distinct error state with Retry action. Never an empty inbox |
| Send failure | Compose drawer stays open, draft intact, SMTP error shown. Never a success toast |
| Stale UID (moved/deleted elsewhere) | 404 handled as "no longer in this folder", list refreshes |
| Attachment over cap | Rejected client-side before upload with the size stated |

## Security invariants

Each is a test, not just a note.

1. Credentials never reach the client. `GET /api/mail/accounts` returns
   `{id, address, displayName, scope}` only.
2. Every request re-validates `accountId` against the caller; cross-tenant
   access is 403 before any connection opens.
3. Attachments stream through the server. Nothing written to disk or Cloudinary.
   Outgoing total capped at 15 MB.
4. Body HTML sanitized server-side **and** sandboxed client-side.
5. `DELETE` moves to Trash. It hard-expunges only when the message is already in
   Trash — no single action destroys mail irrecoverably.

## Testing

Repo convention: `node --test '__tests__/*.test.js'` from `server/`. Current
baseline **742/745** (3 known pre-existing failures: 1 pricelist populate, 2
SO-number). No new failures permitted.

- `mailAccount.service` — account resolution and the cross-tenant 403. Pure
  unit, stubbed models. Security-critical surface.
- Envelope mapping and reply-header construction (`In-Reply-To` / `References`)
  against RFC822 fixtures. No network.
- Sanitizer — script tags, event handlers, and remote images stripped.
- Controller tests against a fake IMAP client.

No live-network tests in the suite. Real-mailbox verification is a manual
browser smoke at the end of stage 1: list INBOX, open a message with an
attachment, download it, reply, confirm the reply lands in `INBOX.Sent` and
threads in the recipient's client.

## Stage 2 detail

- `tenant.mailSettings` subdoc: `address, displayName, imapHost, imapPort,
  imapSecure, smtpHost, smtpPort, smtpSecure, username, passwordEnc, enabled`.
- `server/utils/crypto.js` — AES-256-GCM encrypt/decrypt keyed by
  `MAIL_ENCRYPTION_KEY`. Does not exist yet; no encryption helper is in the repo.
- Settings UI section with a **Test Connection** button that verifies IMAP login
  *and* SMTP `verify()` before the settings are allowed to save. Configuration
  that silently doesn't work is the same failure mode as a silent send failure.
- Writes must go through `flattenForUpdate`. A bare
  `$set: { mailSettings: {...} }` replaces the entire subdoc — this has already
  caused a production bug in this codebase (commit a9355c5c).
- Password is write-only over the API: never returned, and an empty submitted
  value means "unchanged", not "clear".
