'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { PiBarcode, PiChartBar, PiPlus } from 'react-icons/pi';
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
        <Link href={ROOT} aria-current={path === ROOT ? 'page' : undefined}>
          Kiosks
        </Link>
        <Link
          href={`${ROOT}/analytics`}
          aria-current={path === `${ROOT}/analytics` ? 'page' : undefined}
        >
          <PiChartBar /> Analytics
        </Link>
        {path !== `${ROOT}/create` && (
          <Link className="pc-button" href={`${ROOT}/create`}>
            <PiPlus /> Create kiosk
          </Link>
        )}
      </nav>
    </header>
  );
}
