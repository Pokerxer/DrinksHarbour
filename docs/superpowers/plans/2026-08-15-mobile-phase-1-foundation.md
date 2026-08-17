# Mobile Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Expo app in the existing monorepo with a working tab shell and an authenticated API client, and extract the shared commerce logic into a package both the web and mobile apps import.

**Architecture:** Two new workspace members. `packages/commerce-core` holds framework-free commerce rules, moved out of `apps/platform/src/lib` so one copy serves both apps. `apps/mobile` is an Expo app using expo-router for file-based routing and NativeWind so the existing Tailwind theme tokens carry over. Mobile authenticates with `Authorization: Bearer` — a path the Express backend already supports — and stores tokens in the device keychain.

**Tech Stack:** Expo SDK 52+, expo-router, NativeWind 4, expo-secure-store, TypeScript, pnpm workspaces, Turborepo, `node:test` for the shared package.

## Global Constraints

- Workspace is pnpm with `packages: ["apps/*", "packages/*"]` — declared in `client/pnpm-workspace.yaml`. All commands run from `client/` unless stated otherwise.
- Shared-package tests run with `node --experimental-strip-types --test` and import `.ts` files directly. This is the existing convention in `platform/src/lib/*.test.mjs` — preserve it.
- `apps/platform/next.config.js` sets `typescript: { ignoreBuildErrors: true }`. **`next build` will NOT catch type errors.** Every task that changes platform code must run `npx tsc --noEmit` explicitly.
- Mobile reads its API base from `EXPO_PUBLIC_API_URL`. Web reads `NEXT_PUBLIC_API_URL`. `packages/commerce-core` must read **neither** — the base URL is injected by the host app.
- Mobile sends `Authorization: Bearer <token>`. It must never send `credentials: 'include'` and must never handle CSRF tokens — `server/middleware/csrf.middleware.js:88` waives CSRF for Bearer requests.
- Auth tokens go in `expo-secure-store` only. Never `AsyncStorage`.
- The refresh endpoint is `POST /api/users/refresh-token` (verified at
  `server/routes/user.routes.js:289`). It accepts `{ refreshToken }` in the body
  (`user.controller.js:502`) and returns `{ data: { token, refreshToken } }`. It
  is **rate-limited to 30 requests per IP per 15 minutes**
  (`user.routes.js:46-51`) — a second reason concurrent refreshes must be
  collapsed into one.
- Commits in this plan are **local only**. Nothing is pushed without an explicit request.

---

## File Structure

**New — `client/packages/commerce-core/`**

| File | Responsibility |
|---|---|
| `package.json` | Workspace manifest; exports raw TS from `./src/index.ts` |
| `tsconfig.json` | Extends `typescript-config/base.json` |
| `src/index.ts` | Public barrel — the only import surface consumers use |
| `src/config.ts` | Holds the injected API base URL for the modules that fetch |
| `src/pack-pricing.ts` | Pack pricing rules (moved) |
| `src/cart-line.ts` | Cart line id pairing (moved) |
| `src/first-order-perk.ts` | First-order delivery perk (moved) |
| `src/commerce-policy.ts` | Shipping and return policy constants (moved) |
| `src/default-variant.ts` | Default size/variant selection (moved) |
| `src/validation.ts` | Email/password/phone validation (moved) |
| `src/categories.ts` | Category fetch + tree helpers (moved, refactored in Task 2) |
| `src/*.test.mjs` | Existing node:test suites (moved alongside) |

**New — `client/apps/mobile/`**

| File | Responsibility |
|---|---|
| `package.json`, `app.json` | Expo manifest and config |
| `babel.config.js`, `metro.config.js` | NativeWind + monorepo resolution |
| `tailwind.config.js` | Extends the shared `tailwind-config` theme |
| `global.css` | Tailwind directives for NativeWind |
| `app/_layout.tsx` | Root layout; injects the API base into commerce-core |
| `app/(tabs)/_layout.tsx` | Bottom tab bar |
| `app/(tabs)/index.tsx`, `shop.tsx`, `cart.tsx`, `account.tsx` | Tab screens |
| `lib/token-store.ts` | SecureStore read/write/clear for the session |
| `lib/api-client.ts` | Bearer fetch wrapper with single-flight refresh |

**Modified**

| File | Change |
|---|---|
| `apps/platform/next.config.js:4` | Add `transpilePackages: ['commerce-core']` |
| `apps/platform/package.json` | Add `commerce-core` dependency |
| 17 platform files (Task 1) + 3 (Task 2) | Rewrite `@/lib/<mod>` imports to `commerce-core` |

---

## Task 1: Extract the six standalone modules into `commerce-core`

