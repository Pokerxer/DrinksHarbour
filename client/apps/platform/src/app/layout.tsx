import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { elmsSans, kavoon } from "./fonts";
import "@/styles/styles.scss";
import GlobalProvider from "./GlobalProvider";

// Eager — above-the-fold or critical
import { Header } from "@/components/Header";
import Footer from "@/components/Footer/Footer";
import AnalyticsTracker from "@/components/Analytics/AnalyticsTracker";
import FeatureFlagInit from "@/components/Analytics/FeatureFlagInit";
import GoogleAnalytics from "@/components/Analytics/GoogleAnalytics";
import SocialPixels from "@/components/Analytics/SocialPixels";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleAdSense, { ADSENSE_CLIENT_ID } from "@/components/Analytics/GoogleAdSense";
import { TenantProvider } from "@/context/TenantContext";
import { resolveTenant } from "@/lib/tenant";
import { jsonLdHtml } from "@/lib/jsonld";
import { configureCommerceCore } from "commerce-core";

configureCommerceCore({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
});

// Deferred — non-critical UI, code-split into separate chunks
const ModalNewsletter = dynamic(() => import("@/components/Modal/ModalNewsletter"));
const MobileBottomNav = dynamic(() => import("@/components/Navigation").then(mod => mod.MobileBottomNav));
const ChatbotWidget   = dynamic(() => import("@/components/Chatbot/CustomerChatbot"));
const WhatsAppButton  = dynamic(() => import("@/components/WhatsApp/WhatsAppButton"));
const PopupBanner     = dynamic(() => import("@/components/Banner/PopupBanner"));
const FooterPlacementBanner = dynamic(() => import("@/components/Banner/PlacementBanner"));
// AgeGate + CookieConsent read localStorage at mount, so they must render
// client-only (ssr: false). That option is only valid inside a Client Component,
// so they live in ClientOverlays rather than being imported here directly.
import ClientOverlays from "@/components/Layout/ClientOverlays";
import CommerceModals from "@/components/Layout/CommerceModals";
import ExtensionNoiseGuard from "@/components/Layout/ExtensionNoiseGuard";
import CommerceCoreInit from "@/components/Layout/CommerceCoreInit";
import { NATIONWIDE_DELIVERY_PROMISE } from '@/lib/deliveryCopy';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';


