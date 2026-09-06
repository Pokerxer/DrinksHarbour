/**
 * The plan/billing errors the API raises, recognised on the client.
 *
 * WHY THIS EXISTS. The server has always raised `SUBSCRIPTION_READ_ONLY`,
 * `PLAN_UPGRADE_REQUIRED` and `ADD_ON_LIMIT_REACHED` with structured
 * `details`, and the admin app understood none of them: a lapsed tenant hit an
 * anonymous 403 on every save button in the app and was told what was
 * happening only if they happened to open /settings/billing. That is the
 * "billing problem becomes a support incident" failure the read-only state was
 * designed to avoid (server/config/README-plan-entitlements.md §4), just moved
 * one layer out.
 *
 * TWO THINGS TO KNOW BEFORE CHANGING THIS FILE.
 *
 * 1. **The copy is not written here.** `message` comes from the server, which
 *    builds it in `readOnlyMessage` (server/services/entitlements.service.js) —
 *    the same function the write gates use. Adding a nicer sentence here would
 *    recreate the exact drift that function was written to end. The fallbacks
 *    below exist only for a response that carries a code and no message, which
 *    the current API never produces.
 *
 * 2. **Do not branch on `subscriptionStatus`.** An elapsed trial is still
 *    `trialing` and is read-only; `past_due` is read-only; a suspended tenant
 *    is read-only for a different reason again. `writesAllowed` — or, here, the
 *    error code — is the only correct signal.
 */

export const ENTITLEMENT_ERROR_CODES = [
  'SUBSCRIPTION_READ_ONLY',
  'PLAN_UPGRADE_REQUIRED',
  'ADD_ON_LIMIT_REACHED',
  'SKU_LIMIT_REACHED',
  'STAFF_LIMIT_REACHED',
] as const;

export type EntitlementErrorCode = (typeof ENTITLEMENT_ERROR_CODES)[number];

/** The error envelope server.js's handler produces. All fields optional. */
export interface ApiErrorBody {
  success?: boolean;
  message?: string;
  code?: string;
  details?: {
    /** `resolveEntitlements(...).reason` — e.g. 'trial_expired'. */
    reason?: string;
    currentPlan?: string;
    /** Cheapest plan that unlocks the refused capability. */
    upgradeTo?: string | null;
    requiredCapabilities?: string[];
    /** ADD_ON_LIMIT_REACHED only. */
    addOn?: string;
    used?: number;
    allowance?: number;
  };
}

export interface EntitlementNotice {
  code: EntitlementErrorCode;
  /** Server-authored explanation. Never empty. */
  message: string;
  reason?: string;
  currentPlan?: string;
  upgradeTo?: string | null;
  /**
   * Stable per (code, reason). Passed to react-hot-toast as its `id` so a
   * screen that fires five requests in parallel and gets five 403s shows ONE
   * toast rather than five stacked copies of the same sentence.
   */
  toastId: string;
}

/**
 * Last-resort text for a code that arrives with no message. Kept deliberately
 * plain — if one of these is ever seen in the wild, the server stopped sending
 * `message` and that is the bug to fix, not the wording here.
 */
const FALLBACK_MESSAGE: Record<EntitlementErrorCode, string> = {
  SUBSCRIPTION_READ_ONLY:
    'Your account is read-only until billing is resolved.',
  PLAN_UPGRADE_REQUIRED: 'Your plan does not include this feature.',
  ADD_ON_LIMIT_REACHED: 'You have used all of your slots for this add-on.',
  SKU_LIMIT_REACHED: 'You have reached the product limit for your plan.',
  STAFF_LIMIT_REACHED: 'You have reached the staff limit for your plan.',
};

function isEntitlementCode(value: unknown): value is EntitlementErrorCode {
  return (
    typeof value === 'string' &&
    (ENTITLEMENT_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Recognise a plan/billing refusal, or return null for everything else.
 *
 * All three codes are 403s, and the status is checked as well as the code so a
 * body echoed back by some other endpoint cannot spoof a billing toast.
 */
export function parseEntitlementError(
  status: number,
  body: unknown
): EntitlementNotice | null {
  if (status !== 403) return null;
  if (!body || typeof body !== 'object') return null;

  const parsed = body as ApiErrorBody;
  if (!isEntitlementCode(parsed.code)) return null;

  const details = parsed.details ?? {};
  const reason =
    typeof details.reason === 'string' ? details.reason : undefined;

  return {
    code: parsed.code,
    message: parsed.message?.trim() || FALLBACK_MESSAGE[parsed.code],
    reason,
    currentPlan:
      typeof details.currentPlan === 'string' ? details.currentPlan : undefined,
    upgradeTo: details.upgradeTo ?? null,
    toastId: `entitlement:${parsed.code}:${reason ?? details.addOn ?? 'default'}`,
    // A limit refusal has no `upgradeTo` from the server — the plan is not
    // missing a capability, it is full — so the CTA falls through to the
    // generic "View plans", which is the correct destination for both.
  };
}

/**
 * The label for the notice's call to action.
 *
 * Every one of these routes to /settings/billing, because that is the only
 * screen from which any of the three can be resolved — pay the failed invoice,
 * upgrade the plan, or buy the add-on. `planLabel` is resolved by the caller
 * from PLAN_LABELS so this module stays free of the capability table.
 */
export function entitlementActionLabel(
  notice: EntitlementNotice,
  planLabel?: string | null
): string {
  if (notice.code === 'SUBSCRIPTION_READ_ONLY') return 'Go to billing';
  if (notice.upgradeTo && planLabel) return `Upgrade to ${planLabel}`;
  return 'View plans';
}

/** Marks a patched fetch so a remount cannot wrap an already-wrapped fetch. */
export const FETCH_PATCH_FLAG = '__dhEntitlementFetchPatched';

export type PatchableFetch = typeof fetch & {
  [FETCH_PATCH_FLAG]?: true;
};

/**
 * Wrap `original` so plan/billing 403s raise a notice on their way past.
 *
 * WHY THE SEAM IS `fetch` ITSELF. There is no shared HTTP client in this app to
 * hook. `src/lib/api-client.ts` looks like one but is imported by nothing, and
 * is server-only anyway (it calls getServerSession), so it cannot raise a
 * toast. Each of the ~50 files in src/services/ declares its own `fetch` plus
 * its own local `handle(res, fallback)` that throws `new Error(body.message)`,
 * dropping `code` and `details` on the floor. Doing this per service would mean
 * touching every service and every call site, and would still be one new
 * `fetch` away from a gap.
 *
 * IT CHANGES NOTHING ABOUT THE RESPONSE. The original Response is returned
 * untouched and UNREAD — the body is inspected through `res.clone()` — so every
 * existing `handle()` still parses the same stream and still throws the same
 * Error. This only adds the explanation the caller was never going to give.
 */
export function wrapFetchWithEntitlementNotices(
  original: typeof fetch,
  onNotice: (notice: EntitlementNotice) => void
): PatchableFetch {
  const patched: PatchableFetch = async (input, init) => {
    const response = await original(input, init);

    // All three codes are 403s. Anything else is not read, not cloned, and
    // costs one integer comparison.
    if (response.status === 403) {
      try {
        const body = await response.clone().json();
        const notice = parseEntitlementError(response.status, body);
        if (notice) onNotice(notice);
      } catch {
        // A non-JSON or unclonable 403 is simply not one of ours. This wrapper
        // must never turn a failed response into a failed request.
      }
    }

    return response;
  };

  patched[FETCH_PATCH_FLAG] = true;
  return patched;
}
