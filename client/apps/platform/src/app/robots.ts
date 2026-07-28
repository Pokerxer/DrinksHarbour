import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

// ---------------------------------------------------------------------------
// HOW ROBOTS.TXT MATCHING WORKS (read before editing)
//
// A crawler obeys ONLY the single most specific matching User-agent group; it
// does NOT merge in rules from the `*` group. So a named group with `Allow: /`
// and no Disallow lines silently un-blocks everything for that bot. Rather than
// copy-pasting the rule list per bot (which drifts), both groups below share the
// same DISALLOW array, and the named bots are declared as ONE group with many
// User-agent lines — permitted by RFC 9309 §2.2.1 and honoured by Google, Bing,
// OpenAI, Anthropic and Perplexity alike.
// ---------------------------------------------------------------------------

// Paths that must never be CRAWLED at all.
//
// Deliberately short. Anything that merely shouldn't be INDEXED (cart, checkout,
// login, register, forgot-password, wishlist, compare, search-result,
// order-tracking) is handled by `robots: { index: false }` in that route's
// layout.tsx instead — blocking those here would stop crawlers from ever reading
// the noindex, which is how noindexed URLs get stuck in the index permanently.
//
// What's left is the set where a crawler fetching the URL is itself the problem:
// private data, or a GET with a side effect (a one-time token being consumed).
const DISALLOWED_PATHS = [
  "/api/", // internal route handlers (auth, user, products, banners)
  "/my-account", // no trailing slash, so the bare /my-account URL is covered too
  "/order-confirmation", // carries an order reference
  "/payment/verify", // payment callback — fetching it has side effects
  "/gift/", // /gift/[token] signed gift-card detail
  "/reset-password", // one-time token
  "/verify-email", // one-time token; a GET consumes it
];

// Query parameters that produce filtered/sorted permutations of pages we already
// expose canonically. /shop server-renders the whole catalogue in one response
// and every product, category and brand URL is in the sitemap, so these variants
// add no discoverable content — they only burn crawl budget on the slowest
// endpoint we have.
//
// `category`, `subcategory` and `brand` are intentionally NOT listed: the
// sitemap advertises the combined ?category=&subcategory= URLs, and blog
// category views use ?category= as well.
//
// `sale` is NOT listed either. The deals collection now has its own static path
// (/deals) and ?sale=true canonicalizes onto it — but a blocked URL is never
// fetched, so its canonical is never read and the consolidation cannot happen.
// Blocking it also stopped the site's own "Sale" nav target from ranking at all.
const DISALLOWED_PARAMS = [
  "sort", "page", "view", "limit", "offset",
  "search", "q",
  "saleType",
  "minPrice", "maxPrice", "minABV", "maxABV", "minRating", "rating",
  "volume", "size", "flavor", "origin",
];

// NOTE: /_next/ is deliberately absent. Blocking it stops Google fetching the JS
// and CSS it needs to render the page, and /_next/image serves every product
// photo — blocking it forfeits Google Images entirely. Do not re-add it.
const DISALLOW = [
  ...DISALLOWED_PATHS,
  ...DISALLOWED_PARAMS.map((param) => `/*?*${param}=`),
];

// AI retrieval, citation and training crawlers, granted the same access as any
// search engine so our product and blog content can be cited.
//
// This group is behaviourally identical to `*` — it exists as an explicit,
// auditable opt-in (Google-Extended and Applebot-Extended are opt-OUT tokens, so
// naming them keeps our stance durable if those defaults ever change) and as the
// one place to flip a specific bot to `disallow: "/"` if it misbehaves.
const AI_CRAWLERS = [
  // OpenAI — training / live user fetch / ChatGPT search citations
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  // Anthropic. Replaces the retired "anthropic-ai" and "Claude-Web" tokens,
  // which match nothing today.
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Google — AI Overviews / Gemini grounding, separate from Googlebot search
  "Google-Extended",
  "GoogleOther",
  // Apple Intelligence, separate from the Applebot used for Siri/Spotlight
  "Applebot-Extended",
  // Amazon
  "Amazonbot",
  // Meta AI
  "Meta-ExternalAgent",
  "meta-externalfetcher",
  // Others
  "Bytespider", // ByteDance
  "MistralAI-User",
  "DuckAssistBot",
  "YouBot",
  "CCBot", // Common Crawl — ingested as training data by many labs
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Every crawler not named below, including Googlebot and Bingbot.
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    // `Host:` intentionally omitted — a non-standard Yandex-only directive that
    // Yandex itself retired in 2018. The canonical host is declared via
    // <link rel="canonical"> and the sitemap's absolute URLs.
  };
}
