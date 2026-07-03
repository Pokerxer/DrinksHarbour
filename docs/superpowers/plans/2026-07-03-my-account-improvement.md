# My Account Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refactor `/my-account` with TypeScript safety, component decomposition, visual refresh, and pagination/date-filter UX upgrades.

**Architecture:** Extract shared types/constants/hooks into `my-account/_` namespace, decompose every page into focused components in `_components/`, and refactor `AccountShell` to compose extracted `Sidebar` + `MobileNav`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, framer-motion (existing), react-icons/pi (existing)

## Visual Design Tokens
- **Background:** `bg-stone-50` (was `bg-gray-50`)
- **Borders:** `border-stone-200` (was `border-gray-100`)
- **Text:** `text-stone-900` headings, `text-stone-500` secondary
- **Cards:** `rounded-xl` `shadow-sm` `hover:shadow-md` `hover:-translate-y-0.5`
- **Sidebar active:** `border-l-2 border-red-700` + `bg-red-50/50`
- **Transition:** `duration-150` for interactions, `duration-200` for hover

## Global Constraints
- Keep the `AccountContext` shim (backward compat for sub-pages)
- All existing routes must keep exact same paths
- No new npm dependencies — use existing `react-icons/pi`, `framer-motion`, `next/image`
- Every new component must be TypeScript strict (no `any`)
- Run `npm run build` after all tasks complete

---

### Task 1: Foundation — types, constants, hooks

**Files:**
- Create: `client/apps/platform/src/app/my-account/_types.ts`
- Create: `client/apps/platform/src/app/my-account/_constants.ts`
- Create: `client/apps/platform/src/app/my-account/_hooks/useOrders.ts`
- Create: `client/apps/platform/src/app/my-account/_hooks/useAddresses.ts`

**Interfaces:**
- Consumes: existing `fetchWithAuth` from `@/lib/fetchWithAuth`, `API_URL` from `@/lib/api`
- Produces: `Order`, `Address`, `StatusConfig` types; `useOrders()` returning `{ orders, loading, error, pagination, filters, setFilters, refetch }`; `useAddresses()` returning `{ addresses, loading, addAddress, updateAddress, deleteAddress, setDefault }`

- [ ] **Create `_types.ts`** with `OrderItem`, `ShippingAddress`, `Order`, `Address`, `AddressFormData`, `StatusConfig`, `OrdersResponse`, `FiltersState`, `PaginationState` — all fully typed, no `any`
- [ ] **Create `_constants.ts`** — export `STATUS_CONFIG` (from existing `page.tsx` and `orders/page.tsx`, deduplicated), `NG_STATES`, `PAYMENT_METHODS` (from `payment-methods/page.tsx`), `NAV_ITEMS` (from `AccountShell.tsx`), `ORDERS_PAGE_SIZE = 10`, `inputCls`, `labelCls` shared class strings
- [ ] **Create `_hooks/useOrders.ts`** — hook that accepts `token: string | null`, fetches `GET /api/orders/my-orders` with query params (`page`, `limit`, `status`, `dateFrom`, `dateTo`), returns `{ orders, loading, error, pagination: { page, pageSize, total, totalPages }, filters: { status, dateFrom, dateTo }, setFilters, refetch }`. Handles JSON response shape `data.data.orders || data.orders`.
- [ ] **Create `_hooks/useAddresses.ts`** — hook that accepts `token`, fetches `GET /api/addresses`, returns `{ addresses, loading, error, addAddress(data), updateAddress(id, data), deleteAddress(id), setDefault(id) }` — each mutation calls the API and updates local state

---

### Task 2: Sidebar + MobileNav + refactor AccountShell

**Files:**
- Create: `client/apps/platform/src/app/my-account/_components/Sidebar.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/MobileNav.tsx`
- Modify: `client/apps/platform/src/app/my-account/AccountShell.tsx`

**Interfaces:**
- Consumes: `AccountContext` from existing shim, user/token from `useAuth()`
- Produces: `Sidebar` (sticky desktop nav), `MobileNav` (sticky mobile header+dropdown), `AccountShell` (composes both)

- [ ] **Create `_components/Sidebar.tsx`** — Extract desktop sidebar from `AccountShell` lines 124-169. Export `Sidebar` component taking no props (consumes `useAccount()` + `usePathname()` internally). Visual: richer gradient in profile block (`from-stone-900 via-red-950 to-stone-900`), active nav items get `border-l-2 border-red-700` + `bg-red-50/50`, normal items `rounded-lg`. Use `_constants.ts` NAV_ITEMS. Keep `border-t` above logout button.
- [ ] **Create `_components/MobileNav.tsx`** — Extract mobile header from `AccountShell` lines 78-118. Export `MobileNav` component. Same active styling as Sidebar. Mobile nav uses `border-l-2` active state too.
- [ ] **Refactor `AccountShell.tsx`** — Replace inline sidebar/mobile nav markup with `<Sidebar />` and `<MobileNav />`. Keep the `AccountContext.Provider`, route guard `useEffect`, loading spinner, and logout handler. Keep same file export.

