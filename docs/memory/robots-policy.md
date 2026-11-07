{
  "standalone": [
    "server/config/redis.js",
    "server/routes/user.routes.js",
    "server/__tests__/redis-performance.test.js",
    "server/__tests__/standalone-runtime.test.js",
    "docs/memory/standalone-without-upstash.md",
    "server/server.js",
    "server/package.json",
    "server/package-lock.json",
    "server/.env.example",
    "server/README.md"
  ],
  "realtime": [
    "server/middleware/realtimeStatus.js",
    "server/__tests__/realtime-status.test.js",
    "client/apps/admin/src/app/shared/point-of-sale/hooks/pos-realtime.ts",
    "client/apps/admin/src/app/shared/point-of-sale/hooks/pos-realtime.test.ts",
    "client/apps/admin/src/app/shared/point-of-sale/hooks/usePOSRealtime.ts",
    "client/apps/admin/src/app/shared/point-of-sale/hooks/useKdsFeed.ts",
    "server/server.js",
    "docs/memory/pos-realtime-availability.md"
  ],
  "shop": [
    "client/apps/platform/src/components/Shop/FilterSidebar.tsx",
    "client/apps/platform/src/components/Shop/FilterSidebar.test.tsx",
    "client/apps/platform/src/components/Shop/filters/FilterSection.tsx",
    "client/apps/platform/src/components/Shop/filters/SearchableFilterList.tsx",
    "client/apps/platform/src/components/Shop/filters/SearchableFilterList.test.tsx",
    "client/apps/platform/vitest.shop.config.ts",
    "docs/memory/shop-searchable-filters.md",
    "client/apps/platform/package.json",
    "client/pnpm-lock.yaml",
    "client/apps/platform/README.md"
  ],
  "robots": [
    "client/apps/platform/src/app/robots.ts",
    "client/apps/platform/src/app/robots-policy.test.mjs",
    "docs/memory/robots-policy.md"
  ],
  "types": [
    "client/apps/platform/src/components/Shop/ActiveFilters.tsx",
    "client/apps/platform/src/app/my-account/loyalty/page.tsx",
    "client/apps/platform/tsconfig.json"
  ]
}