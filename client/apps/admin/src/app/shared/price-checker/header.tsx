'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { PiBarcode, PiPlus } from 'react-icons/pi';

// Kiosks + Analytics tabs live in the /retail-tools module chrome
// (ModuleNavHeader) since the module header rollout — this header keeps only
// the page title block and the "Create kiosk" CTA.
const ROOT = '/retail-tools/price-checker';
export function PriceCheckerHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const path = usePathname();
  return (
    <header className="pc-heading">
      <div>
        <Link className="pc-eyebrow" href="/retail-tools">
          ERM / RETAIL TOOLS
        </Link>
        <h1>
          <PiBarcode aria-hidden="true" />
          {title}
        </h1>
        <p>{subtitle}</p>
      </div>
      <nav aria-label="Price checker">
        {path !== `${ROOT}/create` && (
          <Link className="pc-button" href={`${ROOT}/create`}>
            <PiPlus /> Create kiosk
          </Link>
        )}
      </nav>
    </header>
  );
}
