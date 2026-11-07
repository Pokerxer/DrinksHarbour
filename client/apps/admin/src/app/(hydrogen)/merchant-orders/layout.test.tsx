// @vitest-environment jsdom
import { chromeContract } from '@/test/module-layout';
import Layout from './layout';

chromeContract({
  Layout: Layout,
  brand: 'Merchant orders',
  tabs: [{ label: 'Fulfillment', href: '/merchant-orders', icon: <i /> }],
});
