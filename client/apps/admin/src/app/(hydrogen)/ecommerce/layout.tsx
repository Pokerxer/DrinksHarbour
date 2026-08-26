// @ts-nocheck
import CartDrawer from '@/app/shared/ecommerce/cart/cart-drawer';
// import FloatingCart from '@/app/shared/floating-cart';
import { CartProvider } from '@/store/quick-cart/cart.context';
import EcommerceNavGate from '@/app/shared/ecommerce/ecommerce-nav-gate';

export default function EcommerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <EcommerceNavGate />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
