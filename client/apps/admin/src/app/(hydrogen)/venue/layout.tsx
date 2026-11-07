import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiWineDuotone, PiClipboardTextDuotone } from 'react-icons/pi';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader. Route keys mirror the
 * hardcoded "/venue" and "/venue-completion" hrefs in
 * layouts/hydrogen/tenant-menu-items.tsx; both resolve through
 * config/routes.ts now.
 *
 * The VenueWorkspace below keeps its OWN sticky tool navigation — that is the
 * within-workspace content nav; this layout is the app-level chrome above it
 * and must not duplicate or remove it. The menu entry for /venue is gated by
 * NEXT_PUBLIC_VENUE_EXPERIENCE_ENABLED at the sidebar level only; page-level
 * gating stays inside the workspace. A module header rendering while the
 * route is flagged off is intentional (same choice as the settings group).
 */
const VENUE_HREF = routes.venue;
const VENUE_COMPLETION_HREF = routes.venueCompletion;

export default function VenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Venue"
          brandHref={VENUE_HREF}
          tabs={[
            {
              label: 'Workspace',
              href: VENUE_HREF,
              icon: <PiWineDuotone />,
            },
            {
              label: 'Complete visits',
              href: VENUE_COMPLETION_HREF,
              icon: <PiClipboardTextDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
