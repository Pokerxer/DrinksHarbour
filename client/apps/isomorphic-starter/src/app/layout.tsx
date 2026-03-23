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

export const metadata: Metadata = {
  title: "DrinksHarbour - Premium Beverages Delivered",
  description:
    "Shop premium spirits, wines, beers, and more. Free delivery on orders over ₦50,000.",
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
