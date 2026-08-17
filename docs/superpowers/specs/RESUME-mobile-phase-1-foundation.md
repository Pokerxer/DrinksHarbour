# RESUME — Mobile Phase 1 Foundation

**Written:** 2026-08-16
**Last updated:** 2026-08-16 (session 2 — export root cause found)
**Branch:** `feat/mobile-phase-1-foundation` (off `main` at `038c3953`)
**Nothing is pushed. Nothing is committed from session 2.**

---

## Paste this into the new session

> Continue the React Native mobile foundation work in
> `/Users/mac/Documents/drinksharbour`.
>
> **Read these first, in order:**
> 1. `docs/superpowers/specs/RESUME-mobile-phase-1-foundation.md` — this file.
>    Section "STATE AT HANDOFF" is the only thing that is uncertain; everything
>    else is settled.
> 2. `.superpowers/sdd/progress.md` — the ledger. Authoritative for Tasks 1–7.
>    **Its section "OPEN — the Expo bundle no longer builds" is now WRONG** and is
>    corrected below. Do not act on that section.
> 3. `docs/superpowers/plans/2026-08-15-mobile-phase-1-foundation.md` — the plan
>    that was executed. Contains known-wrong steps; the ledger lists the
>    corrections. Trust the ledger over the plan.
> 4. `docs/superpowers/specs/2026-08-15-platform-react-native-app-design.md` —
>    the approved design for all 7 phases.
>
> **All 7 Phase 1 tasks are committed. Do not re-run any of them.**
>
> **First action: determine whether `pnpm install --force` in `client/`
> finished, and whether `npx expo export` still works.** A previous session
> started that install to make an `expo export` fix permanent and the session
> ended while it was still running. Run the two commands in "STATE AT HANDOFF"
> and report what you find before doing anything else.
>
> Do not commit or push unless I ask in that turn.

---

## STATE AT HANDOFF — the one uncertain thing

A `pnpm install --force` was launched in `client/` at the end of session 2 and
**was still running when the session ended.** Its outcome is unknown. It may
have completed, been killed, or left the tree partially rewritten.

**Run these two, in order, before anything else:**

```bash
cd /Users/mac/Documents/drinksharbour/client
# 1. Is the hoist dir populated? All of these must print YES.
for p in core template traverse types parser generator code-frame; do
  printf "@babel/%-12s %s\n" "$p" \
    "$(test -e node_modules/.pnpm/node_modules/@babel/$p && echo YES || echo NO)"
done

# 2. The real test.
cd apps/mobile && npx expo export --platform ios --platform android
```

Expected success: `3.76 MB` Hermes bundle per platform, `Exported: dist`.

### Three possible outcomes

| What you see | What it means | What to do |
|---|---|---|
| All YES, export builds | `--force` rebuilt the hoist dir. **Fixed with zero committed config.** | Update the ledger, delete this uncertainty section. Done. |
| Some NO, export fails | pnpm declines to hoist those multi-version `@babel` packages even on a clean rebuild. The workaround below is required permanently. | **Ask the user before writing to `client/.npmrc`.** They chose `--force` specifically to avoid committing config. |
| Install was interrupted mid-write | Tree may be inconsistent. | Re-run `pnpm install --force` to completion first, then retest. |

### The manual workaround (proven to work, currently temporary)

If you need the export working immediately, this restores it without touching
any repo file. Run from `client/node_modules/.pnpm`:

```bash
for d in @babel+*@7.*; do
  name=$(echo "$d" | sed 's/^@babel+//; s/@7\..*$//')
  [ -e "node_modules/@babel/$name" ] && continue
  best=$(ls -d @babel+${name}@7.* 2>/dev/null | sort -V | tail -1)
  [ -z "$best" ] && continue
  [ -d "$best/node_modules/@babel/$name" ] || continue
  ln -s "../../$best/node_modules/@babel/$name" "node_modules/@babel/$name"
done
```

It creates ~11 symlinks. **This is a diagnostic, not a fix** — any future
`pnpm install` wipes it, and nothing records that the tree depends on it.
Never leave it as the answer.

---

## SOLVED in session 2 — the export failure

**The ledger's diagnosis was wrong, and so was the question it posed to the
user.** Both are corrected here. The ledger section "OPEN — the Expo bundle no
longer builds" should be read as superseded.

### What the ledger claimed

That the cause was structural: Expo's toolchain relies on undeclared transitive
deps, pnpm's strict layout exposes them one at a time, declaring them does not
converge, and therefore the user must choose between a **workspace-wide hoisting
setting** (changing dependency resolution for `apps/admin` and `apps/platform`,
both in production) or **moving `apps/mobile` to its own lockfile/repo**.

### What it actually is

**A corrupt `node_modules`, diverged from the committed lockfile.**

The missing modules were absent from `client/node_modules/.pnpm/node_modules/` —
the directory pnpm populates *by default* (`hoist-pattern=['*']`) precisely so
that undeclared transitive requires still resolve. Every missing package was
**already in the committed lockfile and already on disk in the store**; only the
hoist entries were gone.

The gap was `@babel/core`'s own dependency set: `traverse`, `types`, `parser`,
`generator`, `code-frame`, `template`, plus `helper-module-imports`,
`helper-string-parser`, `helper-validator-identifier`, `helper-globals`,
`runtime`.

**`@babel/core` present in the hoist dir while its own declared dependencies are
missing is not a state a clean install can produce.** That is the proof it was
corruption, not design.

### Two things the ledger got wrong, and why they matter

1. **Declaring the packages in `apps/mobile/package.json` could never have
   worked.** The consumer is Expo's own toolchain running under Node from inside
   `.pnpm/` — see the require stack, which is rooted at
   `@expo+metro-config@0.19.12/.../collect-dependencies.js`. That code never
   reads the app manifest, and `metro.config.js` cannot influence it either
   (this is Node's CJS `require`, not Metro's bundler resolution of app source).
   The approach failed because it targeted the wrong layer — **not** because the
   chain was infinite.
