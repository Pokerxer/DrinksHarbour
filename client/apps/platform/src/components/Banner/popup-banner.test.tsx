// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import PopupBanner from './PopupBanner';

// The redesigned popup strategy:
//   – never pops on entry: earliest of 15s dwell / 40% scroll / exit intent
//   – one popup per visit; round-robin across live campaigns
//   – per-campaign once-per-day frequency + 30-minute global cooldown

const TWO_BANNERS = [
  {
    _id: 'banner-a',
    title: 'Campaign A',
    image: { url: 'https://x/a.png' },
    ctaText: 'Shop',
    ctaLink: '/shop',
    linkType: 'internal',
  },
  {
    _id: 'banner-b',
    title: 'Campaign B',
    image: { url: 'https://x/b.png' },
    ctaText: 'Shop',
    ctaLink: '/shop',
    linkType: 'internal',
  },
];

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const fetchMock = vi.fn((url: any) => {
  const u = String(url);
  if (u.includes('/api/banners/placement/popup')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: TWO_BANNERS }),
    });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock as any);
  fetchMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
});

async function flushFetches() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('PopupBanner strategy', () => {
  it('does not pop immediately on page entry', async () => {
    render(<PopupBanner />);
    await flushFetches();
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(document.body.textContent).not.toContain('Campaign A');
  });

  it('shows after the default 15s dwell; rotation + cooldown gate the next visit', async () => {
    const first = render(<PopupBanner />);
    await flushFetches();
    act(() => { vi.advanceTimersByTime(16_000); });
    expect(document.body.textContent).toContain('Campaign A');
    act(() => { first.unmount(); });

    // Second page-load within 30 minutes: the global cooldown suppresses
    // the popup even though campaign B is next in rotation.
    const second = render(<PopupBanner />);
    await flushFetches();
    act(() => { vi.advanceTimersByTime(16_000); });
    expect(document.body.textContent).not.toContain('Campaign B');
    act(() => { second.unmount(); });

    // After the cooldown the rotation serves campaign B.
    act(() => { vi.advanceTimersByTime(31 * 60_000); });
    const third = render(<PopupBanner />);
    await flushFetches();
    act(() => { vi.advanceTimersByTime(16_000); });
    expect(document.body.textContent).toContain('Campaign B');
    act(() => { third.unmount(); });
  });

  it('shows on exit intent (mouse leaving the viewport) before the dwell timer', async () => {
    const view = render(<PopupBanner />);
    await flushFetches();
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseleave', { clientY: -5, clientX: 400, bubbles: true }));
    });
    expect(document.body.textContent).toContain('Campaign A');
    act(() => { view.unmount(); });
  });

  it('shows on scroll depth before the dwell timer', async () => {
    const view = render(<PopupBanner />);
    await flushFetches();
    act(() => {
      Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, configurable: true });
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(document.body.textContent).toContain('Campaign A');
    act(() => { view.unmount(); });
  });

  it('never shows while the 30-minute cooldown is active', async () => {
    localStorage.setItem('dh_popup_last_shown', String(Date.now() - 10 * 60_000));
    const view = render(<PopupBanner />);
    await flushFetches();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(document.body.textContent).not.toContain('Campaign A');
    act(() => { view.unmount(); });
  });
});