Six of the seven target modules have **zero imports** — verified with
`grep -n "^import" src/lib/{validation,commerce-policy,default-variant,pack-pricing,cart-line,first-order-perk}.ts`
returning nothing. They move verbatim. `categories.ts` reads `process.env` and is handled separately in Task 2.

**Files:**
- Create: `client/packages/commerce-core/package.json`
- Create: `client/packages/commerce-core/tsconfig.json`
- Create: `client/packages/commerce-core/src/index.ts`
- Move: `client/apps/platform/src/lib/{pack-pricing,cart-line,first-order-perk,commerce-policy,default-variant,validation}.ts` → `client/packages/commerce-core/src/`
- Move: `client/apps/platform/src/lib/{pack-pricing,cart-line,first-order-perk,default-variant}.test.mjs` → `client/packages/commerce-core/src/`
- Modify: `client/apps/platform/next.config.js:4`
- Modify: `client/apps/platform/package.json`
- Modify: 17 importer files (listed in Step 6)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: package `commerce-core`, importable as
  `import { resolvePackPricing, resolveCartLine, describeFirstOrderPerk, formatNaira, describeDeliveryLine, SHIPPING_DETAILS, MERCHANT_RETURN_POLICY, pickDefaultSizeFrom, pickDefaultVariant, isDefaultVariantInStock, validateEmail, validateStrongPassword, validateConfirmPassword, normalizePhone, validateNigerianPhone, getPasswordStrength, emailRegex, strongPasswordRegex, STRONG_PASSWORD_RULE } from 'commerce-core'`

- [ ] **Step 1: Create the package manifest**

Create `client/packages/commerce-core/package.json`:

```json
{
  "name": "commerce-core",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "node --experimental-strip-types --test src/*.test.mjs",
    "type:check": "tsc --noEmit",
    "clean": "rm -rf node_modules .cache .turbo"
  },
  "devDependencies": {
    "typescript": "5.8.2",
    "typescript-config": "file:../config-typescript"
  }
}
```

- [ ] **Step 2: Create the package tsconfig**

Create `client/packages/commerce-core/tsconfig.json`:

```json
{
  "extends": "typescript-config/base.json",
  "compilerOptions": {
    "lib": ["esnext", "dom"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`lib` includes `dom` because `categories.ts` (Task 2) calls `fetch`. `jsx` is set so the package can hold a provider component later without a config change.

- [ ] **Step 3: Move the six modules and their tests with git mv**

Run from `client/apps/platform`:

```bash
mkdir -p ../../packages/commerce-core/src
for m in pack-pricing cart-line first-order-perk commerce-policy default-variant validation; do
  git mv "src/lib/$m.ts" "../../packages/commerce-core/src/$m.ts"
done
for t in pack-pricing cart-line first-order-perk default-variant; do
  git mv "src/lib/$t.test.mjs" "../../packages/commerce-core/src/$t.test.mjs"
