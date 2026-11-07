'use client';
import { useState } from 'react';
import { type DispatchOrder } from '@/services/local-dispatch.service';
import { formatMerchantMoney } from '@/services/merchant-order.service';
import { buttonClass, fieldClass } from '../market-foundation/workspace';
import { gateAlert } from './design-tokens';
import { useLocalDispatch } from './use-local-dispatch';
import DispatchBookingCard from './local-dispatch-booking';
export default function LocalDispatchPanel({
  row,
  token,
  onChange,
}: {
  row: DispatchOrder;
  token: string;
  onChange?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [quantities, setQuantities] = useState<Record<string, string>>({}),
    [driver, setDriver] = useState('');
  const state = useLocalDispatch(token, row._id, onChange),
    options = state.options;
  if (row.fulfillmentVersion !== 2) return null;
  return (
    <section className="space-y-3 border-t pt-3">
      <button
        className={buttonClass}
        aria-expanded={open}
        disabled={state.busy}
        onClick={() => {
          setOpen(true);
          void state.open();
        }}
      >
        Local rider delivery
      </button>
      {open && (
        <div className="space-y-4">
          {state.error && (
            <div className={`${gateAlert} flex-col`}>
              <p role="alert">
                {state.error}
              </p>
              <button
                className={buttonClass}
                disabled={state.busy}
                onClick={() => void state.open()}
              >
                Retry delivery options
              </button>
            </div>
          )}
          {state.busy && <p role="status">Updating local delivery…</p>}
          {options && (
            <>
              {!options.creationEnabled && (
                <p className="max-w-2xl text-sm leading-6 text-gray-600">
                  New local bookings are disabled. Existing bookings remain
                  available below.
                </p>
              )}
              {!options.contract && (
                <p className="max-w-2xl text-sm leading-6 text-gray-600">
                  No current reviewed local delivery terms for this location.
                  Ask platform staff to review coverage, charges and handling
                  capabilities.
                </p>
              )}
              {options.contract && options.creationEnabled && (
                <div className="space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-100/30">
                  <p className="font-medium tabular-nums">
                    Reviewed delivery fee{' '}
                    {formatMerchantMoney(
                      options.contract.amountMinor,
                      options.contract.currency
                    )}
                  </p>
                  <p className="text-sm">
                    {options.contract.coverage.join(' · ')}
                  </p>
                  <p className="text-sm leading-6 text-gray-600">
                    Uses the delivery amount already included in this order. The
                    destination and selected items must meet the reviewed terms.
                  </p>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void state.getQuote(
                        row.lines
                          .map((line) => ({
                            line: line.line,
                            quantity: Number(quantities[line.line] || 0),
                          }))
                          .filter((line) => line.quantity > 0)
                      );
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {row.lines.map((line) => {
                        const progress = row.quantityProgress?.find(
                            (p) => p.line === line.line
                          ),
                          remaining = Math.max(
                            0,
                            line.quantity -
                              (progress?.shipped || 0) -
                              (progress?.cancelled || 0)
                          ),
                          name = line.productName || 'Order item';
                        return (
                          <label key={line.line}>
                            {name} · {remaining} unshipped
                            <input
                              className={fieldClass}
                              aria-label={`Quantity for ${name}`}
                              type="number"
                              min={0}
                              max={remaining}
                              step={1}
                              value={quantities[line.line] || ''}
                              onChange={(e) => {
                                state.setQuote(undefined);
                                setQuantities({
                                  ...quantities,
                                  [line.line]: e.target.value,
                                });
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                    <button className={buttonClass} disabled={state.busy}>
                      Get reviewed quote
                    </button>
                  </form>
                  {state.quote && (
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (state.quote)
                          void state.perform(`/orders/${row._id}/bookings`, {
                            quoteId: state.quote._id,
                            driverId: driver,
                          });
                      }}
                    >
                      <p>
                        {formatMerchantMoney(
                          state.quote.amountMinor,
                          state.quote.currency
                        )}{' '}
                        · Quote expires{' '}
                        {new Date(state.quote.expiresAt).toLocaleString()}
                      </p>
                      <label className="block">
                        Available own rider
                        <select
                          className={fieldClass}
                          required
                          value={driver}
                          onChange={(e) => setDriver(e.target.value)}
                        >
                          <option value="">Choose an available rider</option>
                          {options.drivers.map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.name} · {d.vehicleType} · {d.capacityKg} kg
                            </option>
                          ))}
                        </select>
                      </label>
                      {!options.drivers.length && (
                        <p className="text-sm">
                          No eligible rider is available. Refresh after staffing
                          is reviewed.
                        </p>
                      )}
                      <button
                        className={buttonClass}
                        disabled={
                          state.busy ||
                          !options.drivers.length ||
                          new Date(state.quote.expiresAt) <= new Date()
                        }
                      >
                        Book local rider
                      </button>
                    </form>
                  )}
                </div>
              )}
              {options.bookings.map((booking) => (
                <DispatchBookingCard
                  key={booking._id}
                  booking={booking}
                  recoveryDrivers={options.recoveryDrivers || options.drivers}
                  busy={state.busy}
                  perform={state.perform}
                  token={token}
                />
              ))}
              {options.hasMoreBookings && (
                <p className="text-sm">
                  Older delivery history requires staff review.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
