import CreateEditBanner from '@/app/shared/ecommerce/banner/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Banner'),
};

export default function CreateBannerPage() {
  return <CreateEditBanner />;
}
