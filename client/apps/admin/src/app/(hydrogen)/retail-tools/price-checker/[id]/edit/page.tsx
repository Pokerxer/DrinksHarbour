import KioskEditor from '@/app/shared/price-checker/editor';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KioskEditor id={id} />;
}
