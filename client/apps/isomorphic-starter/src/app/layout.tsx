import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/styles.scss";
import GlobalProvider from "./GlobalProvider";
import ModalCart from "@/components/Modal/ModalCart";
import ModalWishlist from "@/components/Modal/ModalWishlist";
import ModalSearch from "@/components/Modal/ModalSearch";
import ModalQuickview from "@/components/Modal/ModalQuickview";
import ModalCompare from "@/components/Modal/ModalCompare";
import { Header } from "@/components/Header";
import { MobileBottomNav } from "@/components/Navigation";
import ModalNewsletter from "@/components/Modal/ModalNewsletter";
import Footer from "@/components/Footer/Footer";
import ChatbotWidget from "@/components/Chatbot/ChatbotWidget";

const inter = Inter({ subsets: ["latin"] });

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

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DrinksHarbour",
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  sameAs: [
    "https://twitter.com/drinksharbour",
    "https://www.instagram.com/drinksharbour",
    "https://www.facebook.com/drinksharbour",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: "English",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GlobalProvider>
      <html lang="en">
        <body className={inter.className}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
          />
          <Header variant="default" showAnnouncement={false} />
          {children}
          <ModalCart />
          <ModalWishlist />
          <ModalSearch />
          <ModalQuickview />
          <ModalCompare />
          <Footer />
          <ModalNewsletter />
          <MobileBottomNav />
          <ChatbotWidget />
        </body>
      </html>
    </GlobalProvider>
  );
}
