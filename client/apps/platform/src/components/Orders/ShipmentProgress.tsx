"use client";
import { useShipmentProgress } from "./useShipmentProgress";
const labels: Record<string, string> = {
  pending: "Awaiting merchant",
  accepted: "Accepted",
  picking: "Preparing",
  partially_shipped: "Partially shipped",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  booked: "Booked",
  dispatched: "Out for delivery",
  failed: "Delivery attempt failed",
  returning: "Return requested",
  returned: "Return received by merchant",
  processing: "Processing",
  needs_review: "Needs review",
  completed: "Completed",
  carrier_reported_delivered: "Carrier reports delivered",
  carrier_cancelled: "Carrier booking cancelled",
};
const label = (status: string) => labels[status] || "Awaiting update";
const methods = {
  pickup: "Pickup",
  local_delivery: "Local delivery",
  merchant: "Merchant shipment",
  carrier: "External carrier",
};
export default function ShipmentProgress({
  orderId,
  sessionKey,
}: {
  orderId: string;
  sessionKey: string | null;
}) {
  const { data, error, denied, loading, refresh } = useShipmentProgress(
    orderId,
    sessionKey,
  );
  return (
    <section
      aria-label="Shipments"
      className="rounded-xl border border-stone-200 bg-white p-5 space-y-4"
    >
      <h2 className="font-bold text-stone-900">Shipment progress</h2>
      {!sessionKey ? (
        <p>
          Sign in to the account that placed this order to see shipment
          progress.
        </p>
      ) : loading ? (
        <p role="status">Loading shipment progress…</p>
      ) : error ? (
        <div>
          <p role="alert">{error}</p>
          {!denied && (
            <button type="button" onClick={refresh} className="underline mt-2">
              Retry shipment progress
            </button>
          )}
        </div>
      ) : data && !data.managed ? (
        <p>
          Use the order status shown on this page. Separate shipment records are
          not available for this order.
        </p>
      ) : (
        data && (
          <>
            <p className="text-sm text-stone-600">
              Updates are recorded by the merchant and delivery team; this is
              not live GPS or verified external carrier tracking.
            </p>
            {!data.groups.length && (
              <p>No shipment groups are available yet.</p>
            )}
            {data.groups.map((group) => (
              <article key={group.id} className="border-t pt-4 space-y-3">
                <h3 className="font-semibold">
                  {group.merchantName} — {label(group.status)}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.line}>
                      <p>
                        {item.name} · {item.quantity} purchased
                      </p>
                      <p className="text-sm text-stone-600">
                        {item.shipped} shipped · {item.delivered} delivered ·{" "}
                        {item.cancelled} cancelled
                      </p>
                    </li>
                  ))}
                </ul>
                {group.shipments.length === 0 ? (
                  <p className="text-sm">
                    No separate shipment has been recorded.
                  </p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {group.shipments.map((shipment, index) => (
                      <li key={shipment.id}>
                        <p className="font-medium">
                          {methods[shipment.method]} {index + 1}:{" "}
                          {label(shipment.status)}
                        </p>
                        <ul>
                          {shipment.items.map((item) => (
                            <li key={item.line}>
                              {group.items.find(
                                (line) => line.line === item.line,
                              )?.name || "Purchased item"}{" "}
                              × {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
                {group.refunds.length > 0 && (
                  <div>
                    <h4 className="font-medium">Refund progress</h4>
                    <ul className="text-sm">
                      {group.refunds.map((refund, index) => (
                        <li key={index}>
                          {label(refund.status)} ·{" "}
                          {new Intl.NumberFormat("en-NG", {
                            style: "currency",
                            currency: refund.currency,
                          }).format(refund.amountMinor / 100)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
            <button
              type="button"
              onClick={refresh}
              className="text-sm underline"
            >
              Refresh shipment progress
            </button>
          </>
        )
      )}
    </section>
  );
}
