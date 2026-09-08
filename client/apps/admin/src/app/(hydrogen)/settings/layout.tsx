import { routes } from '@/config/routes';
import ModuleNavHeader from '@/app/shared/module-nav-header';
import {
  PiGearDuotone,
  PiCreditCardDuotone,
  PiKeyDuotone,
  PiFileTextDuotone,
} from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Settings"
          brandHref={routes.settings}
          tabs={[
            {
              label: 'General',
              href: routes.settings,
              icon: <PiGearDuotone />,
            },
            {
              label: 'Document templates',
              href: routes.documentTemplates,
              icon: <PiFileTextDuotone />,
            },
            {
              label: 'API keys',
              href: '/settings/api-keys',
              icon: <PiKeyDuotone />,
            },
            {
              label: 'Billing',
              href: routes.billing,
              icon: <PiCreditCardDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
