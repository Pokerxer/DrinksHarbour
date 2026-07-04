import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

const DISALLOWED = [
  "/my-account/",
  "/checkout",
  "/cart",
  "/order-confirmation",
  "/order-tracking",
  "/reset-password",
  "/verify-email",
  "/api/",
  "/_next/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // AI search bots — fully allowed so they can cite our content
        userAgent: "GPTBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "anthropic-ai",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        // General crawlers — allow everything except private/functional paths
        userAgent: "*",
        disallow: DISALLOWED,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
