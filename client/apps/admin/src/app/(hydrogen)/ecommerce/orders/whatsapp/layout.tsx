import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiPlusCircleDuotone, PiReceiptDuotone, PiWhatsappLogoDuotone } from 'react-icons/pi';

const LIST_HREF = routes.whatsappOrders.list;

export default function WhatsAppOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="WhatsApp orders"
          brandHref={LIST_HREF}
          tabs={[
            {
              label: 'All orders',
              href: routes.eCommerce.orders,
              icon: <PiReceiptDuotone />,
            },
            {
              label: 'Intake',
              href: LIST_HREF,
              icon: <PiWhatsappLogoDuotone />,
            },
            {
              label: 'New order',
              href: routes.whatsappOrders.create,
              icon: <PiPlusCircleDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
