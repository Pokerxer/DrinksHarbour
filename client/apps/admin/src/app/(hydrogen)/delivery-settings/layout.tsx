import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiTruckDuotone } from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader. The delivery-settings
 * group has a single page (per-location contract configuration + history are
 * sections of that view, not routes), so the tab strip is one entry — same
 * shape as the (hydrogen)/analytics layout.
 *
 * Route key mirrors the middleware/route-roles paths (/delivery-settings is
 * platform-only); the platformMd role gate stays inside the view component.
 */
const DELIVERY_HREF = routes.deliverySettings;

export default function DeliverySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Delivery"
          brandHref={DELIVERY_HREF}
          tabs={[
            {
              label: 'Configuration',
              href: DELIVERY_HREF,
              icon: <PiTruckDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
