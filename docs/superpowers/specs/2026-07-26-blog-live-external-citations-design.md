# Live external citations for AI blog generation

**Date:** 2026-07-26
**Status:** Approved, ready for implementation planning

## Problem

AI-generated blog posts already weave in *internal* links to real catalog pages.
`buildLinkCatalog` (`server/controllers/blog.controller.js:183`) pulls approved,
published products with their category/subcategory/brand, hands the model an
allowlist of real URLs, and `sanitizeInlineLinks`
(`server/services/blog.helpers.js:95`) strips anything the model invented.

Posts carry no **outbound** links. Outbound citations to authoritative sources are
what make a drinks-guide post read as researched rather than generated, and they
carry real E-E-A-T weight. The obvious naive approach — ask the model for source
URLs — fails, because a model writing from memory produces URLs that look right
and 404.

## Goal

AI-written posts cite real external sources, and every external link that ships is
verified to resolve. Not just at write time: links that die later are removed
without anyone noticing them first.

## Non-goals

- Off-site backlink acquisition (outreach, directories, guest posts). Not
  automatable from this codebase.
- A "Sources" / references block. Citations are inline in prose only.
- Any change to internal catalog linking beyond the shared-code refactor below.

## Architecture

### One link engine

External link handling lives in a new `server/services/blog.links.js`. The
existing markdown-link machinery in `blog.helpers.js` is generalized rather than
duplicated:

- `INTERNAL_LINK_RE` (`blog.helpers.js:66`) currently matches leading-slash hrefs
  only. It is generalized to `LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g`, with one
  `extractLinks(content)` and one `sanitizeLinks(content, isAllowed)` handling
  both internal and external hrefs.
- `extractInternalLinks` and `sanitizeInlineLinks` remain exported as thin
  wrappers over the generalized versions, preserving their current behaviour and
  keeping `server/__tests__/blog.links.test.js` passing unmodified.

`blog.links.js` provides:

| Export | Responsibility |
|---|---|
| `BLOCKED_DOMAINS` | Competing retailers/marketplaces, social networks, and drinksharbour's own domains. |
| `isBlockedUrl(href)` | Host-suffix match against `BLOCKED_DOMAINS`; also rejects non-`http(s)` schemes. |
| `verifyLiveUrls(hrefs, opts)` | The only network code in the module. Returns `Map<href, {ok, status}>`. |
| `partitionExternalLinks(content)` | Splits extracted links into internal / external / blocked. |

`verifyLiveUrls` behaviour:

- `HEAD` first, falling back to `GET` on 405/501 and on any response where the
  origin rejects HEAD outright — enough CDNs and WAFs reject HEAD that
  HEAD-only checking produces false negatives.
- Follows redirects; the **final** status decides.
- 5s per-URL timeout, ~6 concurrent, deduped by normalized href.
- Short in-process TTL cache (default 6h) so the same authority URL is not
  re-fetched once per post.
- Injectable `fetchImpl` so tests never touch the network.

**Fail-closed.** Any URL not proven `2xx` inside the budget is treated as dead and
stripped. Stripping removes only the markdown markup — the anchor words stay in
the sentence, so prose reads identically whether a link survived or not. This is
what makes fail-closed safe as a default.

### Sourcing: server-side web search

`generatePost` declares Anthropic's server-side search tool:

```js
tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }]
```

Claude runs the searches on Anthropic's infrastructure and cites URLs drawn from
actual results, so there is no memory-recall step to hallucinate through. The
prompt gains an EXTERNAL CITATIONS section requiring:

- 2–4 outbound links, inline in paragraph/list/tip text, same markdown syntax as
  internal links.
- Authoritative, non-commercial sources: official producer/distillery sites,
  standards and regulatory bodies (NAFDAC, WHO), established reference works.
- Never a competing retailer or marketplace.
- Anchor text is natural words inside a sentence, never a bare URL.
- URLs must come from search results, never from memory.

#### Required fix: multi-block response reading

`callHaikuJson` returns `message.content?.[0]?.text`
(`blog.controller.js:302`). With a server-side tool declared, the response
content array leads with `server_tool_use` and `web_search_tool_result` blocks;
`content[0].text` is `undefined` and **every generation would 502**.

`callHaikuJson` must concatenate the `text` of all blocks where
`block.type === 'text'`. This is a prerequisite, not an enhancement.

`SMART_MODEL` (`blog.controller.js:25`) is unchanged and remains
env-overridable.

### Verification pipeline

`generatePost`, after parsing the model's JSON:

