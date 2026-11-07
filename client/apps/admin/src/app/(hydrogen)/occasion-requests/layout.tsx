import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiClipboardTextDuotone } from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader. Route key mirrors the
 * hardcoded "/occasion-requests" href in layouts/hydrogen/menu-items.tsx
 * ("Occasion requests", platformOnly);
 * config/route-roles.ts refuses tenant roles for /occasion-requests and the
 * queue/detail views enforce the platform-admin check themselves — this
 * header stays above that gating, untouched.
 *
 * activeModuleHref gives /occasion-requests/:id deep-link matching back to
 * the Queue tab automatically (longest-prefix rule).
 */
const QUEUE_HREF = routes.occasionRequests;

export default function OccasionRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Occasions"
          brandHref={QUEUE_HREF}
          tabs={[
            {
              label: 'Request queue',
              href: QUEUE_HREF,
              icon: <PiClipboardTextDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
