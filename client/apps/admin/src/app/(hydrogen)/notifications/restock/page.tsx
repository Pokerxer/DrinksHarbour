import { metaObject } from '@/config/site.config';
import RestockPage from '@/app/shared/notifications/restock/restock-page';
export const metadata = { ...metaObject('Restock recommendations') };
export default function Page() {
  return <RestockPage />;
}
