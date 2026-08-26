import BannersTable from '@/app/shared/ecommerce/banner/banner-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Banners'),
};

// The POS-style shell (nav + hero) lives in layout.tsx and the list view.
export default function BannersPage() {
  return <BannersTable pageSize={20} />;
}