done
```

`seoTitle.ts` and `seoTitle.test.mjs` stay in platform — they serve SEO, which mobile does not have.

- [ ] **Step 4: Run the moved tests to verify they still pass**

Run from `client/packages/commerce-core`:

```bash
node --experimental-strip-types --test src/*.test.mjs
```

Expected: PASS. The tests import siblings by relative path (`./pack-pricing.ts`), so moving them together changes nothing.

If this fails, the move was incomplete — do not proceed.

- [ ] **Step 5: Create the barrel**

Create `client/packages/commerce-core/src/index.ts`:

```ts
export * from './pack-pricing.ts';
export * from './cart-line.ts';
export * from './first-order-perk.ts';
export * from './commerce-policy.ts';
export * from './default-variant.ts';
export * from './validation.ts';
```

`.ts` extensions are required — `typescript-config/base.json` sets
`allowImportingTsExtensions: true` and the package ships raw TypeScript.

- [ ] **Step 6: Rewrite platform imports**

Add the dependency to `client/apps/platform/package.json` under `dependencies`:

```json
    "commerce-core": "workspace:*",
```

Then rewrite these 17 files, replacing any `@/lib/<module>` import path with `commerce-core`:

```
src/app/checkout/page.tsx
src/app/forgot-password/page.tsx
src/app/login/page.tsx
src/app/my-account/_components/PasswordForm.tsx
src/app/product/[slug]/page.tsx
src/app/register/page.tsx
src/app/verify-email/page.tsx
src/app/wishlist/page.tsx
src/components/Banner/FirstOrderPerkBanner.tsx
src/components/Home1/TabFeatures.tsx
src/components/Home1/TrendingProduct.tsx
src/components/Modal/ModalQuickview.tsx
src/components/Modal/ModalWishlist.tsx
src/components/Product/Card/index.tsx
src/components/Product/Detail/index.tsx
src/context/FirstOrderPerkContext.tsx
src/hooks/useProductActions.ts
```

Example — in `src/components/Product/Card/index.tsx`, a line like:

```ts
import { resolvePackPricing } from '@/lib/pack-pricing';
```

becomes:

```ts
import { resolvePackPricing } from 'commerce-core';
```

Where a file imports from two moved modules, merge them into one `commerce-core` import.

- [ ] **Step 7: Catch any importers the list missed**

Run from `client/apps/platform`:

```bash
grep -rn "lib/\(pack-pricing\|cart-line\|first-order-perk\|commerce-policy\|default-variant\|validation\)" src --include='*.ts' --include='*.tsx'
```

Expected: no output. The file list in Step 6 covers `@/lib/...` imports; this catches any relative (`../lib/...`) form. Fix any hits the same way.

- [ ] **Step 8: Add transpilePackages to the Next config**

In `client/apps/platform/next.config.js`, modify the object opening at line 4:

```js
const nextConfig = {
  transpilePackages: ['commerce-core'],
  reactStrictMode: true,
```

Without this, Next will not compile the raw TypeScript shipped by the package and the build fails on the first import.

- [ ] **Step 9: Install and verify the web app still typechecks and builds**

Run from `client`:

```bash
pnpm install
```

Then from `client/apps/platform`:

```bash
npx tsc --noEmit
```

Expected: PASS, with no errors mentioning `commerce-core` or any moved module.

**This step is not optional and `next build` is not a substitute** — `next.config.js` sets `typescript: { ignoreBuildErrors: true }`, so a broken import would build green and fail at runtime.

Then:

```bash
pnpm build
```

Expected: build completes.

- [ ] **Step 10: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/packages/commerce-core client/apps/platform
git commit -m "refactor(commerce): one copy of the pricing rules, shared by both apps"
```

---

## Task 2: Move `categories.ts` with an injected API base

`categories.ts:53` reads `process.env.NEXT_PUBLIC_API_URL` at module scope. React Native has no such variable (Expo uses `EXPO_PUBLIC_*`), so the module must take its base URL from the host app instead of the environment.

**Files:**
- Create: `client/packages/commerce-core/src/config.ts`
- Create: `client/packages/commerce-core/src/config.test.mjs`
- Move: `client/apps/platform/src/lib/categories.ts` → `client/packages/commerce-core/src/categories.ts`
- Modify: `client/packages/commerce-core/src/categories.ts:53`
- Modify: `client/packages/commerce-core/src/index.ts`
- Modify: `client/apps/platform/src/app/layout.tsx`
- Modify: 3 importer files

**Interfaces:**
- Consumes: the `commerce-core` package from Task 1
- Produces:
  - `configureCommerceCore(options: { apiBaseUrl: string }): void`
  - `getApiBaseUrl(): string` — throws if called before configuration
  - `fetchAllCategories(): Promise<Category[]>`, `fetchAllSubCategories(): Promise<SubCategory[]>`, `getRootCategories(all, allSubs)`, `getSubcategories(parent, allSubs)`

- [ ] **Step 1: Write the failing test for the config module**

Create `client/packages/commerce-core/src/config.test.mjs`:

```js
// Run with:  node --experimental-strip-types --test src/config.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { configureCommerceCore, getApiBaseUrl, __resetCommerceCoreConfig } from './config.ts';

test('getApiBaseUrl throws when the host app never configured it', () => {
  __resetCommerceCoreConfig();
  assert.throws(() => getApiBaseUrl(), /configureCommerceCore/);
});

test('getApiBaseUrl returns what was configured', () => {
  __resetCommerceCoreConfig();
  configureCommerceCore({ apiBaseUrl: 'https://backend.drinksharbour.com' });
  assert.equal(getApiBaseUrl(), 'https://backend.drinksharbour.com');
});

test('a trailing slash is stripped so callers can always template `${base}/api/...`', () => {
  __resetCommerceCoreConfig();
  configureCommerceCore({ apiBaseUrl: 'http://localhost:5001/' });
  assert.equal(getApiBaseUrl(), 'http://localhost:5001');
});

test('an empty base URL is rejected at configure time, not at fetch time', () => {
  __resetCommerceCoreConfig();
  assert.throws(() => configureCommerceCore({ apiBaseUrl: '' }), /apiBaseUrl/);
});
```

The throw-when-unconfigured behaviour is deliberate. A silent
`http://localhost:5001` default is what lets a misconfigured production build
ship and fail only for real users.

- [ ] **Step 2: Run the test to verify it fails**

Run from `client/packages/commerce-core`:

```bash
node --experimental-strip-types --test src/config.test.mjs
```

Expected: FAIL — `Cannot find module './config.ts'`.

- [ ] **Step 3: Implement the config module**

Create `client/packages/commerce-core/src/config.ts`:

```ts
/**
 * Host-injected configuration.
 *
 * This package is imported by both a Next.js app (NEXT_PUBLIC_*) and an Expo
 * app (EXPO_PUBLIC_*), so it cannot read the environment itself. Each host
 * calls configureCommerceCore() once at startup.
 */