1. `sanitizeContentBlocks` — existing.
2. Internal-link sanitize against the catalog allowlist — existing.
3. Partition external links; drop blocked domains immediately (no request).
4. `verifyLiveUrls` on survivors, under a global ~8s budget.
5. Strip every link that did not verify.
6. Log kept/stripped counts alongside the existing internal-link log
   (`blog.controller.js:351`).

Search and verification add latency to an already slow endpoint. The global
budget bounds it; a slow verifier costs citations, never a failed request.

### Persistence

`server/models/BlogPost.js` gains:

```js
externalLinks: [{
  url: String,
  domain: String,
  httpStatus: Number,
  state: { type: String, enum: ['ok', 'dead', 'blocked'], default: 'ok' },
  lastCheckedAt: Date,
}],
linksCheckedAt: Date,
```

Derived from content on create and update, in `normalizeBody`'s callers. This is
the cron's work queue and the source for any future admin surfacing.

### Cron: keeping links live

`server/jobs/blogLinkCheck.job.js`, mirroring `bannerSchedule.job.js` in shape:
an exported async `scanBlogLinks(now)` doing the work, plus a
`startBlogLinkCheckCron()` wrapper. Registered in `server.js` inside the existing
`ENABLE_CRON === 'true' || NODE_ENV === 'production'` block (`server.js:348`),
alongside the other three jobs.

Schedule `0 4 * * 1` (weekly, Monday 04:00). It:

1. Finds published posts with at least one external link, oldest
   `linksCheckedAt` first, capped per run.
2. Re-verifies via `verifyLiveUrls` (TTL cache applies).
3. **Auto-strips** links that fail, rewriting the post content, and updates
   `externalLinks[].state` / `lastCheckedAt`.
4. Logs every strip with post slug and URL.

Auto-strip rather than flag-only: the guarantee is that no dead link is ever
live, and stripping preserves the sentence verbatim.

### On-demand citations for existing posts

`POST /api/blog/ai/citations` (admin, same auth as the other `ai/*` routes in
`server/routes/blog.routes.js`). Takes `{ post }`, runs search + verify over the
existing content, returns the revised content array. The model is instructed to
**insert links only** and change no words — the diff must be markup, not prose.
Verification is identical to `generatePost`.

Admin: a button in `client/apps/admin/src/app/shared/blog/ai-bar.tsx`, with the
service call added to `client/apps/admin/src/services/blog.service.ts`.

### Per-block hardening

`generateBlock` currently asks the model to "Preserve any Markdown links"
(`blog.controller.js:492`) with nothing enforcing it — a rewrite can silently
invent or mangle a URL. After parsing:

- Extract links from the input block and from the output.
- Strip any output link whose href was not present in the input.
- Re-verify any surviving external link.

No search, so this stays cheap and fast.

### Rendering

Both renderers use a regex matching leading-slash hrefs only —
`client/apps/platform/src/app/blog/blog-content.tsx:11` and
`client/apps/admin/src/app/shared/blog/blog-preview.tsx:14`. An external link
would render as the literal string `[text](https://…)`.

Both are extended to match `https?://` hrefs and render them as
`<a href target="_blank" rel="noopener noreferrer">` with a small trailing
external-link icon, styled consistently with the existing internal-link
treatment. Internal links keep using `next/link`.

No `rel="nofollow"` — these are deliberate citations to authorities, which is an
E-E-A-T positive.

## Testing

`node:test`, matching `server/__tests__/`.

- `verifyLiveUrls` against an injected fetch: 200, 301→200, 301→404, 404, timeout,
  HEAD-rejected-then-GET-200. Asserts dedupe and cache hits.
- `isBlockedUrl`: blocked host, blocked subdomain, lookalike host that must *not*
  match, non-http scheme.
- `sanitizeLinks` fail-closed: unverified external link becomes plain anchor text
  with the sentence otherwise byte-identical.
- Generalized helpers: existing `blog.links.test.js` passes unchanged.
- `callHaikuJson` text extraction from a mocked tool-use response
  (`server_tool_use` + `web_search_tool_result` + two `text` blocks).
- `generateBlock` link hardening: link absent from input is stripped from output.
- `scanBlogLinks` against a stubbed model: dead link stripped from content,
  `externalLinks` state updated, healthy post untouched.

## Risks

- **Search cost and latency.** Server-side search is billed per search and adds
  seconds to `generatePost`. Bounded by `max_uses: 5` and the verification
  budget.
- **False-dead verification.** Sites that block datacenter IPs or bot user-agents
  can return 403 and lose a legitimate citation. Mitigated with a browser-like
  User-Agent and GET fallback; accepted otherwise, since fail-closed costs a link
  and fail-open costs a 404.
- **Cron editing published content.** Bounded to removing markup from links that
  are provably dead, and every strip is logged.
