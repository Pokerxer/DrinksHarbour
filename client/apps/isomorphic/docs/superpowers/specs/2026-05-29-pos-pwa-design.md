# POS PWA — Offline-First Design Spec
Date: 2026-05-29

## Scope

Convert the cashier-facing POS shell (`/pos/*` routes) into an installable, offline-first Progressive Web App. The admin backend (`/point-of-sale/*`) stays online-only.

**Works offline:**
- Product catalog browsing with current stock levels
- Full checkout (add to cart, discounts, complete order)
- Payment: cash (full) + card/transfer (manually recorded, no terminal integration)
- Offline orders queued, assigned temp receipt numbers (`OFF-001`, `OFF-002`, …)
- Refunds and voids against cached orders
- Lock screen PIN entry

**Online-only:**
- Session open / close (Z-report)
- Cross-terminal stock contention (detected at sync time, not before)

---

## Tech Stack

| Concern | Library |
|---|---|
| Service worker + precaching | `@serwist/next` + Workbox |
| IndexedDB ORM | `dexie` |
| Background sync | Service Worker Background Sync API |
| Install prompt | `BeforeInstallPromptEvent` (browser native) |

---

## Architecture

```
/pos/* pages
    │
    ├── useOnlineStatus hook        (navigator.onLine + window events)
    │
    ├── offline/api.ts              (wraps posApi — online passthrough / offline shim)
    │       │
    │       └── offline/db.ts       (Dexie database — 5 tables)
    │
    ├── offline/sync.ts             (drains offlineQueue on reconnect)
    │
    └── src/sw.ts                   (Serwist service worker)
            ├── precache Next.js chunks + POS pages
            ├── runtime cache product images
            └── register Background Sync tag: pos-queue-sync
```

---

## IndexedDB Schema

Database name: `pos-offline-v1`

### `products`
Full POSProduct shape. Synced from `/api/pos/products` on session open and every 30 min while online.

```ts
_id: string                  // primary key
name: string
sku?: string
baseSellingPrice: number
availableStock: number
sizes: {
  _id: string
  displayName: string
  sellingPrice: number
  availableStock: number
  sku?: string
}[]
images?: { url: string; thumbnail?: string }[]
categoryId?: string
brandId?: string
costPrice?: number
activeBundles?: object[]
updatedAt: string
```

### `session`
Single row (keyed `current`). Refreshed from `getSessionInfo` on every successful API call.

```ts
_id: 'current'
sessionId: string
terminalType: 'retail' | 'wholesale'
openedAt: string
orderCount: number
totalSales: number
methodBalances: { method: string; amount: number }[]
```

### `orders`
Confirmed server orders. Used for offline refund/void lookup. Written on every `getAllOrders` / `getSessionOrders` response.

```ts
_id: string                  // server _id
receiptNumber?: string
total: number
paymentMethod: string
paymentStatus?: string
items?: OrderItem[]
refunds?: Refund[]
isVoided?: boolean
createdAt: string
posStaff?: object
customer?: object
```

### `offlineQueue`
Operations created while offline, drained in order on reconnect.

```ts
id: number                   // autoincrement primary key
type: 'order' | 'refund' | 'void'
payload: object              // full request body
tempReceiptNumber?: string   // e.g. "OFF-001"
orderId?: string             // for refund/void — server _id or temp
createdAt: string
status: 'pending' | 'syncing' | 'failed'
retries: number
errorMessage?: string
```

### `stockAdjust`
Local stock decrements applied during offline orders. Cleared per-item after successful sync.

```ts
id: number                   // autoincrement
productId: string
sizeId?: string
delta: number                // negative (e.g. -2 means 2 units sold)
queueId: number              // FK → offlineQueue.id
```

---

## Offline API Shim (`offline/api.ts`)

Wraps every `posApi` call used by the POS sell flow. All other posApi calls (session open/close, analytics, etc.) are not shimmed and fail naturally when offline.

| Call | Online | Offline |
|---|---|---|
| `getProducts` | fetch → write Dexie | read Dexie `products` |
| `getSessionInfo` | fetch → write Dexie | read Dexie `session` |
| `getAllOrders` / `getSessionOrders` | fetch → write Dexie | read Dexie `orders` + pending `offlineQueue` entries |
| `createOrder` | POST normally | write `offlineQueue` + `stockAdjust`; return synthetic receipt |
| `refundOrder` | POST normally | write `offlineQueue` |
| `voidOrder` | POST normally | write `offlineQueue` |

Stock enforcement for offline cart: `products.availableStock` minus sum of matching `stockAdjust.delta` entries.

Offline receipt numbering: atomic counter in `localStorage` key `dh-pos-offline-counter-{terminal}`, formatted `OFF-{counter padded to 3 digits}`.

---

## Sync Engine (`offline/sync.ts`)

