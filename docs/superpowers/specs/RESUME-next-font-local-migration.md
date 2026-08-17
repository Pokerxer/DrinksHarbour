# RESUME — migrate admin fonts from next/font/google to next/font/local

**Why:** the Vercel build for `038c3953` failed with
`Failed to fetch 'Fraunces' from Google Fonts` in
`src/app/shared/contacts/contacts-fonts.ts`. `next/font/google` fetches the
`.woff2` from `fonts.gstatic.com` at BUILD time, so any blip on the builder
fails the whole deploy. All three retries failed within 0.6s of each other —
a blocked connection, not a slow download. **The commit itself is fine; it
builds clean locally.** A plain redeploy will most likely go green; this
migration is the permanent fix.

## The four declaration files

```
src/app/fonts.ts                          Inter + Lexend_Deca, subsets latin, variable
src/app/shared/purchases/purchases-fonts.ts   Fraunces  ┐
src/app/shared/contacts/contacts-fonts.ts     Fraunces  ├─ all three IDENTICAL
src/app/shared/employees/employees-fonts.ts   Fraunces  ┘
```

The Fraunces three are byte-identical apart from the comment:

```ts
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
```

**Do not write three local declarations.** Three `next/font/local` calls over
the same files produce three separate font instances and three copies to keep
in sync — the same trap `shiftWindowLabel()` was extracted to close. Put ONE
declaration in a shared module and have the three `*-fonts.ts` files re-export
it, so every call site (`import { fraunces } from './employees-fonts'`) keeps
working untouched.

## The font URLs, already resolved

Fetch the CSS with a **desktop Chrome UA** or Google serves TTF instead of
woff2. Fraunces and Inter are both variable fonts, so one file covers the whole
weight range — declare `weight: '100 900'` in `next/font/local`, not four
separate weights.

Fraunces v38, latin subset, variable, normal:
```
https://fonts.gstatic.com/s/fraunces/v38/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeP2Xz5c.woff2
```
Get the matching **italic** (`ital` axis = 1) and the **Inter** / **Lexend Deca**
latin variable files the same way:
```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&display=swap"
```
Take the URL under the `/* latin */` comment — NOT `latin-ext`.

## Where to put the binaries

`src/fonts/*.woff2` — **not** `src/app/fonts/`. A folder inside the app router
is a route segment; keep binaries out of it. Note `src/app/fonts.ts` already
exists as a file, so a sibling `src/app/fonts/` directory is also confusing.

## Licence

Fraunces, Inter and Lexend Deca are all SIL Open Font License. Committing the
`.woff2` files is fine; include the OFL text next to them.

## Verification gates (all must hold)

- `npx vitest run` → **760/760**, 39 files
- `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"` → **453**
  (`npx tsc` installs a DECOY that exits 0 without checking anything — never use it)
- `npm run build` completes
- **Visual check required.** Vitest is `environment: 'node'` with no jsdom, so
  nothing here can be proven by a test. Render a page that uses Fraunces
  (`/employees/attendance`, `/contacts`, `/purchases`) and confirm the headings
  are still the serif and not a fallback. The smoke-route trick gets a gated
  page to render without login: a route OUTSIDE the path-list matcher in
  `src/middleware.ts` (e.g. `src/app/smoke-x/page.tsx`), curl it, then DELETE
  it — it must never be committed.

## Do not stage

`kiosk-devices-page.tsx` and `kiosk-device-utils.test.ts` are dirty from
unrelated work. Never `git add` that directory broadly.
