import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiClipboardTextDuotone, PiWineDuotone } from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader. Route keys mirror the
 * hardcoded "/venue" and "/venue-completion" hrefs in
 * layouts/hydrogen/tenant-menu-items.tsx; neither lives in config/routes.ts.
 *
 * This page accepts a `?visit=` deep link — children are passed through
 * unchanged, so no search params are stripped at this level (searchParams are
 * read by the page itself, not by layouts).
 */
const VENUE_HREF = routes.venue;
const VENUE_COMPLETION_HREF = routes.venueCompletion;

export default function VenueCompletionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Venue"
          brandHref={VENUE_COMPLETION_HREF}
          tabs={[
            {
              label: 'Complete visits',
              href: VENUE_COMPLETION_HREF,
              icon: <PiClipboardTextDuotone />,
            },
            {
              label: 'Workspace',
              href: VENUE_HREF,
              icon: <PiWineDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