---

### Task 3: Shared UI components

**Files:**
- Create: `client/apps/platform/src/app/my-account/_components/StatCard.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/StatusBadge.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/ToggleSwitch.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/OrderCardSkeleton.tsx`

**Interfaces:**
- Consumes: `StatusConfig` from `_types.ts`
- Produces: reusable UI primitives

- [ ] **Create `StatCard.tsx`** — `interface Props { icon: React.ElementType; label: string; value: string | number; color: string; loading?: boolean }`. Render an icon box (9x9 rounded-xl), the value in `font-black text-xl text-stone-900`, label in `text-xs text-stone-500`. When `loading`, show skeleton shimmer instead of value. Hover: `shadow-md` transition.
- [ ] **Create `StatusBadge.tsx`** — `interface Props { status: string; icon?: boolean }`. Look up config from `STATUS_CONFIG`, render a small pill with bg/border/text colors from config. Use `rounded-md` instead of `rounded-full` for modern look. Show icon if `icon` prop true. Always use `<Icon>` from config.
- [ ] **Create `ToggleSwitch.tsx`** — `interface Props { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }`. Minimal toggle with `motion.span` for the knob (spring animation). Use `red-700` when enabled, `stone-200` when disabled. Accessible: `role="switch"`, `aria-checked`.
- [ ] **Create `OrderCardSkeleton.tsx`** — Shimmer skeleton matching OrderCard layout: thumbnail placeholder, text lines, status badge placeholder, price placeholder. Use `bg-stone-100 animate-pulse`.

---

### Task 4: Order components

**Files:**
- Create: `client/apps/platform/src/app/my-account/_components/OrderCard.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/StatusFilter.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/DateRangeFilter.tsx`

**Interfaces:**
- Consumes: `Order` from `_types.ts`, `StatusBadge` from Task 3
- Produces: reusable order display components

- [ ] **Create `OrderCard.tsx`** — `interface Props { order: Order; userEmail?: string }`. Renders: order number, date, item thumbnails (max 4, +N overflow), item count, shipping address, total price, status badge, "Track" button linking to `/order-tracking`. Visual: `rounded-xl` card with `hover:shadow-md hover:-translate-y-0.5` lift effect. Transitions: `duration-200`. Animate mount with `motion.div` (fade+slide).
- [ ] **Create `StatusFilter.tsx`** — `interface Props { active: string; counts: Record<string, number>; onChange: (status: string) => void }`. Renders filter buttons for `['all','pending','confirmed','processing','shipped','delivered','cancelled']`. Active: `bg-red-700 text-white`. Inactive: `bg-white border-stone-200 text-stone-600`. Hide tabs with 0 count (except 'all').
- [ ] **Create `DateRangeFilter.tsx`** — `interface Props { dateFrom: string; dateTo: string; onChange: (from: string, to: string) => void }`. Two date inputs side by side. Styled with `inputCls` from constants. Clear button to reset both.

---

### Task 5: Address components

**Files:**
- Create: `client/apps/platform/src/app/my-account/_components/AddressCard.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/AddressForm.tsx`

**Interfaces:**
- Consumes: `Address`, `AddressFormData` from `_types.ts`
- Produces: address display + form

- [ ] **Create `AddressCard.tsx`** — `interface Props { address: Address; onEdit: () => void; onDelete: () => void; onSetDefault: () => void; deleting?: boolean }`. Renders label icon (Home/Work/Other), label name, Default badge, full name, street, city/state, phone, edit/delete buttons. Default address gets `border-red-200` highlight. Deleting shows spinner.
- [ ] **Create `AddressForm.tsx`** — `interface Props { form: AddressFormData; onChange: (data: AddressFormData) => void; onSubmit: () => void; onCancel: () => void; saving: boolean; editing: boolean }`. Render all form fields: label select, first/last name, phone, street, city, state (NG dropdown), default checkbox. Use `inputCls`/`labelCls` from constants. Validation: required fields marked with asterisk.

---

### Task 6: Profile components

**Files:**
- Create: `client/apps/platform/src/app/my-account/_components/ProfileInfo.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/ProfileForm.tsx`
- Create: `client/apps/platform/src/app/my-account/_components/PasswordForm.tsx`

**Interfaces:**
- Consumes: `AuthUser` from AuthContext
- Produces: profile display/edit and password change

