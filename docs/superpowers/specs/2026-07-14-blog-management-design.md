# Blog Management (Admin CRUD + Haiku AI + DB-driven Platform Blog)

**Date:** 2026-07-14
**Status:** Approved

## Problem

The platform blog (`client/apps/platform/src/app/blog`) is fully static: 9 posts
hardcoded in `data.ts`. There is no way to create or edit posts without a code
change. We need an admin module at `client/apps/admin/src/app/(hydrogen)/blog`
that creates and manages posts, with Claude Haiku generation, and the platform
blog must render those posts.

## Decisions (user-approved)

1. **DB-driven + seed** — new `BlogPost` model/API; the 9 existing static posts
   are seeded into the DB; the platform fetches published posts from the API.
2. **AI scope** — full-article generation from a topic (title, excerpt,
   category, tags, content blocks) plus per-field regeneration (excerpt, tags,
   title suggestions). Model: Haiku via the existing Anthropic pattern.
3. **Workflow** — `draft` / `published` status; the platform shows only
   published posts.
4. **Content format** — keep the existing `ContentBlock[]` structure
   (`p | h2 | h3 | ul | ol | quote | tip`); the platform block renderer already
   exists and Haiku emits structured JSON reliably. No markdown.

## Architecture

### 1. Server (Express + Mongoose, follows banner/gemini patterns)

**Model — `server/models/BlogPost.js`**

```js
{
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, index: true },
  excerpt:     { type: String, default: '' },
  category:    { type: String, enum: ['Wine Guide','Spirits Guide','Beer Guide','Recipes','Entertaining','Lifestyle'], required: true },
  tags:        [String],
  image:       { type: String, default: '' },          // URL
  author:      { name: String, role: String, bio: String },
  content:     [{ type: { type: String, enum: ['p','h2','h3','ul','ol','quote','tip'], required: true },
                  text: String, items: [String], _id: false }],
  readTime:    { type: String, default: '' },          // e.g. "6 min read" — recomputed on save from word count (~200 wpm, min 1)
  status:      { type: String, enum: ['draft','published'], default: 'draft', index: true },
  featured:    { type: Boolean, default: false },
  publishedAt: { type: Date },                          // set on first publish
}, { timestamps: true }
```

Slug is auto-generated from the title when absent (kebab-case), de-duplicated
with a numeric suffix (`-2`, `-3`, …).

**Controller — `server/controllers/blog.controller.js`** (asyncHandler style)

Public (no auth):
- `GET /api/blog` — published only; query: `category`, `page`, `limit`
  (default 50), sorted `publishedAt` desc. Returns `{ posts, total, page, pages }`.
- `GET /api/blog/slug/:slug` — single published post or 404.

Admin (behind `authenticate` middleware, same as gemini routes):
- `GET  /api/blog/admin` — all posts, all statuses, same query params + `status`.
- `GET  /api/blog/admin/:id`
- `POST /api/blog/admin` — create (validates category/content block types).
- `PUT  /api/blog/admin/:id` — update; sets `publishedAt` on first transition to published.
- `PATCH /api/blog/admin/:id/status` — `{ status }` publish/unpublish toggle.
- `DELETE /api/blog/admin/:id`

AI (behind `authenticate`), Haiku only (`process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5'`),
reusing the Anthropic client pattern from `gemini.controller.js` (JSON-only
system prompt, fence-stripping parse, 503 when `ANTHROPIC_API_KEY` unset):
- `POST /api/blog/admin/ai/generate-post` — body `{ topic, category? }` →
  `{ title, excerpt, category, tags, image?, content, author? }`. Category is
  snapped to the enum; content block types are validated/filtered. Does NOT
  save — returns JSON for the admin form to load for review.
- `POST /api/blog/admin/ai/generate-field` — body `{ field: 'excerpt'|'tags'|'title', post }`
  (current form values) → `{ value }`.

**Routes — `server/routes/blog.routes.js`**, mounted in `server.js` as
`app.use('/api/blog', blogRoutes);` next to the banner mounts.

