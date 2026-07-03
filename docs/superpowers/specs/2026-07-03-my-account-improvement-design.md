# My Account Section — Design Spec

> **Product:** DrinksHarbour Platform (drinksharbour.com)  
> **Section:** `/my-account` — customer account management  
> **Goal:** Refactor the my-account section with proper TypeScript, component decomposition, visual refresh, and UX upgrades.

---

## 1. Architecture

### Current Problems
- All data fetching inline in pages using `fetchWithAuth` — no reusable hooks
- `STATUS_CONFIG` duplicated across `page.tsx` and `orders/page.tsx`
- `any[]` types for orders and addresses throughout
- `AccountShell.tsx` (181 lines) combines sidebar, mobile nav, route guard, and context shim
- `page.tsx` (283 lines) and `addresses/page.tsx` (315 lines) too large
- Hardcoded `#b20202` hex values inconsistent with Tailwind `red-700` theme
- No pagination on orders page
- No API integration on notifications page (commented out)

### Target Structure
```
my-account/
├── _types.ts              # Order, Address, StatusConfig, UserProfile
├── _constants.ts          # STATUS_CONFIG, NG_STATES, PAYMENT_METHODS, NAV_ITEMS
├── _hooks/
│   ├── useOrders.ts       # fetch + pagination + date filter state
│   └── useAddresses.ts    # fetch + CRUD operations
├── _components/
│   ├── Sidebar.tsx        # Desktop sidebar (extracted from AccountShell)
│   ├── MobileNav.tsx      # Mobile header + dropdown (extracted from AccountShell)
│   ├── StatCard.tsx       # Stats grid card (icon + label + value)
│   ├── StatusBadge.tsx    # Colored status pill
│   ├── OrderCard.tsx      # Single order row/card (shared by overview + orders pages)
│   ├── OrderCardSkeleton.tsx
│   ├── StatusFilter.tsx   # Filter tabs for orders
│   ├── DateRangeFilter.tsx
│   ├── AddressCard.tsx    # Address display card
│   ├── AddressForm.tsx    # Add/edit address form (modal or inline)
│   ├── ProfileInfo.tsx    # Profile read view
│   ├── ProfileForm.tsx    # Profile edit form
│   ├── PasswordForm.tsx   # Password change form
│   ├── ToggleSwitch.tsx   # Reusable toggle switch
│   └── NotificationRow.tsx
├── AccountShell.tsx       # Slim — composes Sidebar + MobileNav, provides context
├── layout.tsx             # (minor — updated metadata)
├── page.tsx               # Overview — composes StatCard, ProfileInfo, ProfileForm, OrderCard
├── orders/page.tsx        # Orders — composes StatusFilter, DateRangeFilter, OrderCard + paginator
├── addresses/page.tsx     # Addresses — composes AddressCard + AddressForm
├── notifications/page.tsx # Compose ToggleSwitch + NotificationRow, persist via API
├── payment-methods/page.tsx
├── security/page.tsx      # Compose PasswordForm
└── security/MfaSection.tsx # Fix #b20202 → red-700 consistency
```

## 2. Visual Design

**Direction:** Premium refinement of existing card-based layout. Keep red-700 brand identity. Elevate perceived quality through typography, spacing, shadows, and micro-interactions.

