// @vitest-environment jsdom
import { chromeContract } from '@/test/module-layout';
import Layout from './layout';

chromeContract({
  Layout: Layout,
  brand: 'Bookings',
  // Hrefs mirror layouts/hydrogen/tenant-menu-items.tsx ("Venue bookings").
  tabs: [{ label: 'Venue bookings', href: '/bookings', icon: <i /> }],
});
