import Link from 'next/link';
import { PiBarcode, PiChartBar, PiMonitor, PiArrowUpRight } from 'react-icons/pi';
import '@/app/shared/price-checker/admin.css';
import '@/app/shared/price-checker/tools-home.css';
import '@/app/shared/price-checker/workflows.css';
export default function RetailToolsPage() {
  return (
    <div className="pc-admin pc-tools-home">
      <header>
        <span className="pc-eyebrow">DRINKSHARBOUR ERM</span>
        <h1>
          Better tools for
          <br />
          your shop floor.
        </h1>
        <p>Help customers check prices and understand what catches their attention.</p>
      </header>
      <section className="pc-tools-feature">
        <div className="pc-tools-symbol">
          <PiBarcode aria-hidden="true" />
        </div>
        <div>
          <span className="pc-eyebrow">CUSTOMER PRICE CHECKER</span>
          <h2>Every scan starts with confidence.</h2>
          <p>
            Turn a screen into a store-specific price guide, connected to your catalogue, stock
            location and retail prices.
          </p>
          <Link className="pc-button" href="/retail-tools/price-checker">
            Manage price checkers <PiArrowUpRight />
          </Link>
        </div>
      </section>
      <div className="pc-tools-grid">
        {[
          {
            icon: PiMonitor,
            title: 'Set up a screen',
            text: 'Choose the store, configure the display and generate its kiosk link.',
            href: '/retail-tools/price-checker/create',
            action: 'Create kiosk',
          },
          {
            icon: PiChartBar,
            title: 'Learn from every scan',
            text: 'Find popular products, unknown barcodes and low-stock interest.',
            href: '/retail-tools/price-checker/analytics',
            action: 'View scan analytics',
          },
        ].map(({ icon: Icon, title, text, href, action }) => (
          <section className="pc-card" key={href}>
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
            <Link href={href}>
              {action} <PiArrowUpRight />
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
