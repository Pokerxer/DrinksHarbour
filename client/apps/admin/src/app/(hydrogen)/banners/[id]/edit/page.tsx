import { use } from 'react';
import CreateEditBanner from '@/app/shared/ecommerce/banner/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Edit Banner'),
};

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreateEditBanner bannerId={id} />;
}
