import { useCallback, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { AppHeader } from '../../components/layout/app-header.tsx';
import { BottomNav } from '../../components/navigation/bottom-nav.tsx';
import { CategoryDrawer } from '../../components/navigation/category-drawer.tsx';
import type { NavItemId } from '../../lib/bottom-nav.ts';
import { useCart } from '../../lib/cart-context.tsx';

/**
 * The tab shell — header on top, the web's five-tab bar at the bottom.
 *
 * `tabBar` is overridden rather than styled because two of the web's five tabs
 * are actions, not routes: Categories opens a drawer and Chat toggles the
 * chatbot. Expo Router's default bar can only render `Tabs.Screen`s, so the
 * whole bar is supplied instead.
 *
 * `shop` stays a registered route but is NOT in the bar — the web has no Shop
 * tab either; `/shop` is reached from the drawer's "All Products" button and
 * from every category link.
 */
export default function TabLayout() {
  const router = useRouter();
  const { cartCount } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleSelect = useCallback(
    (id: NavItemId, pathname: string) => {
      if (id === 'categories') {
        setDrawerOpen(true);
        return;
      }

      if (id === 'chatbot') {
        // The web dispatches `toggle-chatbot` at a widget floating over the
        // page. There is no floating layer here, so the assistant is a screen
        // and the tab navigates to it.
        router.push('/chat');
        return;
      }

      if (id === 'home') {
        router.push('/');
        return;
      }
      if (id === 'profile') {
        router.push('/account');
        return;
      }
      if (id === 'cart') {
        router.push('/cart');
      }
    },
    [router]
  );

  return (
    <>
      <Tabs
        // The web header renders on every page, so it is a screenOption rather
        // than a per-screen one.
        screenOptions={{
          headerShown: true,
          header: () => <AppHeader onOpenMenu={() => setDrawerOpen(true)} />,
        }}
        tabBar={({ state }) => {
          // expo-router names the tab routes; map the focused one back to a path
          // so the web's `pathname.startsWith(...)` rule can be applied as-is.
          const routeName = state.routes[state.index]?.name ?? 'index';
          const pathname =
            routeName === 'index' ? '/' : `/${routeName}`;

          return (
            <BottomNav
              pathname={pathname}
              drawerOpen={drawerOpen}
              cartCount={cartCount}
              onSelect={(id) => handleSelect(id, pathname)}
            />
          );
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="shop" />
        <Tabs.Screen name="cart" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="account" />
      </Tabs>

      <CategoryDrawer visible={drawerOpen} onClose={closeDrawer} />
    </>
  );
}
