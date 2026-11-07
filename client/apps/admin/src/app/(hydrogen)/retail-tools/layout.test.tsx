// @vitest-environment jsdom
import { chromeContract } from '@/test/module-layout';
import Layout from './layout';
import { routes } from '@/config/routes';

chromeContract({
  Layout: Layout,
  brand: 'Retail tools',
  tabs: [
    { label: 'Tools home', href: '/retail-tools', icon: <i /> },
    { label: 'Kiosks', href: routes.priceChecker.list, icon: <i /> },
    { label: 'Scan analytics', href: routes.priceChecker.analytics, icon: <i /> },
  ],
});
