/**
 * The bottom tab bar's shape — `apps/platform/src/components/Navigation/
 * MobileBottomNav.tsx:21-27`, read literally.
 *
 * Note what the web's five tabs are NOT: there is no Shop tab. `/shop` is
 * reached from the Categories drawer's "All Products" button, so the mobile
 * `shop` route stays a route and simply leaves the tab bar.
 *
 * Two of the five are actions rather than destinations — Categories opens the
 * drawer, Chat toggles the chatbot — which is why `route` is optional.
 */

export type NavItemId = 'home' | 'categories' | 'profile' | 'cart' | 'chatbot';

export interface NavItem {
  id: NavItemId;
  label: string;
  /** @expo/vector-icons Ionicons glyphs; the web draws the Phosphor equivalents. */
  icon: string;
  activeIcon: string;
  /** Absent for the two tabs that are actions, not destinations. */
  route?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/' },
  { id: 'categories', label: 'Categories', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'profile', label: 'Me', icon: 'person-outline', activeIcon: 'person', route: '/account' },
  { id: 'cart', label: 'Cart', icon: 'cart-outline', activeIcon: 'cart', route: '/cart' },
  {
    id: 'chatbot',
    label: 'Chat',
    icon: 'chatbubble-outline',
    activeIcon: 'chatbubble',
  },
];

export function navItem(id: NavItemId): NavItem {
  const found = NAV_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`unknown nav item: ${id}`);
  return found;
}

/**
 * The web's rule verbatim (`isActive`, line 153-156) plus its one special case:
 * Categories lights up while its drawer is open.
 *
 * Home is compared exactly rather than by prefix — `startsWith('/')` is true of
 * every route, which would leave Home lit on every screen.
 */
export function isNavItemActive(item: NavItem, pathname: string, drawerOpen: boolean): boolean {
  if (item.id === 'categories') return drawerOpen;
  if (!item.route) return false;
  return item.route === '/' ? pathname === '/' : pathname.startsWith(item.route);
}
