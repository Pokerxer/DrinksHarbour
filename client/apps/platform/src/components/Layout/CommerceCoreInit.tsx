"use client";

import { configureCommerceCore } from "commerce-core";

// commerce-core's config lives in a module-scoped variable inside the
// package. Next.js compiles Server Components and Client Components into
// SEPARATE bundles, each with its own instantiation of every module — so the
// configureCommerceCore() call in layout.tsx (a Server Component) only sets
// state in the SERVER's copy of commerce-core/config. It never reaches the
// browser. TemuCategories, MobileBottomNav and ShopHeroBanner are all
// "use client" and fetch categories from useEffect, i.e. in the browser's
// own copy of the module — which stays unconfigured, so every fetch throws
// "commerce-core used before configuration" (confirmed via a live browser
// check, not assumed).
//
// This component calls configureCommerceCore() at module-evaluation time (not
// inside a hook), which runs before any component in this chunk renders. This
// is implicit bundler behavior, not a documented guarantee — related but weaker
// than ExtensionNoiseGuard's inline <script>, which has a synchronous execution
// guarantee during HTML parsing.
configureCommerceCore({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
});

export default function CommerceCoreInit() {
  return null;
}