interface CommerceCoreConfig {
  apiBaseUrl: string;
}

let config: CommerceCoreConfig | null = null;

export function configureCommerceCore(options: { apiBaseUrl: string }): void {
  if (!options?.apiBaseUrl) {
    throw new Error('configureCommerceCore: apiBaseUrl is required and must be non-empty');
  }
  config = { apiBaseUrl: options.apiBaseUrl.replace(/\/+$/, '') };
}

export function getApiBaseUrl(): string {
  if (!config) {
    throw new Error(
      'commerce-core used before configuration — call configureCommerceCore({ apiBaseUrl }) at app startup'
    );
  }
  return config.apiBaseUrl;
}

/** Test-only. Resets module state between cases. */
export function __resetCommerceCoreConfig(): void {
  config = null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `client/packages/commerce-core`:

```bash
node --experimental-strip-types --test src/config.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Move categories.ts**

Run from `client/apps/platform`:

```bash
git mv src/lib/categories.ts ../../packages/commerce-core/src/categories.ts
```

- [ ] **Step 6: Replace the env read with the injected base**

In `client/packages/commerce-core/src/categories.ts`, delete line 53:

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
```

and add this import at the top of the file:

```ts
import { getApiBaseUrl } from './config.ts';
```

Then replace the two fetch call sites (originally lines 65 and 88) so the base
is resolved per call rather than at module load:

```ts
  _catInflight = fetch(`${getApiBaseUrl()}/api/categories`)
```

```ts
  _subInflight = fetch(`${getApiBaseUrl()}/api/subcategories`)
```

Resolving per call matters: at module scope the value would be read before the
host had a chance to configure it.

- [ ] **Step 7: Export from the barrel**

Add to `client/packages/commerce-core/src/index.ts`:

```ts
export * from './config.ts';
export * from './categories.ts';
```

- [ ] **Step 8: Configure the package from the web app**

In `client/apps/platform/src/app/layout.tsx`, add the import and the call at
module scope, above the component definition:

```ts
import { configureCommerceCore } from 'commerce-core';

configureCommerceCore({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
});
```

The `|| 'http://localhost:5001'` fallback stays **here**, in the web app, exactly
where it lived before. It is the host's decision, not the package's.

- [ ] **Step 9: Rewrite the three category importers**

In each of:

```
src/components/Home1/TemuCategories.tsx
src/components/Navigation/MobileBottomNav.tsx
src/components/Shop/ShopHeroBanner.tsx
```

replace the import, for example:

```ts
import { fetchAllCategories, getRootCategories } from '@/lib/categories';
```

with:

```ts
import { fetchAllCategories, getRootCategories } from 'commerce-core';
```

- [ ] **Step 10: Verify no stale references remain**

Run from `client/apps/platform`:

```bash
grep -rn "lib/categories" src --include='*.ts' --include='*.tsx'
```

Expected: no output.

- [ ] **Step 11: Typecheck, test, and build**

Run from `client/packages/commerce-core`:

```bash
node --experimental-strip-types --test src/*.test.mjs
```

Expected: PASS, all suites.

Run from `client/apps/platform`:

```bash
npx tsc --noEmit && pnpm build
```

Expected: both PASS.

- [ ] **Step 12: Verify categories still load in the running web app**

```bash
pnpm dev
```

Open `http://localhost:3002` and confirm the category strip on the homepage
renders. A blank strip means `configureCommerceCore` is not running before the
first fetch — check Step 8.

- [ ] **Step 13: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/packages/commerce-core client/apps/platform
git commit -m "refactor(commerce): categories takes its API base from the host, not the env"
```

---

## Task 3: Scaffold the Expo app

**Files:**
- Create: `client/apps/mobile/package.json`
- Create: `client/apps/mobile/app.json`
- Create: `client/apps/mobile/tsconfig.json`
- Create: `client/apps/mobile/metro.config.js`
- Create: `client/apps/mobile/.env.example`
- Create: `client/apps/mobile/app/_layout.tsx`
- Create: `client/apps/mobile/app/index.tsx`

**Interfaces:**
- Consumes: `commerce-core` with `configureCommerceCore` from Task 2
- Produces: a runnable Expo app at `client/apps/mobile`, with expo-router mounted and commerce-core configured at startup

- [ ] **Step 1: Create the app manifest**

Create `client/apps/mobile/package.json`:

```json
{
  "name": "mobile",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "type:check": "tsc --noEmit",
    "clean": "rm -rf node_modules .expo .turbo"
  },
  "dependencies": {
    "commerce-core": "workspace:*",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "typescript": "5.8.2",
    "typescript-config": "file:../../packages/config-typescript"
  }
}
```

React is pinned to 18.3.1 here, not the 19.2.4 the web apps use. React Native
0.76 does not support React 19. pnpm isolates each workspace member's
`node_modules`, so the two versions coexist without conflict.

- [ ] **Step 2: Create the Expo config**

Create `client/apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "DrinksHarbour",
    "slug": "drinksharbour",
    "version": "0.0.1",
    "orientation": "portrait",
    "scheme": "drinksharbour",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.drinksharbour.app"
    },
    "android": {
      "package": "com.drinksharbour.app"
    },
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 3: Create the TypeScript config**

