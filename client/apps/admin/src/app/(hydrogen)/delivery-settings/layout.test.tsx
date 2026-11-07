// @vitest-environment jsdom
import { chromeContract } from '@/test/module-layout';
import Layout from './layout';

chromeContract({
  Layout: Layout,
  brand: 'Delivery',
  tabs: [{ label: 'Configuration', href: '/delivery-settings', icon: <i /> }],
});
