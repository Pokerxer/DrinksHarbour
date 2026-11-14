import PairingsTable from '@/app/shared/merchandising/pairings/pairings-table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Merchandising'),
};

// The POS-style shell (nav + canvas) lives in layout.tsx and the list view.
export default function MerchandisingPage() {
  return <PairingsTable pageSize={20} />;
}
