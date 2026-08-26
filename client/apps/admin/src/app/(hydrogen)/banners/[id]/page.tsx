import BannerDetailsView from '@/app/shared/ecommerce/banner/banner-details/banner-details';

// The view owns its header — the title comes from the fetched banner.
export default async function BannerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BannerDetailsView id={id} />;
}