### Trigger conditions
1. `window` fires `online` event
2. Service worker Background Sync fires `pos-queue-sync` tag (handles tab-closed case)

### Drain algorithm
```
for each entry in offlineQueue ORDER BY createdAt ASC where status = 'pending':
  mark status = 'syncing'

  if type = 'order':
    POST /api/pos/orders with payload
    on 2xx:
      - write confirmed order to Dexie orders table
      - delete stockAdjust entries for this queueId
      - delete from offlineQueue
      - accumulate for "X orders synced" toast
    on 409/422 (stock conflict):
      - mark status = 'failed', store errorMessage
      - toast (actionable): "Order OFF-001 failed — [items] out of stock. Tap to review."
    on other error (network, 5xx):
      - increment retries; if retries >= 3 mark 'failed'
      - stop drain, retry on next online event

  if type = 'refund' | 'void':
    POST to respective endpoint
    on 2xx: delete from offlineQueue
    on error: increment retries / mark failed

after drain:
  - re-fetch products + stock levels from server → overwrite Dexie products table
  - re-fetch session orders → overwrite Dexie orders table
  - show accumulated success toast: "X orders synced" (auto-dismiss 4s)
```

### Conflict policy
Server wins. No automatic merge. Failed entries stay in `offlineQueue` with `status = 'failed'` and are surfaced in the UI for cashier action (persistent toast with "Reload cart" action).

---

## Service Worker (`src/sw.ts`)

Built by Serwist, compiled by `@serwist/next` webpack plugin.

```ts
// Precache: all Next.js JS/CSS chunks + POS HTML pages
self.__SW_MANIFEST  // injected by Serwist at build time

// Runtime cache: product images (CacheFirst, 7-day max-age, 200 entries max)
registerRoute(/\/_next\/image/, new CacheFirst({ ... }))

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'pos-queue-sync') {
    event.waitUntil(runSyncEngine())
  }
})
```

`/api/pos/*` routes are NOT runtime-cached by the service worker — the offline API shim handles them at the application layer to avoid stale API responses.

---

## Manifest (`public/manifest.json`)

```json
{
  "name": "Drinks Harbour POS",
  "short_name": "DH POS",
  "description": "Drinks Harbour Point of Sale terminal",
  "start_url": "/pos/sell",
  "scope": "/pos/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#ffffff",
  "theme_color": "#b20202",
  "icons": [
    { "src": "/icons/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/pwa-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Icons generated from existing logo at three sizes. Maskable variant uses safe-zone padding for Android adaptive icons.

---

## UI Changes

### `POSSessionBar` — offline chip
- **Online:** no change
- **Offline:** amber pulsing dot + "Offline" label; if `offlineQueue` has pending entries, badge shows count ("3 queued")
- **Syncing:** chip turns blue + "Syncing…" spinner
- **Sync complete:** brief green "Synced ✓" then chip disappears

### `POSSessionBar` — install button
New item in the hamburger menu: **"Install App"** (shown only when `BeforeInstallPromptEvent` is available — i.e. not already installed and browser supports PWA install). Triggers native browser install dialog.

### `POSCart`
- Amber **"Offline Order"** banner across cart header when offline
- Stock counts read from Dexie `products`, adjusted by local `stockAdjust` deltas
- Receipt displayed as `OFF-001` until real receipt arrives post-sync

### `POSPaymentModal`
When offline, all payment methods remain selectable. Card/transfer/other show:
- Amber info line: *"Record only — no terminal. Verify with customer on reconnect."*
- Cash shows normally with no annotation

### `POSLockScreen`
No changes needed. Reads POS token from Jotai (localStorage-backed) — already works offline.

### Conflict toasts (post-sync)
- **Success:** `"3 orders synced"` — quiet, auto-dismiss 4s
- **Stock conflict:** `"Order OFF-001 failed — Heineken 600ml out of stock"` — persistent, "Reload cart" button re-opens failed order items in the cart for cashier to resolve manually

---

## File Map

```
client/apps/isomorphic/
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── pwa-192.png
│       ├── pwa-512.png
│       └── pwa-512-maskable.png
├── src/
│   ├── sw.ts                                        (Serwist service worker entry)
│   └── app/
│       └── shared/
│           └── point-of-sale/
│               └── offline/
│                   ├── db.ts                        (Dexie schema + instance)
│                   ├── api.ts                       (posApi shim)
│                   ├── sync.ts                      (queue drain engine)
│                   └── use-online-status.ts         (hook)
├── next.config.mjs                                  (add Serwist plugin)
└── package.json                                     (add @serwist/next, dexie)
```

---

## Out of Scope

- Cross-terminal real-time stock sync (detected at server-sync time only)
- Session open / close offline
- Admin backend PWA support
- Push notifications
- Periodic background fetch (stock refresh uses foreground polling only)
