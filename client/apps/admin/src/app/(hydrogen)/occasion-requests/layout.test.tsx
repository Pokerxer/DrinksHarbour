// @vitest-environment jsdom
import { chromeContract } from '@/test/module-layout';
import Layout from './layout';

chromeContract({
  Layout: Layout,
  brand: 'Occasions',
  tabs: [{label: 'Request queue', href: '/occasion-requests', icon: <i /> }],
});
