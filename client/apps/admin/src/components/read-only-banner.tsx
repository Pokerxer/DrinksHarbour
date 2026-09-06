'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { PiWarningCircleDuotone } from 'react-icons/pi';

import { routes } from '@/config/routes';

/**
 * A standing notice that this tenant cannot save anything, shown before they
 * fill a form rather than after they try to submit it.
 *
 * The toast in entitlement-error-toast.tsx catches the refusal itself; this
 * exists so a read-only tenant is not surprised by it. Losing a half-filled
 * purchase order to a 403 they had no warning of is the same support incident
 * the read-only state was meant to prevent
 * (server/config/README-plan-entitlements.md §4).
 *
 * `message` is the server's `entitlementMessage`, from the same
 * `readOnlyMessage` that fills the 403 body and the billing page's own banner.
 * The component deliberately takes the sentence as a prop and does not derive
 * one: deriving it from `subscriptionStatus` here would be both a second copy
 * of the copy and a second copy of the policy — and it would get the policy
 * wrong, because an elapsed trial is still `trialing`.
 *
 * Renders nothing when writes are allowed (message is null) and on the billing
 * page, which shows its own banner in context with the plan picker.
 */
export default function ReadOnlyBanner({ message }: { message: string | null }) {
  const pathname = usePathname();

  if (!message) return null;
  if (pathname?.startsWith(routes.billing)) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
    >
      <PiWarningCircleDuotone className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {message}{' '}
        <Link
          href={routes.billing}
          className="font-semibold underline underline-offset-2"
        >
          Go to billing
        </Link>
      </span>
    </div>
  );
}
