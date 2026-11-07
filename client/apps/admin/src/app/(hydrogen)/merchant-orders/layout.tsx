import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiReceiptDuotone } from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader. Route key mirrors the
 * hardcoded "/merchant-orders" href in layouts/hydrogen/tenant-menu-items.tsx
 * ("Merchant fulfillment"); both resolve through config/routes.ts now.
 */
const MERCHANT_ORDERS_HREF = routes.merchantOrders;

export default function MerchantOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Merchant orders"
          brandHref={MERCHANT_ORDERS_HREF}
          tabs={[
            {
              label: 'Fulfillment',
              href: MERCHANT_ORDERS_HREF,
              icon: <PiReceiptDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
