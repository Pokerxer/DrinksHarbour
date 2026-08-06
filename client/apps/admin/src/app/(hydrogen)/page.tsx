import MenuHomePage from '@/app/shared/home/menu-home-page';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Home'),
};

export const dynamic = 'force-dynamic';

export default function RootIndexPage() {
  return <MenuHomePage />;
}
