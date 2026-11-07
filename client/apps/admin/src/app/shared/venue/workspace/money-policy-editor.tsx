'use client';
// workspace/money-policy-editor.tsx — S5 Task 4: AUTHORING draft for the
// additive `serviceCharge` + `gratuityAllocation` subdocs of the reviewed
// financial policy (models/VenueFinancialPolicy.js). Honest scope: venue
// staff cannot approve financial policies — approval is a platform
// super-admin review flow (policy-approval.js enforces
// POLICY_REVIEW_AUTHORITY_REQUIRED; scripts/approve-venue-financial-policy.js
// is the apply surface), and no staff policy endpoint exists. This panel
// therefore composes the exact additive subdoc payload for that review flow
// and never saves anywhere: an approved policy version is immutable
// (POLICY_VERSION_IMMUTABLE), so any change is a NEW version to review.
// Defaults are the zero-behavior-change posture: service charge disabled,
// gratuity mode 'none'.
import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { ServiceChargePolicy, GratuityAllocationPolicy } from '@/services/venue/gratuity';
import { buttonClass, fieldClass, hintClass, panelClass, Notice } from './controls';

type Draft = {
  enabled: boolean;
  ratePercent: string;
  appliesTo: 'merchandise_net' | 'food_only';
  taxable: boolean;
  taxDecision: string;
  displayLabel: string;
  revenueAccount: string;
  gratuityMode: 'none' | 'staff' | 'shift';
  defaultStaffIds: string;
  shiftPolicyRef: string;
};

/** Authoring draft shape — exported for tests; mirrors the model's additive subdocs. */
export type DraftState = Draft;

const initial: Draft = {
  enabled: false, ratePercent: '', appliesTo: 'merchandise_net', taxable: true,
  taxDecision: '', displayLabel: '', revenueAccount: '',
  gratuityMode: 'none', defaultStaffIds: '', shiftPolicyRef: '',
};

/** Authored % → integer basis points (12.5% = 1250 bps; server bounds 1–5000). */
export function serviceChargeDraft(draft: Draft): ServiceChargePolicy | undefined {
  if (!draft.enabled) return undefined;
  const rateBps = Math.round(Number(draft.ratePercent) * 100);
  return {
    enabled: true,
    ...(Number.isSafeInteger(rateBps) && rateBps > 0 ? { rateBps } : {}),
    appliesTo: draft.appliesTo,
    taxable: draft.taxable,
    ...(draft.taxable ? {} : { taxDecision: draft.taxDecision.trim() }),
    displayLabel: draft.displayLabel.trim(),
    accounts: { revenue: draft.revenueAccount.trim() },
  };
}

export function gratuityDraft(draft: Draft): GratuityAllocationPolicy | undefined {
  if (draft.gratuityMode === 'none') return undefined;
  const ids = draft.defaultStaffIds.split(',').map(v => v.trim()).filter(Boolean);
  return {
    mode: draft.gratuityMode,
    ...(draft.gratuityMode === 'staff' && ids.length ? { defaultStaffIds: ids } : {}),
    ...(draft.gratuityMode === 'shift' && draft.shiftPolicyRef.trim() ? { shiftPolicyRef: draft.shiftPolicyRef.trim() } : {}),
  };
}

