// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LabelList } from 'recharts';
import { BarValueLabel } from './bar-label';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('does not emit NaN SVG attributes when parent chart geometry is unavailable', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(
    <svg>
      <LabelList
        content={(geometry) => (
          <BarValueLabel geometry={geometry} measure="on_hand_qty" horizontal />
        )}
        dataKey="value"
        position="right"
        data={[
          {
            x: 10,
            y: 10,
            width: 20,
            height: 30,
            parentViewBox: { x: 0, y: 0, width: NaN, height: 100 },
            payload: { value: 12 },
          },
        ]}
      />
    </svg>,
  );
  expect(container.innerHTML).not.toContain('NaN');
  expect(container.querySelector('text')?.textContent).toBe('12');
  expect(container.querySelector('text')?.getAttribute('x')).toBe('34');
  expect(container.querySelector('text')?.getAttribute('y')).toBe('25');
  expect(spy.mock.calls.some((args) => args.some((arg) => String(arg).includes('NaN')))).toBe(
    false,
  );
});

it('omits invalid bar geometry and renders again when measurement becomes valid', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container, rerender } = render(
    <svg>
      <BarValueLabel
        geometry={{ x: 5, y: 8, width: NaN, height: 10, value: 12 }}
        measure="on_hand_qty"
        horizontal={false}
      />
    </svg>,
  );
  expect(container.querySelector('text')).toBeNull();
  rerender(
    <svg>
      <BarValueLabel
        geometry={{ x: 5, y: 8, width: 20, height: 10, value: 12 }}
        measure="on_hand_qty"
        horizontal={false}
      />
    </svg>,
  );
  expect(container.querySelector('text')?.getAttribute('x')).toBe('15');
  expect(container.querySelector('text')?.getAttribute('y')).toBe('4');
  expect(container.querySelector('text')?.textContent).toBe('12');
  expect(container.querySelector('text')?.hasAttribute('width')).toBe(false);
  expect(spy).not.toHaveBeenCalled();
});
it.each([NaN, Infinity, -Infinity, 0, -1])(
  'omits nonfinite or nonpositive values (%s)',
  (value) => {
    const { container } = render(
      <svg>
        <BarValueLabel
          geometry={{ x: 5, y: 8, width: 20, height: 10, value }}
          measure="stock_value"
          horizontal
        />
      </svg>,
    );
    expect(container.querySelector('text')).toBeNull();
  },
);
