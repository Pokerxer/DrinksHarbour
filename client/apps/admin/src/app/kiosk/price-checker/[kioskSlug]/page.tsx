import PriceCheckerKiosk from '@/components/price-checker/kiosk';
import { notFound } from 'next/navigation';
export default async function KioskPage({ params }: { params: Promise<{ kioskSlug: string }> }) {
  const { kioskSlug } = await params;
  if (kioskSlug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kioskSlug)) notFound();
  return <PriceCheckerKiosk slug={kioskSlug} />;
}