Create `client/apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create the Metro config for the monorepo**

Create `client/apps/mobile/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Metro must watch the whole workspace or it cannot resolve commerce-core.
config.watchFolders = [workspaceRoot];

// Resolve from the app first, then the workspace root — pnpm's layout means
// hoisted packages live at the root while direct deps live in the app.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm uses symlinks; without this Metro follows them to real paths and
// resolves the same module twice.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

This file is the single most common source of "it works on web but the app
can't find the package" in a pnpm monorepo. All four settings are required.

- [ ] **Step 5: Document the environment variable**

Create `client/apps/mobile/.env.example`:

```
# The Express backend. Production: https://backend.drinksharbour.com
EXPO_PUBLIC_API_URL=http://localhost:5001
```

Expo only exposes variables prefixed `EXPO_PUBLIC_` to the app bundle.

- [ ] **Step 6: Create the root layout that configures commerce-core**

Create `client/apps/mobile/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureCommerceCore } from 'commerce-core';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set — copy .env.example to .env and set it'
  );
}

configureCommerceCore({ apiBaseUrl });

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

Unlike the web app, mobile has **no localhost fallback**. A missing base URL in
a shipped binary cannot be fixed by an env change — it has to fail loudly at
development time instead.

- [ ] **Step 7: Create a temporary index screen that proves the package resolves**

Create `client/apps/mobile/app/index.tsx`:

```tsx
import { Text, View } from 'react-native';
import { formatNaira, getApiBaseUrl } from 'commerce-core';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text>DrinksHarbour</Text>
      <Text>API: {getApiBaseUrl()}</Text>
      <Text>Pack price: {formatNaira(54000)}</Text>
    </View>
  );
}
```

This screen is replaced in Task 5. It exists to prove that Metro resolves
`commerce-core` across the workspace and that the config injection ran.

- [ ] **Step 8: Install**

Run from `client`:

```bash
pnpm install
```

- [ ] **Step 9: Run the app on both platforms**

Run from `client/apps/mobile`:

```bash
cp .env.example .env
pnpm start
```

Press `i` for the iOS simulator and `a` for the Android emulator.

Expected on both: a screen reading `DrinksHarbour`, `API: http://localhost:5001`,
and `Pack price: ₦54,000`.

The formatted naira string is the meaningful assertion — it is produced by
`formatNaira` from `commerce-core`, so seeing it proves the shared package is
resolving and executing inside React Native.

If Metro reports `Unable to resolve "commerce-core"`, re-check Step 4.

- [ ] **Step 10: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/mobile client/pnpm-lock.yaml
git commit -m "feat(mobile): expo app that can see the shared commerce package"
```

---

## Task 4: Wire NativeWind to the shared theme

**Files:**
- Create: `client/apps/mobile/babel.config.js`
- Create: `client/apps/mobile/tailwind.config.js`
- Create: `client/apps/mobile/global.css`
- Create: `client/apps/mobile/nativewind-env.d.ts`
- Modify: `client/apps/mobile/metro.config.js`
- Modify: `client/apps/mobile/app/_layout.tsx`
- Modify: `client/apps/mobile/app/index.tsx`
- Modify: `client/apps/mobile/package.json`

**Interfaces:**
- Consumes: the Expo app from Task 3; the existing `tailwind-config` package
- Produces: `className` styling available on React Native components, resolving the same theme tokens the web storefront uses

- [ ] **Step 1: Add the dependencies**

Run from `client/apps/mobile`:

```bash
pnpm add nativewind@^4.1.23 react-native-reanimated@~3.16.0 react-native-safe-area-context@4.12.0
pnpm add -D tailwindcss@^3.4.17 tailwind-config@workspace:*
```

- [ ] **Step 2: Create the Babel config**

Create `client/apps/mobile/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

`react-native-reanimated/plugin` must be last in the plugins array — that is a
hard requirement of Reanimated, not a style preference.

- [ ] **Step 3: Create the Tailwind config extending the shared theme**

Create `client/apps/mobile/tailwind.config.js`:

```js
const sharedConfig = require('tailwind-config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: sharedConfig.theme?.extend?.colors ?? {},
      fontSize: sharedConfig.theme?.extend?.fontSize ?? {},
      borderRadius: sharedConfig.theme?.extend?.borderRadius ?? {},
    },
  },
  plugins: [],
};
```

