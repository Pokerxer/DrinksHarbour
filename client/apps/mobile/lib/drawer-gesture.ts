/**
 * The categories drawer's geometry and dismissal rules.
 *
 * The web's drawer (`apps/platform/src/components/Navigation/
 * MobileBottomNav.tsx:167-433`) is a **left-edge** panel at `w-[88%]
 * max-w-[420px]` over a `bg-black/50` backdrop, animated `x: -100% → 0`. The
 * mobile drawer was a full-screen `Modal animationType="slide"`, which on iOS is
 * a bottom-up sheet — the wrong edge and the wrong shape.
 *
 * The drag is driven by RN core's `PanResponder`, not `react-native-gesture-
 * handler`. RNGH is a native module and nothing on this branch has been seen on
 * a device yet; introducing one in the same change as the first device check
 * would make any failure ambiguous. The cost is real and worth writing down:
 * PanResponder runs on the JS thread, so a drag can drop frames while a heavy
 * re-render is in flight. Pinch-to-zoom on product images is the gesture that
 * will genuinely need the UI thread, and that is the change that should add RNGH.
 */

/**
 * The web's framer-motion transition, transferred rather than approximated.
 *
 * `{ type: "spring", damping: 28, stiffness: 320 }` at MobileBottomNav.tsx:182.
 * `Animated.spring` accepts the same damped-harmonic-oscillator parameters, and
 * framer-motion's default mass is 1 — so this is the same physics, not a lookalike.
 */
export const DRAWER_SPRING = { stiffness: 320, damping: 28, mass: 1 };

/** `w-[88%] max-w-[420px]`. Whole pixels, so the left edge has no subpixel seam. */
export function drawerWidth(windowWidth: number): number {
  return Math.round(Math.min(420, windowWidth * 0.88));
}

/**
 * Where the panel sits for a drag of `dx`, in the panel's own coordinates:
 * 0 is flush with the left edge, `-width` is fully off screen.
 *
 * Dragging right is clamped rather than rubber-banded — the panel is anchored to
 * the left edge, so any positive translate opens a white gap beside it.
 */
export function clampDrawerTranslate(dx: number, width: number): number {
  return Math.max(-width, Math.min(0, dx));
}

/** Below this, the movement is a tap wobble rather than a drag. */
const DRAG_SLOP = 8;

/**
 * Whether a movement belongs to the drawer or to the list underneath it.
 *
 * Both panes of the drawer scroll vertically, so the responder is only claimed
 * for a movement that is clearly horizontal. Ties go to the list: scrolling is
 * the more common intent inside this drawer, and a stolen scroll is far more
 * annoying than a swipe that needs to be a little more deliberate.
 */
export function isHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > DRAG_SLOP && Math.abs(dx) > Math.abs(dy);
}

/** px/ms. Above this the gesture is a flick and displacement stops mattering. */
const FLING_VELOCITY = 0.5;

/** Drag this far along the panel and releasing dismisses it. */
const DISMISS_FRACTION = 1 / 3;

/**
 * Whether releasing here should close the drawer.
 *
 * The standard pair: dismiss on a slow drag past a third of the panel, **or** on
 * a quick flick from anywhere. Velocity is checked first in both directions, so
 * throwing the panel back open after dragging most of the way closed is read as
 * a change of mind rather than a dismissal.
 */
export function shouldCloseDrawer({
  dx,
  vx,
  width,
}: {
  dx: number;
  vx: number;
  width: number;
}): boolean {
  if (vx >= FLING_VELOCITY) return false;
  if (vx <= -FLING_VELOCITY) return true;
  return dx <= -width * DISMISS_FRACTION;
}

/** Where the spring is aimed once the finger lifts. */
export function restingTranslate(closing: boolean, width: number): number {
  return closing ? -width : 0;
}
