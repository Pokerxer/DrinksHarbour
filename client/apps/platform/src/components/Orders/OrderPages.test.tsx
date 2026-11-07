import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TrackingPage from "@/app/order-tracking/page";
import DetailPage from "@/app/my-account/orders/[id]/page";
const mocks = vi.hoisted(() => ({
  fetcher: vi.fn(),
  auth: {
    token: "token-a" as string | null,
    user: { _id: "user-a" } as { _id: string } | null,
  },
  params: { id: "order-a" },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/app/my-account/AccountShell", () => ({
  useAccount: () => mocks.auth,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useParams: () => mocks.params,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/fetchWithAuth", () => ({ fetchWithAuth: mocks.fetcher }));
afterEach(() => {
  cleanup();
  mocks.fetcher.mockReset();
  mocks.auth = { token: "token-a", user: { _id: "user-a" } };
  mocks.params = { id: "order-a" };
});
const order = {
  _id: "order-a",
  orderNumber: "DH-OWN",
  status: "confirmed",
  paymentStatus: "paid",
  paymentMethod: "card",
  placedAt: "2026-10-27",
  items: [],
  shippingAddress: {
    fullName: "Own buyer",
    addressLine1: "Street",
    city: "Abuja",
    state: "FCT",
    country: "Nigeria",
  },
  subtotal: 10,
  shippingFee: 0,
  discountTotal: 0,
  totalAmount: 10,
};
const response = (value: unknown) => ({
  ok: true,
  status: 200,
  json: async () => value,
});
it("tracking result disappears on cookie-session user change and refuses obsolete lookup responses", async () => {
  let resolveOld: (value: unknown) => void = () => {};
  mocks.fetcher.mockImplementation((url: string) =>
    url.includes("customer-shipments")
      ? Promise.resolve(
          response({
            data: { orderId: "order-a", managed: false, groups: [] },
          }),
        )
      : new Promise((resolve) => {
          resolveOld = resolve;
        }),
  );
  const view = render(<TrackingPage />);
  fireEvent.change(screen.getByPlaceholderText("e.g. DH2605130001"), {
    target: { value: "DH-OWN" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Track Order" }));
  mocks.auth = { token: "cookie", user: { _id: "user-b" } };
  view.rerender(<TrackingPage />);
  await act(async () => resolveOld(response({ data: { order } })));
  expect(screen.queryByText(/Order #DH-OWN/)).toBeNull();
  expect(screen.getByRole("button", { name: "Track Order" })).toBeTruthy();
});
it("account detail remounts for user change even when cookie token sentinel is unchanged", async () => {
  mocks.auth = { token: "cookie", user: { _id: "user-a" } };
  mocks.fetcher.mockImplementation((url: string) =>
    Promise.resolve(
      response(
        url.includes("customer-shipments")
          ? { data: { orderId: "order-a", managed: false, groups: [] } }
          : { data: { order } },
      ),
    ),
  );
  const view = render(<DetailPage />);
  await screen.findAllByText(/DH-OWN/);
  mocks.fetcher.mockImplementation(() => new Promise(() => {}));
  mocks.auth = { token: "cookie", user: { _id: "user-b" } };
  view.rerender(<DetailPage />);
  expect(screen.queryAllByText(/DH-OWN/)).toHaveLength(0);
});
it("partial account orders explain the split without marking all goods shipped", async () => {
  mocks.fetcher.mockImplementation((url: string) =>
    Promise.resolve(
      response(
        url.includes("customer-shipments")
          ? { data: { orderId: "order-a", managed: false, groups: [] } }
          : { data: { order: { ...order, status: "partially_shipped" } } },
      ),
    ),
  );
  render(<DetailPage />);
  expect(
    await screen.findByText(
      "Some items have shipped. See the shipment groups below for each quantity.",
    ),
  ).toBeTruthy();
});
