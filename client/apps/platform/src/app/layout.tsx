import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Elms_Sans, Kavoon } from "next/font/google";
import "@/styles/styles.scss";
import GlobalProvider from "./GlobalProvider";

// Eager — above-the-fold or critical
import { Header } from "@/components/Header";
import Footer from "@/components/Footer/Footer";
import AnalyticsTracker from "@/components/Analytics/AnalyticsTracker";
import { TenantProvider } from "@/context/TenantContext";
import { resolveTenant } from "@/lib/tenant";

// Deferred — non-critical UI, code-split into separate chunks
const ModalCart       = dynamic(() => import("@/components/Modal/ModalCart"));
const ModalWishlist   = dynamic(() => import("@/components/Modal/ModalWishlist"));
const ModalSearch     = dynamic(() => import("@/components/Modal/ModalSearch"));
const ModalQuickview  = dynamic(() => import("@/components/Modal/ModalQuickview"));
const ModalCompare    = dynamic(() => import("@/components/Modal/ModalCompare"));
const ModalNewsletter = dynamic(() => import("@/components/Modal/ModalNewsletter"));
const MobileBottomNav = dynamic(() => import("@/components/Navigation").then(mod => mod.MobileBottomNav));
const ChatbotWidget   = dynamic(() => import("@/components/Chatbot/ChatbotWidget"));
const WhatsAppButton  = dynamic(() => import("@/components/WhatsApp/WhatsAppButton"));
const PopupBanner     = dynamic(() => import("@/components/Banner/PopupBanner"));
const FooterPlacementBanner = dynamic(() => import("@/components/Banner/PlacementBanner"));
// AgeGate + CookieConsent read localStorage at mount, so they must render
// client-only (ssr: false). That option is only valid inside a Client Component,
// so they live in ClientOverlays rather than being imported here directly.
import ClientOverlays from "@/components/Layout/ClientOverlays";

const elmsSans = Elms_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-elms",
  display: "swap",
});
const kavoon = Kavoon({ subsets: ["latin"], weight: ["400"], variable: "--font-kavoon", display: "swap" });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

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
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "p:domain_verify": "3d1678895d2b97b7042bdd2fc97753a6",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "DrinksHarbour",
  url: BASE_URL,
  logo: `${BASE_URL}/images/logo.png`,
  image: `${BASE_URL}/images/logo.png`,
  description: "Nigeria's premier online premium beverages store — whisky, wine, spirits, beer and non-alcoholic drinks delivered to Lagos, Abuja, Port Harcourt and nationwide.",
  geo: {
    "@type": "GeoCoordinates",
    latitude: 9.0782726,
    longitude: 7.5005914,
  },
  email: "hello@drinksharbour.com",
  currenciesAccepted: "NGN",
  paymentAccepted: "Cash, Credit Card, Bank Transfer",
  priceRange: "₦₦₦",
  areaServed: [
    { "@type": "City", name: "Abuja" },
    { "@type": "City", name: "Lagos" },
    { "@type": "City", name: "Port Harcourt" },
    { "@type": "Country", name: "Nigeria" },
  ],
  sameAs: [
    "https://twitter.com/drinksharbour",
    "https://www.instagram.com/drinksharbour",
    "https://www.facebook.com/drinksharbour",
  ],
  hasMap: `https://www.google.com/maps?q=9.0782726,7.5005914`,
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DrinksHarbour",
  url: BASE_URL,
  logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
  sameAs: [
    "https://twitter.com/drinksharbour",
    "https://www.instagram.com/drinksharbour",
    "https://www.facebook.com/drinksharbour",
  ],
  contactPoint: [
    { "@type": "ContactPoint", contactType: "customer support", telephone: "+234-1-234-5678", email: "hello@drinksharbour.com", availableLanguage: "English" },
    { "@type": "ContactPoint", contactType: "sales", telephone: "+234-1-234-5679", email: "sales@drinksharbour.com", availableLanguage: "English" },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DrinksHarbour",
  url: BASE_URL,
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
          <body className={`${elmsSans.className} ${kavoon.variable}`}>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
            />
            {/* Preconnect to third-party origins */}
            <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
            {/* Speculation Rules — prerender likely navigations on hover */}
            <script type="speculationrules">
              {JSON.stringify({
                prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
              })}
            </script>
            <AnalyticsTracker />
            <ClientOverlays />
            <Header variant="default" showAnnouncement={false} />
            <main id="main-content">{children}</main>
            <div className="container mx-auto px-4 py-4">
              <FooterPlacementBanner placement="footer" variant="footer" limit={1} />
            </div>
            <ModalCart />
            <ModalWishlist />
            <ModalSearch />
            <ModalQuickview />
            <ModalCompare />
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
