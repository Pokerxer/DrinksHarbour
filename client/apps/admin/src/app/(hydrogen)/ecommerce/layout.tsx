// @ts-nocheck
import CartDrawer from '@/app/shared/ecommerce/cart/cart-drawer';
// import FloatingCart from '@/app/shared/floating-cart';
import { CartProvider } from '@/store/quick-cart/cart.context';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';

export default function EcommerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
