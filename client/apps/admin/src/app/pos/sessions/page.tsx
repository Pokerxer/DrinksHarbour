import { metaObject } from '@/config/site.config';
import POSSessions from '@/app/shared/point-of-sale/pos-sessions';

export const metadata = { ...metaObject('POS - Sessions') };

export default async function POSSessionsPage({ searchParams }: { searchParams: Promise<{ shopId?: string }> }) {
  const { shopId } = await searchParams;
  return <POSSessions initialShopId={shopId === 'legacy' ? 'legacy' : undefined} />;
}
