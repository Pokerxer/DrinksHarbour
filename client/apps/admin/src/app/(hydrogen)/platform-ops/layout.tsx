import ModuleNavHeader from '@/app/shared/module-nav-header';
import { PiShieldCheckBold } from 'react-icons/pi';

/**
 * Platform-ops evidence register: POS-style module chrome (nav header +
 * content canvas), same pattern as the merchant-orders layout precedent.
 * Route href mirrors the hardcoded "/platform-ops" page route (no
 * config/routes.ts key exists; keep the two strings in sync).
 */
export default function PlatformOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Platform operations"
          brandHref="/platform-ops"
          tabs={[
            {
              label: 'Evidence register',
              href: '/platform-ops',
              icon: <PiShieldCheckBold />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
