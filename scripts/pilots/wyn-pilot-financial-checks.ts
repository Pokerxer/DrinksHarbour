import { expect, test, vi } from "vitest";
import { POST as checkoutPost } from "@wyn/app/api/checkout/route";
import {
  GET as checkoutStatus,
  POST as checkoutAction,
} from "@wyn/app/api/checkout/status/route";
import {
  enabled,
  tenant,
  issuing,
  payload,
  M,
  S,
  serverRequire,
  request,
  syncCheckoutCookie,
} from "./wyn-pilot-fixture";
export function registerFinancialChecks(getMade: () => { id: string }) {
  test.skipIf(!enabled)(
    "actual payment return verifies once and reconciles website channel reporting",
    async () => {
      const row = await M("IntegrationCheckout").findById(getMade().id).lean();
      const verify = vi
        .spyOn(S("storefrontGateway"), "verify")
        .mockResolvedValue({
          reference: row.reference,
          status: "success",
          amount: 1200,
          currency: "NGN",
          paymentAccount: "PILOT",
          transactionId: "synthetic-receipt-only",
        });
      const paid = await checkoutAction(
        request("/api/checkout/status", { action: "verify" }),
      );
      expect(paid.status).toBe(200);
      expect((await paid.json()).status).toBe("paid");
      expect(
        (
          await checkoutAction(
            request("/api/checkout/status", { action: "verify" }),
          )
        ).status,
      ).toBe(200);
      expect(verify).toHaveBeenCalledTimes(1);
      const order = await M("Order").findById(row.order).lean();
      expect(order.paymentStatus).toBe("paid");
      expect(order.paymentAccount).toBe("PILOT");
      const report = await fetch(
        process.env.DRINKSHARBOUR_API_URL + "/reports/sales",
        { headers: { Authorization: `Bearer ${issuing.secret}` } },
      );
      const rows = (await report.json()).data;
      expect(rows).toHaveLength(1);
      expect(rows[0].paidOrderTotal).toBe(1200);
      expect(rows[0].platformCommission).toBe(0);
      expect(rows[0].salesChannel).toBe("SYNTHETIC_PILOT");
    },
  );

  test.skipIf(!enabled)(
    "actual cancel and signed late webhook release only their hold and never reacquire stock",
    async () => {
      const secondPayload = {
        ...payload,
        attempt: "b8e187f7-591c-4569-bdef-118ad04a6c8d",
      };
      const created = await checkoutPost(
        request("/api/checkout", secondPayload),
      );
      expect(created.status).toBe(200);
      const second = await created.json();
      syncCheckoutCookie(created);
      const row = await M("IntegrationCheckout").findById(second.id).lean();
      S("storefrontGateway").verify.mockResolvedValue({
        reference: row.reference,
        status: "failed",
        paymentAccount: "PILOT",
      });
      expect(
        (
          await checkoutAction(
            request("/api/checkout/status", { action: "cancel" }),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await checkoutAction(
            request("/api/checkout/status", { action: "cancel" }),
          )
        ).status,
      ).toBe(200);
      const before = await M("WarehouseStock")
        .findOne({ tenant: tenant._id })
        .lean();
      expect(before.currentQuantity).toBe(3);
      expect(before.reservedQuantity).toBe(1);
      S("storefrontGateway").verify.mockResolvedValue({
        reference: row.reference,
        status: "success",
        amount: 1200,
        currency: "NGN",
        paymentAccount: "PILOT",
        transactionId: "synthetic-late-receipt",
      });
      const raw = JSON.stringify({
        event: "charge.success",
        data: { reference: row.reference },
      });
      const signature = serverRequire("node:crypto")
        .createHmac("sha512", "synthetic-account-only")
        .update(raw)
        .digest("hex");
      const webhook = await fetch(
        process.env.DRINKSHARBOUR_API_URL + "/webhooks/paystack/PILOT",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-paystack-signature": signature,
          },
          body: raw,
        },
      );
      expect(webhook.status).toBe(200);
      expect((await checkoutStatus()).status).toBe(200);
      expect(
        (await M("IntegrationCheckout").findById(second.id).lean()).state,
      ).toBe("needs_review");
      const after = await M("WarehouseStock")
        .findOne({ tenant: tenant._id })
        .lean();
      expect(after.currentQuantity).toBe(before.currentQuantity);
      expect(after.reservedQuantity).toBe(before.reservedQuantity);
    },
  );
}
