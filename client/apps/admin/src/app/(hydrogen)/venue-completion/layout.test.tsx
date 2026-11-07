// @vitest-environment jsdom
import { chromeContract } from '@/test/module-layout';
import Layout from './layout';

chromeContract({
  Layout: Layout,
  brand: 'Venue',
  tabs: [
    { label: 'Complete visits', href: '/venue-completion', icon: <i /> },
    { label: 'Workspace', href: '/venue', icon: <i /> },
  ],
});
