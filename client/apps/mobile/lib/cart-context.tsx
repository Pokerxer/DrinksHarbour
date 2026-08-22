import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth-context.tsx';
import {
  applyValidationTo,
  cartCount,
  cartReducer,
  cartTotal,
  storageKeyFor,
  toCartLine,
  type CartLine,
} from './cart-core.ts';
import { dropCart, loadCart, saveCart } from './cart-storage.ts';
import {
  clearServerCart,
  fetchServerCart,
  mergeServerCart,
  saveServerCart,
  validateServerCart,
  type CartItemValidation,
} from './cart-api.ts';

/**
 * The cart provider — wiring only.
 *
 * The rules are in `cart-core.ts`, the mirror in `cart-storage.ts`, the network
 * in `cart-api.ts`, and all three are unit-tested. Split that way because the
 * web's equivalent is one 742-line file holding all four concerns, and because
 * vitest here runs `environment: 'node'` — a provider cannot be rendered in a
 * test, so nothing worth asserting should live in it.
 *
 * TWO WEB BEHAVIOURS ARE DELIBERATELY ABSENT, because they have no RN
 * equivalent rather than because they were forgotten:
 *   - the cross-tab `storage` event listener — there are no tabs;
 *   - `gtag` / Meta-pixel events on add and remove — there is no analytics
 *     layer in this app, and inventing one is not a cart change.
 *
 * ONE DOES PORT: the web flushes a pending save on `visibilitychange`, so
 * closing a laptop cannot lose the last 800ms of edits. RN's `AppState`
 * 'background' transition is the true equivalent, and on a phone it fires far
 * more often than it ever does on a desktop.
 */

const SAVE_DEBOUNCE_MS = 800;

interface CartContextValue {
  lines: CartLine[];
  cartTotal: number;
  cartCount: number;
  /** Null when no tenant stocks the product — nothing was added. */
  addToCart: (
    product: Record<string, any>,
    options?: { size?: string; vendorId?: string; quantity?: number }
  ) => CartLine | null;
  removeFromCart: (cartItemId: string) => void;
  setQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  /** Clears the local cart AND the stored server cart. Use after an order completes. */
  clearCartEverywhere: () => Promise<void>;
  validation: Record<string, CartItemValidation>;
  validating: boolean;
  validateCart: () => Promise<void>;
  applyValidation: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { lines: [] });
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const userId = isAuthenticated ? (user?._id ?? null) : null;
  const storageKey = storageKeyFor(userId);

  // Blocks the mirror effect until THIS identity's cart has been loaded.
  // Without it the reducer's initial [] is written over the stored cart on the
  // first frame, which is how a cart silently empties itself on cold start.
  const hydratedFor = useRef<string | null>(null);
  const previousUserId = useRef<string | null | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate whenever the identity resolves or changes ─────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (hydratedFor.current === storageKey) return;

    let cancelled = false;

    (async () => {
      const now = Date.now();

      if (!userId) {
        const stored = await loadCart(null, now);
        if (!cancelled) dispatch({ type: 'LOAD', lines: stored });
      } else {
        const guest = await loadCart(null, now);
        const result = guest.length ? await mergeServerCart(guest) : await fetchServerCart();

        if (!cancelled) {
          if (result.ok) {
            dispatch({ type: 'LOAD', lines: result.data });
            await saveCart(userId, result.data, now);
            // The guest cart is folded in — drop it so it cannot merge twice.
            if (guest.length) await dropCart(null);
          } else {
            // Offline. Fall back to this user's mirror; the guest cart is KEPT
            // so nothing is lost and the next successful hydrate merges it.
            dispatch({ type: 'LOAD', lines: await loadCart(userId, now) });
          }
        }
      }

      if (!cancelled) hydratedFor.current = storageKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, storageKey, userId]);

  // ── Wipe in-memory state the instant the identity changes ─────────────────
  // A shared phone must never flash the previous user's lines at the next one.
  useEffect(() => {
    if (authLoading) return;
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous === undefined || previous === userId) return;

    // Signing out: forget the account cart locally. It stays safe on the server.
    if (previous && !userId) void dropCart(previous);
    dispatch({ type: 'CLEAR' });
    hydratedFor.current = null; // force a re-hydrate for the new identity
  }, [userId, authLoading]);

  const pushToServer = useCallback(async () => {
    if (!userId) return;
    await saveServerCart(state.lines);
  }, [userId, state.lines]);

  // ── Mirror immediately, push to the server on a debounce ──────────────────
  // A burst of +/- taps is one request, not one per tap.
  useEffect(() => {
    if (authLoading || hydratedFor.current !== storageKey) return;

    void saveCart(userId, state.lines, Date.now());
    if (!userId) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void pushToServer();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.lines, storageKey, userId, authLoading, pushToServer]);

  // ── Flush a pending save when the app goes to the background ──────────────
  // The RN equivalent of the web's `visibilitychange` flush. On a phone this is
  // the common case, not the edge case: the user switches apps mid-edit.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      if (!userId || hydratedFor.current !== storageKey) return;
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void pushToServer();
    });
    return () => subscription.remove();
  }, [userId, storageKey, pushToServer]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const addToCart = useCallback(
    (
      product: Record<string, any>,
      options: { size?: string; vendorId?: string; quantity?: number } = {}
    ): CartLine | null => {
      const line = toCartLine(product, { ...options, now: Date.now() });
      if (!line) return null; // no tenant stocks it — nothing to add
      dispatch({ type: 'ADD', line });
      return line;
    },
    []
  );

  const removeFromCart = useCallback((cartItemId: string) => {
    dispatch({ type: 'REMOVE', cartItemId });
  }, []);

  const setQuantity = useCallback((cartItemId: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', cartItemId, quantity });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    void dropCart(userId);
  }, [userId]);

  const clearCartEverywhere = useCallback(async () => {
    clearCart();
    if (!userId) return;
    await clearServerCart();
  }, [clearCart, userId]);

  // ── Validation ────────────────────────────────────────────────────────────
  const [validation, setValidation] = useState<Record<string, CartItemValidation>>({});
  const [validating, setValidating] = useState(false);

  const validateCart = useCallback(async () => {
    if (!state.lines.length) return;
    setValidating(true);
    const result = await validateServerCart(state.lines);
    // A failed validation is silent by design — it must never block the cart.
    if (result.ok) setValidation(result.data);
    setValidating(false);
  }, [state.lines]);

  /** Drop what the server says is gone, cap what it says is short, take its prices. */
  const applyValidation = useCallback(() => {
    dispatch({ type: 'LOAD', lines: applyValidationTo(state.lines, validation) });
    setValidation({});
  }, [state.lines, validation]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines: state.lines,
      cartTotal: cartTotal(state.lines),
      cartCount: cartCount(state.lines),
      addToCart,
      removeFromCart,
      setQuantity,
      clearCart,
      clearCartEverywhere,
      validation,
      validating,
      validateCart,
      applyValidation,
    }),
    [
      state.lines,
      addToCart,
      removeFromCart,
      setQuantity,
      clearCart,
      clearCartEverywhere,
      validation,
      validating,
      validateCart,
      applyValidation,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
