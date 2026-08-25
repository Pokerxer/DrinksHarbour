import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const ProductsView = dynamic(() =>
  import('@/app/shared/accounting/accounting-directories').then((m) => m.ProductsView)
);
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Products') };

export default function ProductsPage() {
  return (
    <AccountingPageShell title="Products" subtitle="Your sellable catalogue">
      <ProductsView />
    </AccountingPageShell>
  );
}