Only colors, font sizes, and radii are pulled through. The web config's
plugins (`@tailwindcss/forms`, `@tailwindcss/container-queries`) target DOM
elements and will not work under NativeWind — importing the whole config
wholesale is what breaks the build here.

- [ ] **Step 4: Create the CSS entry**

Create `client/apps/mobile/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Add the NativeWind type declarations**

Create `client/apps/mobile/nativewind-env.d.ts`:

```ts
/// <reference types="nativewind/types" />
```

Without this, TypeScript rejects `className` on every React Native component.

- [ ] **Step 6: Point Metro at the CSS**

In `client/apps/mobile/metro.config.js`, change the require line at the top:

```js
const { withNativeWind } = require('nativewind/metro');
```

and change the final export:

```js
module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 7: Import the stylesheet in the root layout**

In `client/apps/mobile/app/_layout.tsx`, add as the first line of the file:

```tsx
import '../global.css';
```

- [ ] **Step 8: Convert the index screen to className styling**

Replace the body of `client/apps/mobile/app/index.tsx`:

```tsx
import { Text, View } from 'react-native';
import { formatNaira, getApiBaseUrl } from 'commerce-core';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-white">
      <Text className="text-xl font-semibold text-black">DrinksHarbour</Text>
      <Text className="text-sm text-gray-500">API: {getApiBaseUrl()}</Text>
      <Text className="text-base">Pack price: {formatNaira(54000)}</Text>
    </View>
  );
}
```

- [ ] **Step 9: Verify styling renders and types pass**

Run from `client/apps/mobile`:

```bash
npx tsc --noEmit
```

Expected: PASS. A `className` error here means Step 5 was skipped.

```bash
pnpm start --clear
```

The `--clear` flag is required — Metro caches the Babel transform, and without
it the NativeWind preset change will not take effect.

Expected on iOS and Android: the same three lines as Task 3, now visibly styled
— centred, white background, the title bold and larger than the grey API line.

- [ ] **Step 10: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/mobile
git commit -m "feat(mobile): nativewind on the same theme tokens as the web"
```

---

## Task 5: Build the tab shell

**Files:**
- Create: `client/apps/mobile/app/(tabs)/_layout.tsx`
- Create: `client/apps/mobile/app/(tabs)/index.tsx`
- Create: `client/apps/mobile/app/(tabs)/shop.tsx`
- Create: `client/apps/mobile/app/(tabs)/cart.tsx`
- Create: `client/apps/mobile/app/(tabs)/account.tsx`
- Delete: `client/apps/mobile/app/index.tsx`
- Modify: `client/apps/mobile/package.json`

**Interfaces:**
- Consumes: the styled Expo app from Task 4
- Produces: four routes — `/`, `/shop`, `/cart`, `/account` — under a bottom tab bar. Later phases add screens to these stacks.

- [ ] **Step 1: Add the icon dependency**

Run from `client/apps/mobile`:

```bash
pnpm add @expo/vector-icons
```

- [ ] **Step 2: Create the tab layout**

Create `client/apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

Colors are literals for now. They move to theme tokens once the design system
lands in Phase 3 — hardcoding them here avoids blocking on that.

- [ ] **Step 3: Create the four placeholder screens**

Create `client/apps/mobile/app/(tabs)/index.tsx`:

```tsx
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-xl font-semibold">Home</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `client/apps/mobile/app/(tabs)/shop.tsx`:

```tsx
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ShopScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-xl font-semibold">Shop</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `client/apps/mobile/app/(tabs)/cart.tsx`:

```tsx
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CartScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-xl font-semibold">Cart</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `client/apps/mobile/app/(tabs)/account.tsx`:

```tsx
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-xl font-semibold">Account</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Remove the temporary index screen**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/mobile
rm app/index.tsx
```

`app/(tabs)/index.tsx` now serves `/` — the parenthesised segment is a route
group and does not appear in the URL.

- [ ] **Step 5: Verify navigation on both platforms**

Run from `client/apps/mobile`:

```bash
npx tsc --noEmit && pnpm start --clear
```

Expected on iOS and Android: a bottom tab bar with four labelled icons.
Tapping each switches the screen and the active icon turns black. Android
hardware back from a non-Home tab returns to Home.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/mobile
git commit -m "feat(mobile): four tabs, one stack each"
```

---

## Task 6: Secure token store

**Files:**
- Create: `client/apps/mobile/lib/token-store.ts`
- Create: `client/apps/mobile/lib/token-store.test.mjs`
- Create: `client/apps/mobile/vitest.config.ts`
- Modify: `client/apps/mobile/package.json`

