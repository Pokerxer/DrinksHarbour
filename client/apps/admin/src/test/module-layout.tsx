// @vitest-environment jsdom
// Shared jsdom harness for the new (hydrogen) route-group layouts. Every
// layout under test keeps the same chrome contract (see
// src/app/shared/module-nav-header.tsx): app launcher, brand link, tab strip
// with active deep-link matching, and a mobile Menu button that opens every
// group destination.
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import type { ModuleNavItem } from '@/app/shared/module-nav-header';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/layouts/hydrogen/app-launcher', () => ({
  LauncherButton: () => <button aria-label="Open apps" />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  // Test stand-in for next/image — plain span keeps eslint's no-img-element
  // out of a test-only file.
  default: ({ alt }: { alt: string }) => <span data-testid="module-logo">{alt}</span>,
}));
vi.mock('@/app/shared/warehouses/mobile-nav-menu', () => ({
  default: ({
    items,
    open,
  }: {
    items: { label: string }[];
    open: boolean;
  }) =>
    open && items.length ? (
      <ul>{items.map((item) => <li key={item.label}>{item.label}</li>)}</ul>
    ) : null,
  activeMobileNavLabel: () => null,
}));

const usePathnameMock = vi.mocked(usePathname);

export type ModuleLayout = (props: {
  children: React.ReactNode;
}) => React.ReactElement;

afterEach(() => {
  cleanup();
  usePathnameMock.mockReset();
});

export function chromeContract(options: {
  Layout: ModuleLayout;
  brand: string;
  tabs: ModuleNavItem[];
}) {
  const { Layout, brand, tabs } = options;

  it('renders POS-style module chrome around route content', () => {
    usePathnameMock.mockReturnValue(tabs[0].href);
    render(
      <Layout>
        <p>content-body</p>
      </Layout>
    );
    expect(screen.getByRole('button', { name: 'Open apps' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: new RegExp(brand) })
    ).toBeTruthy();
    for (const tab of tabs) {
      const link = screen.getByRole('link', { name: tab.label });
      expect(link.getAttribute('href')).toBe(tab.href);
    }
    expect(
      screen.getByRole('link', { name: tabs[0].label }).getAttribute('aria-current')
    ).toBe('page');
    expect(screen.getByText('content-body')).toBeTruthy();
  });

  it('deep links activate the longest-matching tab', () => {
    const deep = tabs[tabs.length - 1];
    usePathnameMock.mockReturnValue(`${deep.href}/nested`);
    render(
      <Layout>
        <p>content-body</p>
      </Layout>
    );
    const deepLink = screen.getByRole('link', { name: deep.label });
    expect(deepLink.getAttribute('aria-current')).toBe('page');
    const first = screen.queryByRole('link', { name: tabs[0].label });
    if (first && tabs.length > 1) {
      expect(first.getAttribute('aria-current')).toBeNull();
    }
  });

  it('mobile Menu button opens every group destination', () => {
    usePathnameMock.mockReturnValue(tabs[0].href);
    render(
      <Layout>
        <p>content-body</p>
      </Layout>
    );
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(menu);
    const list = screen.getByRole('list');
    expect(list.querySelectorAll('li').length).toBe(tabs.length);
  });
}