**Palette:**
- Background: `stone-50` (#FAFAF9) — warmer than current `gray-50`
- Cards: `white` with `stone-200` (#E7E5E4) borders — warmer gray
- Primary accent: `red-700` → `red-800` gradient (existing brand)
- Premium accent: `amber-50` backgrounds, `amber-600` text — gold undertone for a beverage platform
- Text: `stone-900` headings, `stone-600` body, `stone-400` secondary
- Status colors: yellow/blue/orange/purple/green/red as existing

**Typography:**
- Headings: `font-black` `tracking-tight` `text-stone-900`
- Section titles: `font-bold` `text-sm` `uppercase` `tracking-wider` `text-stone-500`
- Body: `font-normal` `text-sm` `text-stone-600`
- Data (prices): `font-black` `tabular-nums`

**Cards:**
- `rounded-xl` (was `rounded-2xl` — tighter, more premium)
- `bg-white` `border` `border-stone-200` `shadow-sm`
- Hover: `shadow-md` `border-stone-300` `-translate-y-0.5`
- Transition: `transition-all duration-200`

**Sidebar:**
- Profile block: richer gradient `from-stone-900 via-stone-800 to-stone-900` with decorative red accent bar
- Active nav: 2px `border-l-2 border-red-700` + `bg-red-50/50` background — stronger active state
- Nav items: `rounded-lg` (was `rounded-xl`) — tighter

**Buttons:**
- Primary: `bg-gradient-to-br from-red-700 to-red-800` `hover:from-red-800 hover:to-red-900` `shadow-sm hover:shadow-md` `active:scale-[0.98]`
- Secondary: `border border-stone-200` `hover:border-red-200 hover:text-red-700`
- Transitions: `duration-150` for instant feel

**Status badges:**
- Keep existing color scheme but with `rounded-md` instead of `rounded-full` for a more modern look (badge-like, less pill-shaped)

**Beverage context:**
- Add subtle beverage-themed decoration to empty states (wine glass icon, bottle silhouette)
- Order items show beverage type badges (wine/beer/spirit)

## 3. Component Specs

### _types.ts
```typescript
export interface OrderItem {
  product: string | { _id: string; name: string; image?: string; thumbImage?: string[] };
  subproduct: string;
  size?: string;
  tenant: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
}

export interface ShippingAddress {
  fullName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}

export interface Order {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentStatus: string;
  items: OrderItem[];
  totalAmount: number;
  subtotal: number;
  shippingFee?: number;
  shipping?: ShippingAddress;
  placedAt?: string;
  createdAt?: string;
}

export interface Address {
  _id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface StatusConfig {
  color: string;
  bg: string;
  border: string;
}
```

### useOrders Hook
```typescript
function useOrders(token: string | null) {
  // Returns: { orders, loading, error, pagination, filters, setFilters, refetch }
  // Pagination: { page, pageSize, total, totalPages }
  // Filters: { status, dateFrom, dateTo }
  // Fetches from: GET /api/orders/my-orders?page=&limit=&status=&dateFrom=&dateTo=
}
```

### useAddresses Hook
```typescript
function useAddresses(token: string | null) {
  // Returns: { addresses, loading, addAddress, updateAddress, deleteAddress, setDefault }
  // Each method calls the API and updates local state optimistically
}
```

## 4. UX Upgrades

| Feature | Page | Description |
|---------|------|-------------|
| Pagination | Orders | 10 per page, prev/next with page numbers. Reset on filter change. |
| Date range filter | Orders | Two date inputs for from/to. Filter orders by placement date. |
| Skeleton loading | All | Shimmer skeletons replacing spinners for initial loads |
| Toast feedback | Overview, Notifications | Success/error toasts with auto-dismiss |
| Search | Orders | Optional text search across order numbers |
| API integration | Notifications | PUT to `/api/users/notifications` on save |
| Consistent hex | Security/Mfa | Replace `#b20202` with `red-700` Tailwind classes |
| Confirmation | Addresses | Confirm before delete with subtle dialog |

## 5. Error & Loading States

- **Loading:** `Skeleton` shimmer for initial loads, spinner only for button-inline actions
- **Empty:** Illustrated empty state with contextual copy and CTA
- **Error:** Inline error banner with retry button, not silent catch
- **Network:** Toast or banner for network failures with "Try again" action

## 6. Data Flow

- `AccountShell` provides `{ user, token }` via `AccountContext` (same as current)
- Hooks consume `token` from `useAccount()`
- Mutations (PUT/POST/DELETE) use `fetchWithAuth`
- Orders fetched with pagination params as query string
- Address CRUD follows existing REST pattern but encapsulated in hook
- Notification preferences stored locally, flushed to API on "Save" click