- [ ] **Create `ProfileInfo.tsx`** — `interface Props { user: AuthUser; onEdit: () => void }`. Read-only grid display of firstName, lastName, email, phone. Each field with `text-xs text-stone-400` label and `text-sm font-semibold text-stone-900` value.
- [ ] **Create `ProfileForm.tsx`** — `interface Props { user: AuthUser; onSave: (data) => void; onCancel: () => void; saving: boolean }`. Edit form with firstName, lastName, phone inputs, disabled email with note. Save/Cancel buttons.
- [ ] **Create `PasswordForm.tsx`** — Standalone form with current password, new password (+ strength meter), confirm password fields. Show/hide toggle per field. Validate: match check, strength check via existing `validateStrongPassword`.

---

### Task 7: Refactor Overview page

**Files:**
- Modify: `client/apps/platform/src/app/my-account/page.tsx`

**Interfaces:**
- Uses: `StatCard`, `OrderCard`, `OrderCardSkeleton`, `ProfileInfo`, `ProfileForm`, `StatusBadge` from previous tasks

- [ ] **Rewrite `page.tsx`** — Compose existing components:
  - Header section (h1 + subtitle)
  - Stats grid: render 4 `StatCard` instances (total orders, delivered, total spend, active orders)
  - Profile card: `ProfileInfo` when not editing, `ProfileForm` when editing. Save triggers `PUT /api/users/me`.
  - Recent orders section (max 5): `OrderCard` or `OrderCardSkeleton` per order, "View all" link
  - Quick links: Addresses / Notifications / Security as link cards
  - Max lines: ~120-150 (was 283)

---

### Task 8: Refactor Orders page

**Files:**
- Modify: `client/apps/platform/src/app/my-account/orders/page.tsx`

**Interfaces:**
- Uses: `StatusFilter`, `DateRangeFilter`, `OrderCard`, `OrderCardSkeleton`, `useOrders` hook

- [ ] **Rewrite `orders/page.tsx`** — Using `useOrders(token)`:
  - Header with order count
  - `StatusFilter` + `DateRangeFilter` — changing either calls `setFilters`
  - When loading: grid of 3 `OrderCardSkeleton` 
  - Empty: contextual empty state (all vs filtered)
  - Order list: `OrderCard` for each order, animated with `AnimatePresence`
  - Pagination controls: "Prev" / page numbers (max 5 visible) / "Next". Reset to page 1 on filter change.
  - Max lines: ~100-130 (was 194)

---

### Task 9: Refactor Addresses page

**Files:**
- Modify: `client/apps/platform/src/app/my-account/addresses/page.tsx`

**Interfaces:**
- Uses: `AddressCard`, `AddressForm`, `useAddresses` hook

- [ ] **Rewrite `addresses/page.tsx`** — Using `useAddresses(token)`:
  - Header with "Add Address" button (hidden when form open)
  - When `showForm`: render `AddressForm` at top (animated mount)
  - Address grid: 2-col grid of `AddressCard` instances
  - Empty: illustrated empty state
  - Delete confirmation: subtle inline confirm ("Are you sure?") before proceeding
  - Max lines: ~120-150 (was 315)

---

### Task 10: Refactor Notifications page

**Files:**
- Modify: `client/apps/platform/src/app/my-account/notifications/page.tsx`

**Interfaces:**
- Uses: `ToggleSwitch` from Task 3
- Connects to: `PUT /api/users/notifications`

- [ ] **Rewrite `notifications/page.tsx`** — Keep local toggle state + Save button pattern:
  - Header with Save button (shows "Saved!" feedback after success)
  - Notification types section: render rows with icon, label, description, `ToggleSwitch`
  - Delivery channels section: same pattern
  - Info banner (transactional notifications note)
  - Save button calls `PUT /api/users/notifications` with settings payload
  - On mount, `GET /api/users/notifications` to hydrate state
  - Max lines: ~100-120 (was 154)

---

### Task 11: Refactor Security page + MfaSection

**Files:**
- Modify: `client/apps/platform/src/app/my-account/security/page.tsx`
- Modify: `client/apps/platform/src/app/my-account/security/MfaSection.tsx`

**Interfaces:**
- Uses: `PasswordForm` from Task 6

- [ ] **Refactor `security/page.tsx`** — Replace inline password form with `<PasswordForm>`. Keep MFA section and active sessions section. Improve visual consistency.
- [ ] **Refactor `MfaSection.tsx`** — Search and replace all `#b20202` with Tailwind `red-700` equivalents. Replace `bg-[#b20202]` → `bg-red-700`, `hover:bg-[#8b0000]` → `hover:bg-red-800`, `focus:border-[#b20202]` → `focus:border-red-500`. Use `text-red-700` for text accents. Keep all logic and state management identical.

---

### Task 12: Refactor Payment Methods page

**Files:**
- Modify: `client/apps/platform/src/app/my-account/payment-methods/page.tsx`

**Interfaces:**
- Uses: `_constants.ts` PAYMENT_METHODS

- [ ] **Refactor `payment-methods/page.tsx`** — Move static data to `_constants.ts`. Improve visual consistency (stone palette, new card styling, better hover effects). Keep all content identical.
