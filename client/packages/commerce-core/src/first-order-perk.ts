/**
 * Free delivery on a customer's first purchase — client-side presentation.
 *
 * The rule itself is server-side (`services/firstOrderPerk.helpers.js`) and so
 * are the amounts: ₦50,000 minimum and ₦5,000 cap arrive on every API response
 * rather than being duplicated here, so marketing can change the terms in one
 * place. This module only decides what to say about the server's verdict.
 */

/** Why the perk did or did not apply. Mirrors the server's `reason` values. */
export type PerkReason =
  | 'ok'
  | 'not_signed_in'
  | 'disabled'
  | 'already_purchased'
  | 'below_minimum'
  | 'outside_zone'
  | 'no_fee';

export interface FirstOrderPerk {
  eligible: boolean;
  /** NGN taken off the delivery fee. */
  waivedAmount: number;
  /** NGN of delivery the customer still pays. */
  payableFee: number;
  reason: PerkReason;
  minSubtotal: number;
  maxWaiver: number;
}

/** Shape of `GET /api/shipping/first-order-perk`. */
export interface FirstOrderPerkProbe extends FirstOrderPerk {
  signedIn: boolean;
  states: string[];
}

export interface PerkPromo {
  /** False when the offer is irrelevant to this shopper and should stay hidden. */
  show: boolean;
  tone: 'success' | 'info';
  headline: string;
  detail: string;
  cta: { label: string; href: string } | null;
}

const HIDDEN: PerkPromo = { show: false, tone: 'info', headline: '', detail: '', cta: null };

export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

/**
 * Marketing copy for the header bar, the cart banner and the signed-out nudge.
 *
 * Only three of the seven reasons are worth surfacing. `already_purchased` and
 * `disabled` mean there is no offer to make; `outside_zone` and `no_fee` would
 * advertise something the shopper cannot have. Announcing a perk and then
 * withdrawing it at checkout is worse than never mentioning it.
 *
 * @param perk     the server's verdict
 * @param subtotal current cart subtotal, when the caller knows it
 * @param returnTo path to come back to after signing in
 */
export function describeFirstOrderPerk(
  perk: FirstOrderPerk | null | undefined,
  { subtotal, returnTo = '/checkout' }: { subtotal?: number; returnTo?: string } = {},
): PerkPromo {
  if (!perk) return HIDDEN;

  // The shared probe answers "could this customer qualify", without a cart or an
  // address, so it says `ok` to a first-time buyer holding a ₦5,000 basket. Where
  // the caller knows the subtotal, apply the threshold here rather than promise
  // something checkout will then take away. The server stays authoritative — this
  // only ever withdraws a claim, never grants one.
  const reason =
    perk.reason === 'ok' && typeof subtotal === 'number' && subtotal < perk.minSubtotal
      ? 'below_minimum'
      : perk.reason;

  switch (reason) {
    case 'ok':
      return {
        show: true,
        tone: 'success',
        headline: 'Your first delivery is on us',
        detail:
          perk.payableFee > 0
            ? `${formatNaira(perk.waivedAmount)} off delivery — ${formatNaira(perk.payableFee)} to pay.`
            : perk.waivedAmount > 0
              ? 'Delivery is free on this order.'
              // No fee quoted yet: the site-wide bar, where no order exists to
              // speak of.
              : `Free delivery on first orders over ${formatNaira(perk.minSubtotal)}.`,
        cta: null,
      };

    case 'not_signed_in':
      return {
        show: true,
        tone: 'info',
        headline: 'Free delivery on your first order',
        detail: `Sign in or create an account to claim it on orders over ${formatNaira(perk.minSubtotal)}.`,
        cta: { label: 'Sign in', href: `/login?redirect=${encodeURIComponent(returnTo)}` },
      };

    case 'below_minimum': {
      // Without a subtotal we can still state the threshold, just not the gap.
      const shortfall =
        typeof subtotal === 'number' ? Math.max(0, perk.minSubtotal - subtotal) : null;
      return {
        show: true,
        tone: 'info',
        headline: 'Free delivery on your first order',
        detail:
          shortfall && shortfall > 0
            ? `Add ${formatNaira(shortfall)} more to qualify.`
            : `On first orders over ${formatNaira(perk.minSubtotal)}.`,
        cta: null,
      };
    }

    default:
      return HIDDEN;
  }
}

/**
 * Delivery line for the checkout summary.
 *
 * Returns null when there is nothing perk-related to say, so the caller keeps
 * its existing rendering.
 */
export function describeDeliveryLine(perk: FirstOrderPerk | null | undefined): string | null {
  if (!perk?.eligible) return null;
  return perk.payableFee > 0
    ? `${formatNaira(perk.waivedAmount)} first-order discount applied`
    : 'Free — first order';
}