export default function MoneyPolicyEditor() {
  const [draft, setDraft] = useState<Draft>(initial);
  const [copied, setCopied] = useState('');
  const payload = JSON.stringify({ serviceCharge: serviceChargeDraft(draft) ?? null, gratuityAllocation: gratuityDraft(draft) ?? null }, null, 2);
  async function copy() {
    try { await navigator.clipboard.writeText(payload); setCopied('Copied the additive policy payload.'); }
    catch { setCopied('Clipboard unavailable — select and copy the payload below.'); }
  }
  return (
    <section aria-label="Financial policy authoring" className="space-y-5">
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold">Service charge and gratuity policy draft</h2>
        <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Compose the additive service-charge and gratuity-allocation subdocs for
          your next financial policy review. Approval happens in the platform
          review flow — an approved version is immutable, so a change is always a
          new version.
        </p>
      </div>
      <Notice tone="info">
        Nothing is saved or approved here. Hand the payload below to the platform
        reviewer; until an approved policy enables the charge, bills are unchanged.
      </Notice>
      <fieldset className={`${panelClass} space-y-3`}>
        <legend className="px-1 text-base font-semibold">Service charge</legend>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 rounded border-gray-400" checked={draft.enabled}
            onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />
          Enable a service charge on eligible consumption
        </label>
        {draft.enabled && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Service charge rate (%)
              <input type="number" min="0" max="50" step="0.25" className={fieldClass}
                value={draft.ratePercent}
                onChange={e => setDraft({ ...draft, ratePercent: e.target.value })} />
              <span className={hintClass}>Whole basis points of the eligible net — 12.5% = 1250 bps (allowed range 1–5000 bps).</span>
            </label>
            <label className="block text-sm font-medium">
              Applies to
              <select className={fieldClass} value={draft.appliesTo}
                onChange={e => setDraft({ ...draft, appliesTo: e.target.value as Draft['appliesTo'] })}>
                <option value="merchandise_net">Merchandise net (all eligible lines)</option>
                <option value="food_only">Food only (fail-closed until food lines exist)</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Receipt label (≤80 characters)
              <input type="text" maxLength={80} className={fieldClass} value={draft.displayLabel}
                onChange={e => setDraft({ ...draft, displayLabel: e.target.value })}
                placeholder="Service charge 12.5%" />
            </label>
            <label className="block text-sm font-medium">
              Revenue account code
              <input type="text" maxLength={40} className={fieldClass} value={draft.revenueAccount}
                onChange={e => setDraft({ ...draft, revenueAccount: e.target.value })}
                placeholder="4060" />
              <span className={hintClass}>A distinct service-charge chart account (never the merchandise commission account).</span>
            </label>
          </div>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 rounded border-gray-400" checked={draft.taxable}
              onChange={e => setDraft({ ...draft, taxable: e.target.checked })} />
            Tax applies to the service charge
          </label>
          {!draft.taxable && (
            <label className="block max-w-xl text-sm font-medium">
              Named zero-tax decision
              <input type="text" maxLength={200} className={fieldClass} value={draft.taxDecision}
                onChange={e => setDraft({ ...draft, taxDecision: e.target.value })} />
              <span className={hintClass}>Required when the charge is zero-tax — name the approving decision, like the shortfall tax decision.</span>
            </label>
          )}
          <p className={hintClass}>
            A service charge never counts toward the minimum-spend check unless the
            approved policy explicitly says so (default off).
          </p>
        </>}
      </fieldset>
      <fieldset className={`${panelClass} space-y-3`}>
        <legend className="px-1 text-base font-semibold">Gratuity allocation hints</legend>
        <p className={hintClass}>
          Recorded defaults only — allocation rows are created later by explicit
          staff commands and never move money themselves.
        </p>
        <label className="block max-w-sm text-sm font-medium">
          Allocation mode
          <select className={fieldClass} value={draft.gratuityMode}
            onChange={e => setDraft({ ...draft, gratuityMode: e.target.value as Draft['gratuityMode'] })}>
            <option value="none">None (tips are not allocated)</option>
            <option value="staff">Staff (default staff hints)</option>
            <option value="shift">Shift (default shift hints)</option>
          </select>
        </label>
        {draft.gratuityMode === 'staff' && (
          <label className="block max-w-xl text-sm font-medium">
            Default staff references (comma-separated)
            <input type="text" className={fieldClass} value={draft.defaultStaffIds}
              onChange={e => setDraft({ ...draft, defaultStaffIds: e.target.value })} />
          </label>
        )}
        {draft.gratuityMode === 'shift' && (
          <label className="block max-w-xl text-sm font-medium">
            Shift policy reference
            <input type="text" className={fieldClass} value={draft.shiftPolicyRef}
              onChange={e => setDraft({ ...draft, shiftPolicyRef: e.target.value })} />
          </label>
        )}
      </fieldset>
      <div className={`${panelClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Payload for policy review</h3>
          <button type="button" className={buttonClass} onClick={() => void copy()}>
            <Copy aria-hidden="true" className="size-4" /> Copy payload
          </button>
        </div>
        {copied && <p role="status" className="text-sm text-gray-600 dark:text-gray-300">{copied}</p>}
        <pre className="overflow-x-auto rounded-lg border border-muted bg-gray-50 p-3 text-xs leading-5 dark:border-gray-700 dark:bg-gray-800" aria-label="Additive policy payload">{payload}</pre>
      </div>
    </section>
  );
}
