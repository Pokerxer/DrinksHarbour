import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import '@/styles/styles.scss';
import GlobalProvider from './GlobalProvider';
import ModalCart from '@/components/Modal/ModalCart';
import ModalWishlist from '@/components/Modal/ModalWishlist';
import ModalSearch from '@/components/Modal/ModalSearch';
import ModalQuickview from '@/components/Modal/ModalQuickview';
import ModalCompare from '@/components/Modal/ModalCompare';
import { Header } from '@/components/Header';
import ModalNewsletter from '@/components/Modal/ModalNewsletter';
import Footer from '@/components/Footer/Footer';

const instrument = Instrument_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DrinksHarbour - Premium Beverages Delivered',
  description: 'Shop premium spirits, wines, beers, and more. Free delivery on orders over ₦50,000.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GlobalProvider>
      <html lang="en">
        <body className={instrument.className}>
          <Header variant="default" showAnnouncement={true} />
          {children}
          <ModalCart />
          <ModalWishlist />
          <ModalSearch />
          <ModalQuickview />
          <ModalCompare />
          <Footer />
          <ModalNewsletter />
        </body>
      </html>
    </GlobalProvider>
  );
}
