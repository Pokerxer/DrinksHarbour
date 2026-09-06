'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import {
  entitlementActionLabel,
  wrapFetchWithEntitlementNotices,
  FETCH_PATCH_FLAG,
  type EntitlementNotice,
  type PatchableFetch,
} from '@/lib/entitlement-error';
import { PLAN_LABELS, type TenantPlan } from '@/config/plan-capabilities';
import { routes } from '@/config/routes';

/**
 * Tell a read-only or under-plan tenant what happened, from any screen.
 *
 * Before this, the only place a lapsed tenant learned anything was the banner
 * on /settings/billing; every save button elsewhere in the admin threw an
 * unexplained 403. That is the "billing problem becomes a support incident"
 * failure the read-only state was designed to avoid
 * (server/config/README-plan-entitlements.md §4), moved one layer out.
 *
 * The recognition and the fetch wrapping live in @/lib/entitlement-error — pure
 * TypeScript, so vitest (which runs `environment: 'node'` here and cannot
 * render components) can test them. This file is only the rendering.
 *
 * THE WORDING IS THE SERVER'S. `notice.message` is whatever the API sent, built
 * by `readOnlyMessage` in server/services/entitlements.service.js — the same
 * function that fills the 403 and the same string the billing page shows.
 * Writing a nicer sentence here would recreate exactly the drift that function
 * was introduced to end.
 */

/** Render one notice. */
export function showEntitlementToast(notice: EntitlementNotice): void {
  const planLabel = notice.upgradeTo
    ? (PLAN_LABELS[notice.upgradeTo as TenantPlan] ?? null)
    : null;

  toast.error(
    (t) => (
      <span className="flex flex-col items-start gap-1">
        <span>{notice.message}</span>
        <Link
          href={routes.billing}
          className="font-semibold underline underline-offset-2"
          onClick={() => toast.dismiss(t.id)}
        >
          {entitlementActionLabel(notice, planLabel)}
        </Link>
      </span>
    ),
    {
      // Collapses the five identical 403s a page of parallel requests produces
      // into one toast.
      id: notice.toastId,
      duration: 8000,
    }
  );
}

export default function EntitlementErrorToast() {
  useEffect(() => {
    const original = window.fetch as PatchableFetch;
    if (original[FETCH_PATCH_FLAG]) return;

    window.fetch = wrapFetchWithEntitlementNotices(
      original,
      showEntitlementToast
    );

    return () => {
      // Only restore if nothing else patched on top of ours in the meantime;
      // clobbering a later wrapper would silently remove its behaviour.
      if ((window.fetch as PatchableFetch)[FETCH_PATCH_FLAG]) {
        window.fetch = original;
      }
    };
  }, []);

  return null;
}