**Interfaces:**
- Consumes: the Expo app from Task 5
- Produces:
  - `saveSession(session: StoredSession): Promise<void>`
  - `readSession(): Promise<StoredSession | null>`
  - `clearSession(): Promise<void>`
  - `interface StoredSession { accessToken: string; refreshToken: string | null; user: unknown }`

- [ ] **Step 1: Add dependencies**

Run from `client/apps/mobile`:

```bash
pnpm add expo-secure-store
pnpm add -D vitest@^3.2.7
```

- [ ] **Step 2: Add the test script and Vitest config**

Add to `scripts` in `client/apps/mobile/package.json`:

```json
    "test": "vitest run",
```

Create `client/apps/mobile/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.mjs'],
  },
});
```

`environment: 'node'` matches the convention already in force in
`apps/admin` — no jsdom, components are not rendered, pure logic is extracted
and tested directly.

- [ ] **Step 3: Write the failing test**

Create `client/apps/mobile/lib/token-store.test.mjs`:

```js
import { beforeEach, describe, expect, test, vi } from 'vitest';

const store = new Map();

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k, v) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k) => (store.has(k) ? store.get(k) : null)),
  deleteItemAsync: vi.fn(async (k) => void store.delete(k)),
}));

const { saveSession, readSession, clearSession } = await import('./token-store.ts');

describe('token-store', () => {
  beforeEach(() => store.clear());

  test('a saved session reads back intact', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1', user: { id: 'u1' } });
    expect(await readSession()).toEqual({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: 'u1' },
    });
  });

  test('no stored session reads as null rather than throwing', async () => {
    expect(await readSession()).toBeNull();
  });

  test('a session without a refresh token is still valid', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: null, user: { id: 'u1' } });
    expect(await readSession()).toEqual({ accessToken: 'a1', refreshToken: null, user: { id: 'u1' } });
  });

  test('clearSession removes every key, not just the access token', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1', user: { id: 'u1' } });
    await clearSession();
    expect(store.size).toBe(0);
    expect(await readSession()).toBeNull();
  });

  test('corrupt stored data reads as null instead of throwing', async () => {
    store.set('dh_session', '{not valid json');
    expect(await readSession()).toBeNull();
  });
});
```

The corrupt-data case is the one that matters in practice: a partial write or
an OS-level keychain migration leaves garbage behind, and a throw there would
brick the app at launch with no way for the user to recover.

- [ ] **Step 4: Run the test to verify it fails**

Run from `client/apps/mobile`:

```bash
pnpm test
```

Expected: FAIL — cannot resolve `./token-store.ts`.

- [ ] **Step 5: Implement the token store**

Create `client/apps/mobile/lib/token-store.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'dh_session';

export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  user: unknown;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function readSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    // Corrupt entry — treat as signed out rather than crashing at launch.
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

The whole session is one keychain entry rather than three. It keeps the access
and refresh tokens atomically consistent — separate entries can be left
half-updated by a crash mid-write.

- [ ] **Step 6: Run the test to verify it passes**

Run from `client/apps/mobile`:

```bash
pnpm test
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/mobile
git commit -m "feat(mobile): session lives in the keychain, and survives a corrupt write"
```

---

## Task 7: API client with Bearer auth and single-flight refresh

**Files:**
- Create: `client/apps/mobile/lib/api-client.ts`
- Create: `client/apps/mobile/lib/api-client.test.mjs`

**Interfaces:**
- Consumes: `readSession`, `saveSession`, `clearSession` from Task 6; `getApiBaseUrl` from Task 2
- Produces:
  - `apiFetch(path: string, init?: RequestInit): Promise<Response>` — prefixes the base URL, attaches the Bearer header, refreshes once on 401
  - `setOnSessionExpired(handler: () => void): void` — called when refresh fails
  - `__resetRefreshState(): void` — test-only

- [ ] **Step 1: Write the failing tests**

Create `client/apps/mobile/lib/api-client.test.mjs`:

```js
import { beforeEach, describe, expect, test, vi } from 'vitest';

let session = null;

vi.mock('./token-store.ts', () => ({
  readSession: vi.fn(async () => session),
  saveSession: vi.fn(async (s) => void (session = s)),
  clearSession: vi.fn(async () => void (session = null)),
}));

