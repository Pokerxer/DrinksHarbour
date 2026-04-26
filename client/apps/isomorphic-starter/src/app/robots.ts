import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop", "/product/", "/about", "/blog", "/contact", "/faqs"],
        disallow: [
          "/my-account/",
          "/checkout",
          "/cart",
          "/order-confirmation",
          "/order-tracking",
          "/reset-password",
          "/verify-email",
          "/api/",
          "/_next/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
