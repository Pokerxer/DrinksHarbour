import { PendingQueueView } from '@/app/shared/ecommerce/product/pending-queue';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Pending Approvals'),
};

/**
 * Super-admin approval queue for pending central products. The page stays
 * thin: the products layout owns navigation and the page renders the shared
 * pending-queue implementation. Route
 * access is gated super_admin-only in route-roles.ts; the server route
 * guards remain authoritative.
 */
export default function PendingProductsPage() {
  return (
    <>
      <div className="mt-4">
        <PendingQueueView pageSize={20} />
      </div>
    </>
  );
}
