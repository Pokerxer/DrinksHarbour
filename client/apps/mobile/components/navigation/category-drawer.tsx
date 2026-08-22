import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clampDrawerTranslate,
  DRAWER_SPRING,
  drawerWidth,
  isHorizontalDrag,
  restingTranslate,
  shouldCloseDrawer,
} from '../../lib/drawer-gesture.ts';
import { CategoryDrawerContent } from './category-drawer-content.tsx';

/**
 * The categories drawer's shell — the web's geometry and its gesture.
 *
 * `apps/platform/src/components/Navigation/MobileBottomNav.tsx:167-184` is a
 * **left-edge** panel at `w-[88%] max-w-[420px]` over a `bg-black/50` backdrop,
 * animated `x: -100% → 0`. This was a full-screen `Modal animationType="slide"`,
 * which on iOS is a bottom-up sheet: the wrong edge, the wrong width, and no way
 * to swipe it away. It is still a `Modal` — that is the only thing that reliably
 * covers the native tab bar — but a transparent one with `animationType="none"`,
 * because the animation is ours now.
 *
 * **The spring is the web's own numbers.** framer-motion's
 * `{ type: "spring", damping: 28, stiffness: 320 }` and `Animated.spring`'s
 * physics config are the same damped-harmonic-oscillator model, and
 * framer-motion's default mass is 1 — so `DRAWER_SPRING` transfers it rather
 * than approximating it.
 *
 * **The drag is `PanResponder`, not react-native-gesture-handler.** RNGH is a
 * native module and would need `GestureHandlerRootView` above the router plus a
 * rebuild for anyone not on Expo Go; nothing on this branch has been seen on a
 * device yet, and a native dependency landing in the same change as the first
 * device check makes any failure ambiguous. The cost is honest: PanResponder
 * runs on the JS thread, so a drag can drop frames under a heavy re-render.
 * Pinch-to-zoom on product images is the gesture that will actually need the UI
 * thread, and that is the change that should add RNGH.
 *
 * **NativeWind is not used on `Animated.View` or `Modal`** — neither is in
 * `react-native-css-interop`'s registration list, so a `className` on them is
 * dropped silently. Both carry plain `style` objects instead.
 */
export function CategoryDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = drawerWidth(windowWidth);

  /**
   * The Modal has to outlive `visible` so the panel can animate *out*. `rendered`
   * is set true when the drawer opens and false only once the closing spring
   * finishes — the equivalent of the web's `<AnimatePresence>`.
   */
  const [rendered, setRendered] = useState(false);

  /** 0 = flush with the left edge, -panelWidth = fully off screen. */
  const translateX = useRef(new Animated.Value(-panelWidth)).current;

  /**
   * Held in a ref so the PanResponder below never lists it as a dependency.
   * Callers pass an inline arrow, so `onClose` is a new function every render —
   * rebuilding the responder mid-drag would drop the gesture on the floor.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    const closing = !visible;

    const animation = Animated.spring(translateX, {
      toValue: restingTranslate(closing, panelWidth),
      useNativeDriver: true,
      ...DRAWER_SPRING,
    });

    animation.start(({ finished }) => {
      if (finished && closing) setRendered(false);
    });

    return () => animation.stop();
  }, [rendered, visible, panelWidth, translateX]);

  /**
   * The backdrop is derived from the panel rather than animated separately, so
   * it fades with the finger during a drag and cannot fall out of step with the
   * spring on release.
   */
  const backdropOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-panelWidth, 0],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [translateX, panelWidth]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claimed on move, never on start: a press has to reach the buttons and
        // lists inside the drawer.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          isHorizontalDrag(gesture.dx, gesture.dy),
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_event, gesture) => {
          translateX.setValue(clampDrawerTranslate(gesture.dx, panelWidth));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (shouldCloseDrawer({ dx: gesture.dx, vx: gesture.vx, width: panelWidth })) {
            // Hand the decision to the parent; `visible` going false is what
            // drives the closing spring, so there is one exit path, not two.
            onCloseRef.current();
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            ...DRAWER_SPRING,
          }).start();
        },
        // A system gesture (a call, the app backgrounding) stealing the
        // responder mid-drag must not leave the panel parked halfway.
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            ...DRAWER_SPRING,
          }).start();
        },
      }),
    [panelWidth, translateX]
  );

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        {/* `bg-black/50`, tap to dismiss — MobileBottomNav.tsx:170-176. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropOpacity },
          ]}
        >
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close categories"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* `fixed inset-y-0 left-0 w-[88%] max-w-[420px] bg-white`. */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: panelWidth,
            backgroundColor: '#ffffff',
            transform: [{ translateX }],
          }}
        >
          <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
            <CategoryDrawerContent visible={visible} onClose={onClose} />
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