2. **`pnpm install --frozen-lockfile` legitimately could not recover it.** pnpm
   short-circuits against the hidden lockfile at `node_modules/.modules.yaml`
   (stamped 21:22 against `pnpm-lock.yaml`'s 21:20) and never rebuilds the hoist
   dir. `--force` is the flag that ignores it. The ledger correctly observed the
   failure and drew the wrong conclusion from it.

### Verified

With the hoist gaps filled, `npx expo export --platform ios --platform android`
produces **3.76 MB Hermes bundles for both platforms** — the exact figure the
ledger recorded at Task 5. No repo file was changed to achieve this.

### Confirmed upstream bug, unrelated to pnpm

`@expo/metro-config@0.19.12` requires `@babel/template` and `@babel/traverse` at
runtime but declares neither — its `dependencies` list has only
`@babel/core`, `generator`, `parser`, `types`. That is a real Expo defect. pnpm's
default hidden hoisting already compensates for it; the tree just wasn't in that
default state.

### Loose end

An orphan `client/node_modules/.pnpm/@babel+template@8.0.0` is on disk,
referenced by nothing in `pnpm-lock.yaml` — residue from the reverted
`@babel/helper-module-imports@^8` experiment described in the ledger. A completed
`--force` install should prune it. If it survives, it is inert but worth
removing.

---

## DECIDED 2026-08-16 by the user — do not reopen

**`apps/mobile` stays in the pnpm workspace.**

Both options the previous session posed are moot, because neither addresses the
actual cause:

- **No workspace-wide hoisting setting.** `shamefully-hoist` / `node-linker=hoisted`
  is not needed. `apps/admin` and `apps/platform` are untouched.
- **No separate lockfile or repo for mobile.** `commerce-core` stays a
  `workspace:*` dependency.

The user chose `pnpm install --force` over committing an `.npmrc` pattern
specifically to end with **zero committed config**. If the force install turns
out not to hold, **ask before writing to `client/.npmrc`** — do not assume the
fallback is pre-approved.

---

## Context

### Commits on this branch

| Commit | What |
|---|---|
| `4b5ff894` | Task 1 — `commerce-core` package, six modules moved, 17 platform importers rewritten. **Reviewed clean.** |
| `571bf40e` | Task 2 — `categories.ts` moved onto injected config. **Reviewed.** |
| `a56ed42e` | Task 2 fix — test-only reset removed from the public barrel |
| `73991408`, `89311636`, `715862d7` | **NOT THIS PLAN.** POS / sub-product image work from a concurrent session, ~7,000 lines in `client/apps/admin/**` and `server/`. User decided to leave them and separate at merge time. Any whole-branch review must exclude them. |
| `9f5e5876` | Task 3 — Expo app scaffold |
| `9c97c6b2` | Task 4 — NativeWind on the shared theme tokens |
| `60ab04e9` | Task 5 — four-tab shell |
| `446f77ca` | Task 6 — keychain session store, 6/6 TDD |
| `308d8d39` | Task 7 — Bearer API client with single-flight refresh, 10/10 TDD |

Tasks 1 and 2 had independent subagent review. **Tasks 3–7 did not** — executed
directly by the controller after the user switched approach on cost grounds. A
whole-branch review has never run.

### Green — all four re-verified in session 2, independently

```bash
cd client/packages/commerce-core && node --experimental-strip-types --test src/*.test.mjs   # 49/49
cd client/apps/mobile && pnpm test                                                          # 16/16
cd client/apps/mobile && ./node_modules/.bin/tsc --noEmit                                   # exit 0
cd client/apps/platform && pnpm build                                                        # exit 0
```

Run mobile's tests from `apps/mobile` — `npx vitest` at the repo root sweeps in
admin's 200+ test files. Use `./node_modules/.bin/tsc`, never `npx tsc`: the
latter installs a decoy `tsc@2.0.4` that prints a joke and exits 0.

### Still open — platform tsc drifted 28 → 41

13 spurious `next/dynamic` TS2345 errors from **two copies of the React 19 types**
(`19.2.10` and `19.2.11`) in one program. Not caused by this branch's source —
proven by reverting `layout.tsx` (still 41) and by removing the tsconfig flag
(worse, 50). `pnpm build` succeeds and `ignoreBuildErrors: true` is set, so
nothing is blocked from shipping. A range-scoped pnpm override was tried, did not
dedupe, and was reverted.

**Worth retesting after the `--force` install** — a full dependency rebuild may
have deduped the types as a side effect. Measure with:
`./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`

### Decisions already made — do not reopen

- Full parity with the web storefront (all 52 routes), iOS **and** Android.
- Native core + in-app WebView for 11 content/legal routes.
- Push notifications and biometric unlock in scope; offline browsing is not.
- Match the web visual design closely.
- Tasks 3–7 executed without per-task review, on cost grounds.
- The three POS commits stay on the branch; separate at merge time.
- `apps/mobile` stays in the pnpm workspace (2026-08-16, see above).

### Verification gap that still stands

**This machine has no iOS simulator (0 available devices) and no Android SDK.**
Nothing about rendering, NativeWind styles visibly applying, tab navigation, or
Android hardware-back has ever been confirmed. Only bundle-level verification is
possible here. That check must happen on a real device before Phase 1 is called
done.

### What comes after Phase 1

Phase 2 is auth (login, register, MFA, password reset, verify-email, SecureStore
wiring, biometric unlock). Design doc section 11 has all seven phases. Phase 1
gates everything; Phases 3 and 5 can run in parallel once Phase 2 lands.
