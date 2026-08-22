/**
 * The cart's device mirror.
 *
 * The web keeps this in `localStorage`; mobile uses AsyncStorage under the same
 * per-identity key (`drinksharbour_cart:{userId|guest}`). The mirror is the
 * cheap, immediate copy that survives a cold start — for a signed-in shopper
 * the server cart is the durable one, which is why every failure here is
 * swallowed rather than surfaced.
 *
 * `now` is passed in rather than read, so expiry is testable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCartExpired, storageKeyFor, type CartLine } from './cart-core.ts';

interface StoredCart {
  lines: CartLine[];
  savedAt: number;
}

/** A line without both ids can be neither saved nor validated — drop it. */
function usable(raw: unknown): raw is CartLine {
  const l = raw as Record<string, unknown> | null;
  return (
    !!l &&
    typeof l === 'object' &&
    typeof l.cartItemId === 'string' &&
    !!l.cartItemId &&
    typeof l.subProductId === 'string' &&
    !!l.subProductId &&
    typeof l.sizeId === 'string' &&
    !!l.sizeId
  );
}

export async function loadCart(userId: string | null, now: number): Promise<CartLine[]> {
  const key = storageKeyFor(userId);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<StoredCart> | null;
    if (!Array.isArray(parsed?.lines)) return [];

    // A missing savedAt reads as 0, i.e. expired — a cart we cannot date is
    // one we cannot trust the price of.
    if (isCartExpired(typeof parsed.savedAt === 'number' ? parsed.savedAt : 0, now)) {
      await AsyncStorage.removeItem(key);
      return [];
    }

    return parsed.lines.filter(usable);
  } catch {
    return [];
  }
}

export async function saveCart(
  userId: string | null,
  lines: CartLine[],
  now: number
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      storageKeyFor(userId),
      JSON.stringify({ lines, savedAt: now } satisfies StoredCart)
    );
  } catch {
    /* device store full — the server copy is the durable one */
  }
}

export async function dropCart(userId: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKeyFor(userId));
  } catch {
    /* nothing useful to do */
  }
}
