import SavedInvoiceView from '@/app/shared/accounting/saved-invoice-view';
import { metaObject } from '@/config/site.config';
export const metadata = { ...metaObject('Accounting — Customer invoice') };
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavedInvoiceView id={id} />;
}
