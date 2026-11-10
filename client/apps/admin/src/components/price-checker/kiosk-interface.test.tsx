// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PriceCheckerKiosk from './kiosk';
import type { KioskConfig, KioskProduct } from './types';

const state = vi.hoisted(() => ({
  scan: vi.fn(),
  screen: 'idle',
  product: null as KioskProduct | null,
}));
vi.mock('./use-kiosk', () => ({
  useKiosk: () => ({
    config: {
      slug: 'counter',
      currency: 'NGN',
      settings: {
        manualEntry: true,
        theme: 'light',
        fullscreen: false,
        enableCompare: true,
      } as KioskConfig['settings'],
    } as KioskConfig,
    screen: state.screen,
    product: state.product,
    remaining: 0,
    scan: state.scan,
    reset: vi.fn(() => {
      state.screen = 'idle';
    }),
    initialize: vi.fn(),
    openCompare: vi.fn(() => {
      state.screen = 'compare';
    }),
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.screen = 'idle';
  state.product = null;
  sessionStorage.clear();
});

it('restores keyboard focus to the manual-entry trigger when closed', () => {
  render(<PriceCheckerKiosk slug="counter" />);
  const trigger = screen.getByRole('button', { name: 'Enter barcode' });
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByLabelText('Product barcode'));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('associates invalid barcode feedback with the field and clears it on edit', () => {
  render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter barcode' }));
  const input = screen.getByLabelText('Product barcode');
  fireEvent.change(input, { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check price' }));
  const error = screen.getByRole('alert');
  expect(input.getAttribute('aria-describedby')).toBe(error.id);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(state.scan).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '0012345' } });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Check price' }));
  expect(state.scan).toHaveBeenCalledWith('0012345');
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Enter barcode' })
  );
});

it('closes manual entry with Escape and restores focus', () => {
  render(<PriceCheckerKiosk slug="counter" />);
  const trigger = screen.getByRole('button', { name: 'Enter barcode' });
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(screen.getByLabelText('Product barcode'), {
    key: 'Escape',
  });
  expect(screen.queryByLabelText('Product barcode')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('requires age confirmation again after an alcoholic product is rescanned', () => {  state.screen = 'result';
  state.product = {
    name: 'Wine',
    price: 1000,
    currency: 'NGN',
    alcoholic: true,
    taxLabel: '',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'I am 18 or older' }));
  expect(screen.getByRole('region', { name: 'Product price' })).toBeTruthy();
  state.screen = 'loading';
  state.product = null;
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  state.screen = 'result';
  state.product = {
    name: 'Wine',
    price: 1000,
    currency: 'NGN',
    alcoholic: true,
    taxLabel: '',
  };
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  expect(screen.getByRole('button', { name: 'I am 18 or older' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Product price' })).toBeNull();
});

it('offers to add a scanned bottle to the comparison tray', () => {
  state.screen = 'result';
  state.product = {
    name: 'Hibiki 17',
    price: 95000,
    currency: 'NGN',
    alcoholic: true,
    taxLabel: 'VAT incl.',
    barcode: '490187700713',
  };
  render(<PriceCheckerKiosk slug="counter" />);
  // Age gate consumes the first interaction…
  fireEvent.click(screen.getByRole('button', { name: 'I am 18 or older' }));
  const add = screen.getByRole('button', { name: 'Add to compare' });
  fireEvent.click(add);
  // …and the button acknowledges the add once the bottle sits in the tray.
  expect(screen.getByRole('button', { name: 'Added ✓' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Bottles to compare' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: /Compare \(1\)/i }).hasAttribute('disabled')
  ).toBe(true);
});

it('keeps the tray across a reset and opens the comparison screen', () => {
  state.screen = 'result';
  state.product = {
    name: 'Glen Grant 12',
    price: 42000,
    currency: 'NGN',
    alcoholic: true,
    taxLabel: 'VAT incl.',
    barcode: '5031017000123',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'I am 18 or older' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  const second = {
    name: 'Talisker 10',
    price: 38000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: 'VAT incl.',
    barcode: '0887680046531',
  };
  state.product = second;
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  expect(screen.getAllByRole('button', { name: 'Added ✓' })).toHaveLength(1);
  // Auto-reset returns to the welcome screen with the tray intact.
  state.screen = 'idle';
  state.product = null;
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  expect(screen.getByRole('region', { name: 'Bottles to compare' })).toBeTruthy();
  const compare = screen.getByRole('button', { name: 'Compare (2)' });
  fireEvent.click(compare);
  state.screen = 'compare';
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  expect(screen.getByRole('region', { name: 'Bottle comparison' })).toBeTruthy();
  expect(screen.getByText('Best value')).toBeTruthy();
});

it('announces the tray as full once four bottles are held', () => {
  state.screen = 'result';
  state.product = {
    name: 'Fifth bottle',
    price: 1000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '000000000005',
  };
  const held = ['001', '002', '003', '004'].map((barcode) => ({
    name: `Bottle ${barcode}`,
    price: 1000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: `49018700000${barcode}`,
  }));
  sessionStorage.setItem(
    'price-checker-compare-counter',
    JSON.stringify(held)
  );
  const view = render(<PriceCheckerKiosk slug="counter" />);
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  // With the tray full the scanned bottle offers a one-tap swap of the
  // oldest-held bottle instead of a dead end.
  expect(
    String(
      screen.getByRole('button', { name: 'Replace oldest — Bottle 001' })
        .textContent ?? ''
    )
  ).toContain('Replace oldest');
});

it('a quick tap on "Hold to clear" does not wipe the tray', () => {
  state.screen = 'result';
  state.product = {
    name: 'Snappy bottle',
    price: 1000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000009',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  // preseed the tray through the result screen
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  expect(screen.getAllByRole('region', { name: 'Bottles to compare' })).toBeTruthy();
  // A quick tap (no hold ring running) must not wipe the tray.
  fireEvent.click(screen.getByRole('button', { name: 'Hold to clear' }));
  const tray = screen.getAllByRole('region', { name: 'Bottles to compare' });
  expect(tray).toBeTruthy();
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  expect(screen.getAllByRole('region', { name: 'Bottles to compare' })).toBeTruthy();
});

it('the tray "Scan again" button returns the kiosk to the welcome screen', () => {
  state.screen = 'result';
  state.product = {
    name: 'Bottle X',
    price: 3000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000010',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  const again = screen.getByRole('button', { name: 'Scan again for Bottle X' });
  fireEvent.click(again);
  expect(state.screen).toBe('idle');
});

it('shows a session summary on the welcome screen after a comparison closes', () => {
  state.screen = 'result';
  state.product = {
    name: 'Stout one',
    price: 42000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000011',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  state.product = {
    name: 'Lager two',
    price: 58000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000012',
  };
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  state.screen = 'compare';
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  state.screen = 'idle';
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  const recap = screen.getByRole('status');
  expect(String(recap.textContent)).toContain('Compared 2 bottles');
  expect(String(recap.textContent)).toContain('Stout one');
  expect(String(recap.textContent)).toContain('₦58,000');
});

it('wipes the customer session after five idle minutes', () => {
  vi.useFakeTimers();
  state.screen = 'result';
  state.product = {
    name: 'Idle bottle',
    price: 12000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000013',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  state.screen = 'idle';
  state.product = null;
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  expect(screen.getAllByRole('region', { name: 'Bottles to compare' })).toBeTruthy();
  vi.advanceTimersByTime(5 * 60_000 + 200);
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  expect(screen.queryByRole('region', { name: 'Bottles to compare' })).toBeNull();
});

it('the tray swap button arms the next scan to replace that slot', () => {
  state.screen = 'result';
  state.product = {
    name: 'Swap-in bottle',
    price: 9000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000014',
  };
  const view = render(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  const swap = screen.getByRole('button', { name: 'Next scan will replace Swap-in bottle' });
  fireEvent.click(swap);
  expect(screen.getByRole('status').textContent).toContain(
    'Next scan replaces'
  );
  // The customer scans the next bottle: same add path, swapped in place.
  state.product = {
    name: 'Next bottle',
    price: 11000,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    barcode: '490187000015',
  };
  state.screen = 'result';
  view.rerender(<PriceCheckerKiosk slug="counter" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
  expect(screen.queryByText('Swap-in bottle')).toBeNull();
  expect(screen.getAllByText('Next bottle').length).toBeGreaterThan(0);
});
