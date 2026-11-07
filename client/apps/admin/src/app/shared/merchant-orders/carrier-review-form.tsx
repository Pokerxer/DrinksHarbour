'use client';
import { useState } from 'react';
import type { CarrierReview } from '@/services/carrier.service';
import { buttonClass, fieldClass } from '../market-foundation/workspace';
type Props = {
  tenant: string;
  location: string;
  version: number;
  busy: boolean;
  save: (value: CarrierReview) => Promise<boolean>;
  revoke?: () => Promise<boolean>;
};
export default function CarrierReviewForm({
  tenant,
  location,
  version,
  busy,
  save,
  revoke,
}: Props) {
  const [open, setOpen] = useState(false),
    [proposal, setProposal] = useState<CarrierReview>(),
    [revoking, setRevoking] = useState(false);
  return (
    <section className="space-y-3">
      <button className={buttonClass} disabled={busy} onClick={() => setOpen(true)}>
        Review carrier terms
      </button>
      {open && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setProposal({
              tenant,
              location,
              version,
              account: String(data.get('account')).trim(),
              categoryId: Number(data.get('categoryId')),
              maxUnits: Number(data.get('maxUnits')),
              maxWeightGrams: Number(data.get('maxWeightGrams')),
              allowedServices: [
                {
                  courierId: String(data.get('courierId')).trim(),
                  serviceCode: String(data.get('serviceCode')).trim(),
                },
              ],
              capabilities: {
                alcohol: data.get('alcohol') === 'yes',
                ageVerification: data.get('ageVerification') === 'yes',
                fragile: data.get('fragile') === 'yes',
              },
              reviewReference: String(data.get('reviewReference')).trim(),
              validUntil: new Date(String(data.get('validUntil'))).toISOString(),
            });
          }}
        >
          <p className="sm:col-span-2">
            Enter evidence from the approved carrier account and service. These terms do not enable
            production booking or certify a carrier.
          </p>
          {(
            [
              ['account', 'Carrier account reference', 'text'],
              ['courierId', 'Reviewed courier ID', 'text'],
              ['serviceCode', 'Reviewed service code', 'text'],
              ['categoryId', 'Provider parcel category', 'number'],
              ['maxUnits', 'Maximum carrier units', 'number'],
              ['maxWeightGrams', 'Maximum carrier weight (grams)', 'number'],
              ['reviewReference', 'Carrier review evidence', 'text'],
              ['validUntil', 'Carrier review valid until', 'datetime-local'],
            ] as const
          ).map(([name, label, type]) => (
            <label key={name}>
              {label}
              <input
                aria-label={label}
                className={fieldClass}
                name={name}
                type={type}
                required
                min={type === 'number' ? 1 : undefined}
                step={type === 'number' ? 1 : undefined}
                maxLength={500}
              />
            </label>
          ))}
          {(
            [
              ['alcohol', 'Carrier alcohol handling'],
              ['ageVerification', 'Carrier age verification'],
              ['fragile', 'Carrier fragile handling'],
            ] as const
          ).map(([name, label]) => (
            <label key={name}>
              {label}
              <select
                aria-label={label}
                className={fieldClass}
                name={name}
                defaultValue=""
                required
              >
                <option value="">Choose reviewed capability</option>
                <option value="yes">Supported with evidence</option>
                <option value="no">Unsupported</option>
              </select>
            </label>
          ))}
          <button className={buttonClass} disabled={busy}>
            Review exact carrier terms
          </button>
        </form>
      )}
      {proposal && (
        <section className="space-y-2 rounded border p-3" aria-label="Confirm carrier review">
          <p>
            Version {proposal.version} · Account {proposal.account} · Courier{' '}
            {proposal.allowedServices[0].courierId} · Service{' '}
            {proposal.allowedServices[0].serviceCode}
          </p>
          <p>
            Category {proposal.categoryId} · {proposal.maxUnits} units · {proposal.maxWeightGrams}{' '}
            grams · Valid until {proposal.validUntil}
          </p>
          <p>
            Alcohol: {String(proposal.capabilities.alcohol)} · Age verification:{' '}
            {String(proposal.capabilities.ageVerification)} · Fragile:{' '}
            {String(proposal.capabilities.fragile)}
          </p>
          <p>{proposal.reviewReference}</p>
          <button
            className={buttonClass}
            disabled={busy}
            onClick={async () => {
              if (await save(proposal)) {
                setProposal(undefined);
                setOpen(false);
              }
            }}
          >
            Confirm exact carrier review
          </button>
          <button className={buttonClass} disabled={busy} onClick={() => setProposal(undefined)}>
            Edit carrier terms
          </button>
        </section>
      )}
      {revoke && (
        <button className={buttonClass} disabled={busy} onClick={() => setRevoking(true)}>
          Revoke current carrier review
        </button>
      )}
      {revoking && revoke && (
        <div>
          <p>Revoke this exact current review? Existing carrier obligations remain recoverable.</p>
          <button
            className={buttonClass}
            disabled={busy}
            onClick={async () => {
              if (await revoke()) setRevoking(false);
            }}
          >
            Confirm carrier review revocation
          </button>
        </div>
      )}
    </section>
  );
}