vi.mock('commerce-core', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

const { apiFetch, setOnSessionExpired, __resetRefreshState } = await import('./api-client.ts');

const res = (status, body = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiFetch', () => {
  beforeEach(() => {
    session = null;
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  test('prefixes the base URL and sends no auth header when signed out', async () => {
    const fetchMock = vi.fn(async () => res(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/products');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/products');
    expect(init.headers.Authorization).toBeUndefined();
  });

  test('attaches the Bearer header when signed in', async () => {
    session = { accessToken: 'a1', refreshToken: 'r1', user: {} };
    const fetchMock = vi.fn(async () => res(200));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/users/profile');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer a1');
  });

  test('never sends credentials — mobile is Bearer-only and CSRF-exempt', async () => {
    session = { accessToken: 'a1', refreshToken: 'r1', user: {} };
    const fetchMock = vi.fn(async () => res(200));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/users/profile', { method: 'POST' });

    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBeUndefined();
    expect(init.headers['x-csrf-token']).toBeUndefined();
  });

  test('a 401 triggers one refresh and one retry of the original request', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: {} };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { data: { token: 'fresh', refreshToken: 'r2' } }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const out = await apiFetch('/api/users/profile');

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh');
    expect(session.accessToken).toBe('fresh');
  });

  test('concurrent 401s share ONE refresh call', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: {} };
    let refreshCalls = 0;

    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).includes('/refresh-token')) {
        refreshCalls += 1;
        return res(200, { data: { token: 'fresh', refreshToken: 'r2' } });
      }
      return init?.headers?.Authorization === 'Bearer fresh' ? res(200) : res(401);
    }));

    const results = await Promise.all([
      apiFetch('/api/a'),
      apiFetch('/api/b'),
      apiFetch('/api/c'),
      apiFetch('/api/d'),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  test('a failed refresh clears the session and notifies the app once', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: {} };
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);

    vi.stubGlobal('fetch', vi.fn(async () => res(401)));

    const out = await apiFetch('/api/users/profile');

    expect(out.status).toBe(401);
    expect(session).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  test('a 401 with no refresh token does not attempt a refresh', async () => {
    session = { accessToken: 'a1', refreshToken: null, user: {} };
    const fetchMock = vi.fn(async () => res(401));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/users/profile');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

The concurrent-401 test is the reason this task is separate. Four screens
mounting at once each hit 401, and without single-flight each fires its own
refresh — the winner rotates the refresh token and the other three are logged
out with a valid session.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `client/apps/mobile`:

```bash
pnpm test
```

Expected: FAIL — cannot resolve `./api-client.ts`.

- [ ] **Step 3: Implement the API client**

Create `client/apps/mobile/lib/api-client.ts`:

```ts
import { getApiBaseUrl } from 'commerce-core';
import { clearSession, readSession, saveSession } from './token-store.ts';

let refreshInFlight: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: () => void): void {
  onSessionExpired = handler;
}

/** Test-only. Clears the module-level single-flight state. */
export function __resetRefreshState(): void {
  refreshInFlight = null;
}

function buildHeaders(init: RequestInit | undefined, token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Refresh the access token. Concurrent callers share one in-flight request —
 * without this, parallel 401s race and all but one lose a rotated refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const payload = await response.json();
      const token: string | undefined = payload?.data?.token;
      if (!token) return null;

      const existing = await readSession();
      await saveSession({
        accessToken: token,
        refreshToken: payload?.data?.refreshToken ?? refreshToken,
        user: existing?.user ?? null,
      });

      return token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Authenticated fetch against the Express backend.
 *
 * Bearer-only by design: auth.middleware.js reads the Authorization header
 * first, and csrf.middleware.js waives CSRF for Bearer requests. Cookies are
 * never sent and no CSRF token is ever attached.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await readSession();
  const url = `${getApiBaseUrl()}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: buildHeaders(init, session?.accessToken ?? null),
  });

  if (response.status !== 401 || !session?.refreshToken) {
    return response;
  }

  const freshToken = await refreshAccessToken(session.refreshToken);

  if (!freshToken) {
    await clearSession();
    onSessionExpired?.();
    return response;
  }

  return fetch(url, {
    ...init,
    headers: buildHeaders(init, freshToken),
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `client/apps/mobile`:

```bash
pnpm test
```

Expected: PASS, 12 tests total across both suites.

- [ ] **Step 5: Typecheck and commit**

Run from `client/apps/mobile`:

```bash
npx tsc --noEmit
```

Expected: PASS.

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/mobile
git commit -m "feat(mobile): bearer api client, and one refresh for concurrent 401s"
```

---

## Phase 1 Done When

- `client/packages/commerce-core` holds one copy of the seven commerce modules, and its `node --test` suites pass
- `apps/platform` imports them from the package, typechecks with `npx tsc --noEmit`, builds, and still renders categories on the homepage
- `apps/mobile` launches on both an iOS simulator and an Android emulator, showing four working tabs
- `pnpm test` in `apps/mobile` passes 12 tests
- No auth token is stored anywhere but the keychain, and no mobile request sends a cookie or a CSRF token

## Deferred to Later Phases

Login and registration screens (Phase 2), biometric unlock (Phase 2), the design
system and real screens (Phase 3), Korapay checkout (Phase 4), the `Device`
model and push notifications (Phase 7), age gate and store submission (Phase 7).
