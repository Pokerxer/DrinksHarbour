import CampaignForm from '@/app/shared/ads/campaign-form';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('New Campaign'),
};

export default function CreateCampaignPage() {
  return <CampaignForm />;
}