const BASE_URL = publicSiteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "DrinksHarbour — Premium Beverages Delivered in Nigeria",
    template: "%s | DrinksHarbour",
  },
  description:
    "Shop Nigeria's widest selection of premium spirits, wines, beers, and non-alcoholic drinks. Authentic products, fast delivery, and the best prices.",
  keywords: [
    "buy wine Nigeria",
    "buy whiskey Nigeria",
    "online liquor store Nigeria",
    "buy alcohol online Lagos",
    "premium beverages Nigeria",
    "DrinksHarbour",
    "buy spirits Nigeria",
    "premium spirits Nigeria",
    "DrinksHarbour Nigeria",
    "wine delivery Lagos",
    "whisky Nigeria",
    "alcohol delivery Abuja",
  ],
  authors: [{ name: "DrinksHarbour", url: BASE_URL }],
  creator: "DrinksHarbour",
  publisher: "DrinksHarbour",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    // Meta (Facebook) Business domain verification — renders a static
    // <meta name="facebook-domain-verification"> in <head> server-side.
    other: {
      "facebook-domain-verification": "d9wv1j9v28vuurdw8fllvs4mg00gx2",
    },
  },
  // Route-relative self-references (resolve per-page, so child routes that don't
  // set their own alternates don't inherit a homepage URL). Reinforces Nigeria
  // targeting on our generic .com, where Google can't infer country from the TLD.
  alternates: {
    canonical: "./",
    languages: {
      "en-NG": "./",
      "x-default": "./",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: BASE_URL,
    siteName: "DrinksHarbour",
    title: "DrinksHarbour — Premium Beverages Delivered in Nigeria",
    description:
      "Nigeria's premier online beverage store. Shop wines, spirits, beers and more with fast delivery.",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "DrinksHarbour — Premium Beverages",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DrinksHarbour — Premium Beverages Delivered in Nigeria",
    description:
      "Nigeria's premier online beverage store. Shop wines, spirits, beers and more with fast delivery.",
    images: ["/og-default.jpg"],
    site: "@drinksharbour",
    creator: "@drinksharbour",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "p:domain_verify": "3d1678895d2b97b7042bdd2fc97753a6",
    ...(ADSENSE_CLIENT_ID ? { "google-adsense-account": ADSENSE_CLIENT_ID } : {}),
    "geo.region": "NG",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  "@id": `${BASE_URL}/#store`,
  name: "DrinksHarbour",
  url: BASE_URL,
  parentOrganization: { "@id": `${BASE_URL}/#organization` },
  logo: `${BASE_URL}/logo.png`,
  image: `${BASE_URL}/og-default.jpg`,
  description: `Nigeria-based online beverage marketplace. ${NATIONWIDE_DELIVERY_PROMISE}`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Wyn City, 39 Gana Street, Maitama",
    addressLocality: "Abuja",
    addressRegion: "FCT",
    postalCode: "900271",
    addressCountry: "NG",
  },
  // OnlineStore inherits Organization, not LocalBusiness/Place. Keep physical
  // opening hours, geo, paymentAccepted and priceRange off this node.
  telephone: "+2347048004020",
  email: "hello@drinksharbour.com",
  areaServed: [
    { "@type": "City", name: "Abuja" },
    { "@type": "Country", name: "Nigeria" },
  ],
  sameAs: [
    "https://twitter.com/drinksharbour",
    "https://www.instagram.com/drinksharbour",
    "https://www.facebook.com/drinksharbour",
  ],
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "DrinksHarbour",
  url: BASE_URL,
  logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
  sameAs: [
    "https://twitter.com/drinksharbour",
    "https://www.instagram.com/drinksharbour",
    "https://www.facebook.com/drinksharbour",
  ],
  contactPoint: [
    { "@type": "ContactPoint", contactType: "customer support", telephone: "+2347048004020", email: "hello@drinksharbour.com", availableLanguage: "English" },
    { "@type": "ContactPoint", contactType: "sales", telephone: "+2347048004020", email: "sales@drinksharbour.com", availableLanguage: "English" },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "DrinksHarbour",
  url: BASE_URL,
  publisher: { "@id": `${BASE_URL}/#organization` },
  description: "Nigeria's premier online beverage store — wines, spirits, beers and non-alcoholic drinks delivered nationwide.",
  inLanguage: "en-NG",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/shop?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve tenant from subdomain (server-side)
  const { tenant } = await resolveTenant();

  return (
    <GlobalProvider>
      <TenantProvider initialTenant={tenant}>
        <html lang="en-NG">
          {/* Site-wide entity graph. Google reads JSON-LD from <body> too, but
              plenty of third-party SEO crawlers and AI summarisers only parse
              <head> — and reported "no structured data" on this site for exactly
              that reason. Nothing here is page-specific, so head is where it
              belongs. Page-level markup (Product, BreadcrumbList, ItemList)
              stays with its route. */}
          <head>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdHtml(localBusinessJsonLd) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdHtml(orgJsonLd) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteJsonLd) }}
            />
            {/* Preconnect to third-party origins */}
            <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
          </head>
          <body className={`${elmsSans.className} ${kavoon.variable}`}>
            {/* Inline at HTML-parse time — BEFORE the Next.js bundle registers
                its dev-overlay error listeners — so wallet-extension errors
                (MetaMask etc.) are stopped at the window before the overlay
                can capture them. Renders nothing; never touches app errors. */}
            <ExtensionNoiseGuard />
            <CommerceCoreInit />
            {/* Speculation Rules — prerender likely navigations on hover */}
            <script type="speculationrules">
              {JSON.stringify({
                prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
              })}
            </script>
            <GoogleAnalytics />
            <SocialPixels />
            <GoogleAdSense />
            <FeatureFlagInit />
            <AnalyticsTracker />
            <Analytics />
            <SpeedInsights />
            <ClientOverlays />
            <Header variant="default" showAnnouncement={false} />
            <main id="main-content">{children}</main>
            <div className="container mx-auto px-4 py-4">
              <FooterPlacementBanner placement="footer" variant="footer" limit={1} />
            </div>
            <CommerceModals />
            <Footer />
            <ModalNewsletter />
            <MobileBottomNav />
            <WhatsAppButton />
            <ChatbotWidget />
            <PopupBanner />
          </body>
        </html>
      </TenantProvider>
    </GlobalProvider>
  );
}
