import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ShipmentProgress from "./ShipmentProgress";
const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("@/lib/fetchWithAuth", () => ({ fetchWithAuth: fetcher }));
afterEach(() => {
  cleanup();
  fetcher.mockReset();
});
const data = {
  orderId: "order-a",
  managed: true,
  groups: [
    {
      id: "group-a",
      merchantName: "Abuja drinks",
      status: "partially_shipped",
      items: [
        {
          line: "line-a",
          name: "Purchased bottle",
          quantity: 3,
          shipped: 1,
          delivered: 0,
          cancelled: 1,
        },
      ],
      shipments: [
        {
          id: "shipment-a",
          method: "local_delivery",
          status: "failed",
          items: [{ line: "line-a", quantity: 1 }],
        },
      ],
      refunds: [{ status: "needs_review", amountMinor: 1000, currency: "NGN" }],
    },
  ],
};
const response = (value: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => ({ data: value }),
});
it("loads recorded partial shipments and safe refund progress without promising carrier proof", async () => {
  fetcher.mockResolvedValue(response(data));
  render(<ShipmentProgress orderId="order-a" sessionKey="session-a" />);
  expect(screen.getByRole("status").textContent).toContain("Loading");
  expect(
    await screen.findByText(/Purchased bottle · 3 purchased/),
  ).toBeTruthy();
  expect(
    screen.getByText(/1 shipped · 0 delivered · 1 cancelled/),
  ).toBeTruthy();
  expect(screen.getByText(/Delivery attempt failed/)).toBeTruthy();
  expect(screen.getByText(/Needs review/)).toBeTruthy();
  expect(screen.getByText(/not live GPS/)).toBeTruthy();
  expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
});
it("clears old results immediately for a changed session/order and ignores late responses", async () => {
  let resolveOld: (value: unknown) => void = () => {};
  fetcher.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const view = render(
    <ShipmentProgress orderId="order-a" sessionKey="session-a" />,
  );
  fetcher.mockResolvedValue(
    response({ ...data, orderId: "order-b", groups: [] }),
  );
  view.rerender(<ShipmentProgress orderId="order-b" sessionKey="session-b" />);
  await screen.findByText(/No shipment groups/);
  await act(async () => resolveOld(response(data)));
  expect(screen.queryByText(/Purchased bottle · 3 purchased/)).toBeNull();
  view.rerender(<ShipmentProgress orderId="order-b" sessionKey={null} />);
  expect(screen.getByText(/Sign in/)).toBeTruthy();
  expect(screen.queryByText(/No shipment groups/)).toBeNull();
});
it("retries recoverable errors and keeps legacy tracking explicit", async () => {
  fetcher.mockRejectedValueOnce(new Error("network"));
  fetcher.mockResolvedValue(response({ ...data, managed: false, groups: [] }));
  render(<ShipmentProgress orderId="order-a" sessionKey="session-a" />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry shipment progress" }),
  );
  expect(await screen.findByText(/Use the order status shown/)).toBeTruthy();
});
it("does not retain data or offer retry for ownership denial", async () => {
  fetcher.mockResolvedValue(response(null, false, 404));
  render(<ShipmentProgress orderId="order-a" sessionKey="session-a" />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("unavailable for this account"),
  );
  expect(
    screen.queryByRole("button", { name: "Retry shipment progress" }),
  ).toBeNull();
});
it("refresh replaces quantities instead of retaining stale shipment progress", async () => {
  fetcher.mockResolvedValueOnce(response(data));
  fetcher.mockResolvedValueOnce(
    response({
      ...data,
      groups: [
        {
          ...data.groups[0],
          items: [{ ...data.groups[0].items[0], shipped: 2 }],
        },
      ],
    }),
  );
  render(<ShipmentProgress orderId="order-a" sessionKey="session-a" />);
  await screen.findByText(/Purchased bottle · 3 purchased/);
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh shipment progress" }),
  );
  expect(await screen.findByText(/2 shipped/)).toBeTruthy();
});
it("labels requested returns separately from physical receipt and refunds", async()=>{
 const returned=structuredClone(data);returned.groups[0].shipments[0].status="returning";
 returned.groups[0].shipments.push({...returned.groups[0].shipments[0],id:"received",status:"returned"});
 fetcher.mockResolvedValue(response(returned));render(<ShipmentProgress orderId="order-a" sessionKey="session-a"/>);
 expect(await screen.findByText(/Return requested/)).toBeTruthy();
 expect(await screen.findByText(/Return received by merchant/)).toBeTruthy();
});
it("labels carrier delivery as a provider report without changing merchant goods quantities", async () => {
  const carrier = structuredClone(data);
  carrier.groups[0].shipments[0].method = "carrier";
  carrier.groups[0].shipments[0].status = "carrier_reported_delivered";
  fetcher.mockResolvedValue(response(carrier));
  render(<ShipmentProgress orderId="order-a" sessionKey="session-a" />);
  expect(await screen.findByText(/External carrier 1: Carrier reports delivered/)).toBeTruthy();
  expect(screen.getByText(/1 shipped · 0 delivered · 1 cancelled/)).toBeTruthy();
});
