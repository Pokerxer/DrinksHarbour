// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import EcommerceNavGate from '@/app/shared/ecommerce/ecommerce-nav-gate';
import WhatsAppOrdersLayout from './layout';

const navigation = vi.hoisted(() => ({ pathname: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('@/app/shared/ecommerce/ecommerce-nav-header', () => ({
  default: () => <nav aria-label="Marketplace" />,
}));
vi.mock('@/app/shared/module-nav-header', () => ({
  default: ({
    brand,
    tabs,
  }: {
    brand: string;
    tabs: { label: string; href: string }[];
  }) => (
    <nav aria-label={brand}>
      {tabs.map(({ label, href }) => (
        <a href={href} key={href}>
          {label}
        </a>
      ))}
    </nav>
  ),
}));
afterEach(cleanup);

it.each(['/ecommerce/orders/whatsapp', '/ecommerce/orders/whatsapp/create'])(
  'shows only the WhatsApp navigation at %s',
  (pathname) => {
    navigation.pathname = pathname;
    render(
      <>
        <EcommerceNavGate />
        <WhatsAppOrdersLayout>Order content</WhatsAppOrdersLayout>
      </>
    );
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const header = screen.getByRole('navigation', { name: 'WhatsApp orders' });
    expect(
      within(header)
        .getByRole('link', { name: 'All orders' })
        .getAttribute('href')
    ).toBe('/ecommerce/orders');
    expect(
      within(header)
        .getByRole('link', { name: 'New order' })
        .getAttribute('href')
    ).toBe('/ecommerce/orders/whatsapp/create');
  }
);

it.each(['/ecommerce/orders', '/ecommerce/orders/whatsapp-example'])(
  'keeps Marketplace navigation at %s',
  (pathname) => {
    navigation.pathname = pathname;
    render(<EcommerceNavGate />);
    expect(
      screen.getByRole('navigation', { name: 'Marketplace' })
    ).toBeTruthy();
  }
);
