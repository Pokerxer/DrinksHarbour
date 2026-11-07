import { PendingQueueView } from '@/app/shared/ecommerce/product/pending-queue';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Pending Approvals'),
};

/**
 * Super-admin approval queue for pending central products. The page stays
 * thin: it renders the same shared ecommerce chrome as the products list and
 * hands everything else to the shared pending-queue implementation. Route
 * access is gated super_admin-only in route-roles.ts; the server route
 * guards remain authoritative.
 */
export default function PendingProductsPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <PendingQueueView pageSize={20} />
      </div>
    </>
  );
}
