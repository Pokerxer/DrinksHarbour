import ModuleNavHeader from '@/app/shared/module-nav-header';
import { PiGaugeDuotone, PiSteeringWheelDuotone, PiPackageDuotone, PiUsersThreeDuotone } from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader.
 */
export default function LogisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Logistics"
          tabs={[
            { label: 'Dashboard', href: '/logistics', icon: <PiGaugeDuotone /> },
            { label: 'Drivers', href: '/logistics/drivers', icon: <PiSteeringWheelDuotone /> },
            { label: 'Shipments', href: '/logistics/shipments', icon: <PiPackageDuotone /> },
            { label: 'Customers', href: '/logistics/customer-profile', icon: <PiUsersThreeDuotone /> },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
