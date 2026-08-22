import { describe, expect, test } from 'vitest';

const {
  DRAWER_SPRING,
  drawerWidth,
  clampDrawerTranslate,
  isHorizontalDrag,
  shouldCloseDrawer,
  restingTranslate,
} = await import('./drawer-gesture.ts');

describe('DRAWER_SPRING', () => {
  // The web animates the drawer with framer-motion
  // `{ type: "spring", damping: 28, stiffness: 320 }` (MobileBottomNav.tsx:182).
  // RN's Animated.spring takes the same damped-harmonic-oscillator parameters,
  // and framer-motion's default mass is 1, so these are the web's own numbers
  // rather than something eyeballed to look similar.
  test('carries the web drawer spring, unchanged', () => {
    expect(DRAWER_SPRING).toEqual({ stiffness: 320, damping: 28, mass: 1 });
  });
});

describe('drawerWidth', () => {
  // `w-[88%] max-w-[420px]`.
  test('is 88% of a phone screen', () => {
    expect(drawerWidth(390)).toBe(343);
  });

  test('is capped at 420 on a wide screen', () => {
    expect(drawerWidth(1024)).toBe(420);
  });

  // 420 / 0.88 = 477.3, so the cap starts biting just under 478.
  test('caps exactly where 88% reaches 420', () => {
    expect(drawerWidth(477)).toBe(420);
    expect(drawerWidth(476)).toBe(419);
  });

  test('is a whole number of pixels', () => {
    expect(Number.isInteger(drawerWidth(393))).toBe(true);
  });
});

describe('clampDrawerTranslate', () => {
  // The panel is anchored to the left edge: 0 is fully open, -width fully closed.
  test('a leftward drag moves the panel left by that much', () => {
    expect(clampDrawerTranslate(-80, 343)).toBe(-80);
  });

  // Dragging right would tear the panel off the left edge and show a white gap.
  test('a rightward drag cannot pull the panel past open', () => {
    expect(clampDrawerTranslate(120, 343)).toBe(0);
  });

  test('a drag beyond the panel width stops at fully closed', () => {
    expect(clampDrawerTranslate(-900, 343)).toBe(-343);
  });
});

describe('isHorizontalDrag', () => {
  // The left root list and the right subcategory pane both scroll vertically.
  // Stealing those scrolls for the drawer is the failure mode this guards.
  test('a vertical list scroll is not a drawer drag', () => {
    expect(isHorizontalDrag(4, 60)).toBe(false);
  });

  test('a clear leftward swipe is a drawer drag', () => {
    expect(isHorizontalDrag(-40, 6)).toBe(true);
  });

  // A tap wobbles a few pixels. Claiming the responder on that would swallow
  // every press inside the drawer.
  test('a tap-sized wobble is not a drag in any direction', () => {
    expect(isHorizontalDrag(-5, 2)).toBe(false);
    expect(isHorizontalDrag(0, 0)).toBe(false);
  });

  // A diagonal belongs to whichever axis dominates, and vertical wins ties —
  // scrolling a list is the more common intent inside this drawer.
  test('a diagonal that is only just horizontal is left to the list', () => {
    expect(isHorizontalDrag(-30, 30)).toBe(false);
  });
});

describe('shouldCloseDrawer', () => {
  const width = 343;

  test('a slow drag past a third of the panel closes it', () => {
    expect(shouldCloseDrawer({ dx: -130, vx: -0.05, width })).toBe(true);
  });

  test('a slow drag that never reaches a third springs back open', () => {
    expect(shouldCloseDrawer({ dx: -60, vx: -0.05, width })).toBe(false);
  });

  // The other half of the standard pair: a quick flick closes it wherever the
  // finger lifted, because waiting for a third of the width would make a flick
  // feel ignored.
  test('a fast leftward flick closes it from barely moved', () => {
    expect(shouldCloseDrawer({ dx: -20, vx: -1.2, width })).toBe(true);
  });

  // Velocity beats displacement: dragging most of the way closed and then
  // throwing it back is a change of mind, not a dismissal.
  test('a fast rightward flick keeps it open even from past the threshold', () => {
    expect(shouldCloseDrawer({ dx: -200, vx: 1.4, width })).toBe(false);
  });

  test('a rightward drag never closes it', () => {
    expect(shouldCloseDrawer({ dx: 90, vx: 0.1, width })).toBe(false);
  });

  // The threshold scales with the panel, so a 420px drawer on a tablet needs a
  // proportionally longer drag rather than the same 114px as a phone.
  test('the distance threshold is a third of the panel, not a fixed distance', () => {
    expect(shouldCloseDrawer({ dx: -130, vx: 0, width: 420 })).toBe(false);
    expect(shouldCloseDrawer({ dx: -141, vx: 0, width: 420 })).toBe(true);
  });
});

describe('restingTranslate', () => {
  test('closing settles fully off the left edge', () => {
    expect(restingTranslate(true, 343)).toBe(-343);
  });

  test('staying open settles flush against the left edge', () => {
    expect(restingTranslate(false, 343)).toBe(0);
  });
});
