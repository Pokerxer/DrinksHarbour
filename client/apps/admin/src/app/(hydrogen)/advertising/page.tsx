import WalletCard from '@/app/shared/ads/wallet-card';
import CampaignsTable from '@/app/shared/ads/campaigns-table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Advertising'),
};

// The POS-style shell (nav + canvas) lives in layout.tsx. The prepaid wallet
// sits above the campaign list — it is the gate for activation.
export default function AdvertisingPage() {
  return (
    <div className="space-y-5">
      <WalletCard />
      <CampaignsTable pageSize={20} />
    </div>
  );
}