**Seed — `server/scripts/seed-blog-posts.js`** — contains the 9 posts ported
from the platform `data.ts` (JS literals), upserts by slug (idempotent), status
`published`, `publishedAt` = the post's `isoDate`. Run manually with
`node scripts/seed-blog-posts.js`.

### 2. Admin app — `client/apps/admin/src/app/(hydrogen)/blog`

Mirrors the banners module structure (thin pages + shared components):

- `blog/page.tsx` — PageHeader + "Add Post" button + `BlogPostsTable`.
- `blog/create/page.tsx` — PageHeader + `CreateEditBlogPost`.
- `blog/[id]/edit/page.tsx` — PageHeader + `CreateEditBlogPost` (fetches by id).

Shared components in `client/apps/admin/src/app/shared/blog/`:

- `blog-list/table.tsx` — client table: thumbnail, title, category badge,
  status badge (draft gray / published green), featured flag, date; row actions:
  edit, publish/unpublish toggle, delete (with confirm popover). Category +
  status filters. Client-side fetch from `/api/blog/admin` with auth header,
  same API-base/auth pattern as other admin tables.
- `create-edit.tsx` — the form:
  - **AI bar** at top: topic input + category select + "Generate full post with AI"
    button → calls `generate-post`, fills the entire form (review before save).
    Loading + error toast states.
  - Meta fields: title, slug (auto from title, editable), category select,
    excerpt (textarea + sparkle regen button), tags (comma/chip input + sparkle),
    image URL input with preview, featured switch, author name/role/bio.
  - **Content block builder**: ordered list of blocks; each row = type select
    (p/h2/h3/ul/ol/quote/tip) + textarea (`text`) or line-per-item textarea
    (`items` for ul/ol); add / remove / move-up / move-down controls.
  - Footer: "Save Draft" and "Publish" buttons (same create/update call with
    respective status). readTime is computed server-side.
- Wire-up: add `blog` entries to `@/config/routes` and a "Blog" item in the
  admin sidebar menu (same menu file the banners entry lives in).

### 3. Platform app — `client/apps/platform/src/app/blog`

- `data.ts` — keep `Category`, `ContentBlock`, `Post` types and
  `CATEGORY_COLORS`; delete the `POSTS` array. `Post.id` becomes `string`
  (Mongo `_id`); `date` is derived from `publishedAt` for display.
- New `client/apps/platform/src/app/blog/api.ts` — server-side fetch helpers
  using `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'`:
  `getPosts()` and `getPostBySlug(slug)`, both with
  `next: { revalidate: 300 }` and safe `[]`/`null` fallbacks on fetch failure.
- `page.tsx` — split: new server component fetches posts and passes them to the
  existing client component (current file becomes `BlogIndexClient.tsx`,
  receiving `posts` as a prop instead of importing `POSTS`). Visuals unchanged.
- `[slug]/page.tsx` — remove `generateStaticParams`; fetch by slug at request
  time (ISR 300s); `notFound()` for unknown/draft slugs. "Related posts"
  section uses the fetched list filtered by category. Visuals unchanged.

## Error handling

- AI endpoints: 503 with a clear message when `ANTHROPIC_API_KEY` is missing;
  502 with message on unparseable model output; admin form shows toast and
  leaves the form untouched on failure.
- Platform fetch failures degrade to an empty list / 404 rather than crashing.
- Slug conflicts on create/update return 409 with a message shown in the form.

## Testing (node:test, matching repo convention)

- `server/__tests__/blog.controller.test.js` (or repo's test dir convention):
  slug auto-generation + de-dup, readTime computation, public route excludes
  drafts, publish sets `publishedAt` once, category/content validation, AI
  route returns 503 without API key (no live AI calls in tests).
- Manual smoke: seed script, admin create→publish flow, platform list + detail.

## Out of scope (YAGNI)

- Image upload to storage (URL input only, matching how posts reference
  Unsplash today).
- Comments, SEO meta fields per post, author accounts, scheduling, i18n.
- Rich-text/WYSIWYG editing — the block builder covers the existing renderer.
