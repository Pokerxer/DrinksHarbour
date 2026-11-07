'use client';
import { useEffect, useRef, useState } from 'react';
import {
  carrierRequest,
  type CarrierOptions,
  type CarrierQuote,
  type CarrierRate,
} from '@/services/carrier.service';
import { formatMerchantMoney } from '@/services/merchant-order.service';
import { buttonClass, fieldClass } from '../market-foundation/workspace';
import CarrierReviewForm from './carrier-review-form';
import CarrierBookings from './carrier-bookings';
type Props = {
  row: { _id: string; tenant: string; location: string; fulfillmentVersion?: number };
  token: string;
  platform: boolean;
};
export default function CarrierPanel(props: Props) {
  return props.row.fulfillmentVersion === 2 ? (
    <Workspace key={`${props.token}:${props.row._id}`} {...props} />
  ) : null;
}
function Workspace({ row, token, platform }: Props) {
  const [open, setOpen] = useState(false),
    [options, setOptions] = useState<CarrierOptions>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [allocation, setAllocation] = useState(''),
    [date, setDate] = useState(''),
    [dimensions, setDimensions] = useState({ length: '', width: '', height: '' }),
    [quote, setQuote] = useState<CarrierQuote>(),
    [choice, setChoice] = useState<CarrierRate>();
  const active = useRef(true),
    lock = useRef(false),
    keys = useRef(new Map<string, string>());
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function load() {
    const data = await carrierRequest<CarrierOptions>(token, `/orders/${row._id}`);
    if (active.current) setOptions(data);
  }
  async function run(work: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
      return true;
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Carrier outcome is uncertain. Refresh the original responsibility.',
        );
      return false;
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function mutation(path: string, payload: Record<string, unknown>, keyed = true) {
    const identity = JSON.stringify([path, payload]);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    return run(async () => {
      await carrierRequest(token, path, 'POST', {
        ...payload,
        ...(keyed ? { idempotencyKey: keys.current.get(identity) } : {}),
      });
      if (!active.current) return;
      setQuote(undefined);
      setChoice(undefined);
      await load();
    });
  }
  const available =
    options?.allocations.filter((a) => !options.bookings.some((b) => b.allocationId === a._id)) ||
    [];
  return (
    <section className="space-y-3 border-t pt-3" aria-label="External parcel delivery">
      <button
        className={buttonClass}
        disabled={busy}
        onClick={() => {
          setOpen(true);
          void run(load);
        }}
      >
        External parcel delivery
      </button>
      {open && (
        <>
          <p className="text-sm">
            Carrier observations are separate from merchant goods confirmation. Cancellation does
            not restock goods or prove a refund.
          </p>
          {error && <p role="alert">{error}</p>}
          {!options ? (
            <p role="status">Loading carrier responsibilities…</p>
          ) : (
            <>
              {!options.enabled && (
                <p>New carrier booking is disabled. Existing responsibilities remain available.</p>
              )}
              {!options.ready && (
                <p>
                  A current account and capability review is required before new carrier requests.
                </p>
              )}
              <button className={buttonClass} disabled={busy} onClick={() => void run(load)}>
                Refresh carrier responsibilities
              </button>
              {platform && (
                <CarrierReviewForm
                  tenant={row.tenant}
                  location={row.location}
                  version={(options.review?.version || 0) + 1}
                  busy={busy}
                  save={(payload) => mutation('/reviews', payload, false)}
                  revoke={
                    options.review?.status === 'reviewed'
                      ? () => mutation(`/reviews/${options.review?._id}/revoke`, {}, false)
                      : undefined
                  }
                />
              )}
              {available.length > 0 && (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setChoice(undefined);
                    void run(async () => {
                      const data = await carrierRequest<{ quote: CarrierQuote }>(
                        token,
                        `/orders/${row._id}/quotes`,
                        'POST',
                        {
                          allocationId: allocation,
                          dimensions: Object.fromEntries(
                            Object.entries(dimensions).map(([k, v]) => [k, Number(v)]),
                          ),
                          pickupDate: date,
                        },
                      );
                      if (active.current) setQuote(data.quote);
                    });
                  }}
                >
                  <label>
                    Carrier shipment
                    <select
                      aria-label="Carrier shipment"
                      className={fieldClass}
                      disabled={busy}
                      required
                      value={allocation}
                      onChange={(e) => {
                        setAllocation(e.target.value);
                        setQuote(undefined);
                        setChoice(undefined);
                      }}
                    >
                      <option value="">Choose a recorded shipment</option>
                      {available.map((a, i) => (
                        <option key={a._id} value={a._id}>
                          Shipment {i + 1} · {a.lines.reduce((n, l) => n + l.quantity, 0)} item(s)
                        </option>
                      ))}
                    </select>
                  </label>
                  {(['length', 'width', 'height'] as const).map((k) => (
                    <label key={k}>
                      Package {k} (cm)
                      <input
                        aria-label={`Package ${k} (cm)`}
                        className={fieldClass}
                      disabled={busy}
                        type="number"
                        min="0.1"
                        max="300"
                        step="0.1"
                        required
                        value={dimensions[k]}
                        onChange={(e) => {
                          setDimensions({ ...dimensions, [k]: e.target.value });
                          setQuote(undefined);
                          setChoice(undefined);
                        }}
                      />
                    </label>
                  ))}
                  <label>
                    Carrier pickup date
                    <input
                      aria-label="Carrier pickup date"
                      className={fieldClass}
                      disabled={busy}
                      type="date"
                      required
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setQuote(undefined);
                        setChoice(undefined);
                      }}
                    />
                  </label>
                  <button className={buttonClass} disabled={busy || !options.ready}>
                    Get reviewed carrier rates
                  </button>
                </form>
              )}
              {quote && (
                <div className="space-y-2">
                  <p>Quoted rates expire {new Date(quote.expiresAt).toLocaleString()}.</p>
                  {quote.rates.map((rate) => (
                    <button
                      key={`${rate.courierId}:${rate.serviceCode}`}
                      className={buttonClass}
                      disabled={busy}
                      onClick={() => setChoice(rate)}
                    >
                      Choose {rate.name}
                    </button>
                  ))}
                </div>
              )}
              {choice && quote && (
                <section
                  className="space-y-2 rounded border p-3"
                  aria-label="Confirm carrier charge"
                >
                  <p>
                    {choice.name}: provider wallet charge{' '}
                    {formatMerchantMoney(choice.amountMinor, 'NGN')}; quoted displayed rate{' '}
                    {formatMerchantMoney(choice.displayMinor, 'NGN')}. No new customer charge is
                    collected.
                  </p>
                  <button
                    className={buttonClass}
                    disabled={busy || !options.ready}
                    onClick={() =>
                      void mutation(`/orders/${row._id}/bookings`, {
                        quoteId: quote._id,
                        courierId: choice.courierId,
                        serviceCode: choice.serviceCode,
                      })
                    }
                  >
                    Confirm carrier booking
                  </button>
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => setChoice(undefined)}
                  >
                    Back to rates
                  </button>
                </section>
              )}
              <CarrierBookings bookings={options.bookings} platform={platform} busy={busy} onAction={mutation} />
            </>
          )}
        </>
      )}
    </section>
  );
}
