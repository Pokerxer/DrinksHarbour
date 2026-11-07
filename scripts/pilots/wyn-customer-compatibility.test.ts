import { registerFinancialChecks } from "./wyn-pilot-financial-checks";
import { expect, test } from "vitest";
import { cookieJar, writtenCookies } from "./next-cookie-fixture.mjs";
import { openSession, sealSession } from "@wyn/lib/auth-session";
import { POST as checkoutPost } from "@wyn/app/api/checkout/route";
import {
  GET as checkoutStatus,
  POST as checkoutAction,
} from "@wyn/app/api/checkout/status/route";
import { POST as quotePost } from "@wyn/app/api/quote/route";
import {
  serverRequire,
  mongoose,
  enabled,
  tenant,
  issuing,
  customer,
  session,
  otherSession,
  payload,
  providerCalls,
  forwardedTokens,
  secret,
  M,
  S,
  request,
  syncCheckoutCookie,
} from "./wyn-pilot-fixture";
let made: { id: string; orderId?: string; status: string };
test.skipIf(!enabled)(
  "actual signed-in Wyn BFF forwards validated customer to backend checkout and own history once",
  async () => {
    const expired = S("tenantCustomer.tokens").sign(
      tenant,
      customer,
      "access",
      serverRequire("jsonwebtoken").decode(session.token).jti,
      "-1s",
    );
    cookieJar.set(
      "wyn_customer",
      sealSession(
        {
          token: expired,
          refreshToken: session.refreshToken,
          tenantId: String(tenant._id),
        },
        secret,
      ),
    );
    const quote = await quotePost(request("/api/quote", payload));
    expect(quote.status).toBe(200);
    const rotated = openSession(cookieJar.get("wyn_customer"), secret)!;
    expect(rotated.token).not.toBe(expired);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(
      writtenCookies.some(
        (item) =>
          item.name === "wyn_customer" && item.options.httpOnly === true,
      ),
    ).toBe(true);
    session.token = rotated.token;
    session.refreshToken = rotated.refreshToken;
    const response = await checkoutPost(request("/api/checkout", payload));
    expect(response.status).toBe(200);
    made = await response.json();
    syncCheckoutCookie(response);
    const row = await M("IntegrationCheckout").findById(made.id).lean();
    const order = await M("Order").findById(row.order).lean();
    expect(String(row.customer)).toBe(String(customer));
    expect(String(order.user)).toBe(String(customer));
    expect(forwardedTokens.at(-1)).toBe(session.token);
    expect(row.channelSnapshot.market).toBe("NG");
    expect(row.channelSnapshot.paymentOwner.account).toBe("PILOT");
    expect(order.platformCommissionTotal).toBe(0);
    expect(response.cookies.get("wc_checkout")).toBeTruthy();
    expect(JSON.stringify(made).includes(session.token)).toBe(false);
    const again = await checkoutPost(request("/api/checkout", payload));
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(made.id);
    expect(providerCalls).toBe(1);
    expect(await M("Order").countDocuments()).toBe(1);
    const history = await fetch(
      process.env.DRINKSHARBOUR_API_URL + "/customers/orders",
      {
        headers: {
          Authorization: `Bearer ${issuing.secret}`,
          "X-Customer-Token": session.token,
        },
      },
    );
    expect((await history.json()).data).toHaveLength(1);
  },
);
test.skipIf(!enabled)(
  "signed checkout cookie cannot be read or cancelled after switching customer",
  async () => {
    const saved = cookieJar.get("wyn_customer");
    cookieJar.set(
      "wyn_customer",
      sealSession(
        {
          token: otherSession.token,
          refreshToken: otherSession.refreshToken,
          tenantId: String(tenant._id),
        },
        secret,
      ),
    );
    try {
      expect((await checkoutStatus()).status).toBe(403);
      expect(
        (
          await checkoutAction(
            request("/api/checkout/status", { action: "cancel" }),
          )
        ).status,
      ).toBe(403);
      expect(
        (await checkoutPost(request("/api/checkout", payload))).status,
      ).toBe(403);
      expect(providerCalls).toBe(1);
      expect(await M("Order").countDocuments()).toBe(1);
    } finally {
      cookieJar.set("wyn_customer", saved);
    }
  },
);

test.skipIf(!enabled)(
  "legacy unbound checkout cookies fail closed before status or replacement",
  async () => {
    const { signCheckout } = await import("@wyn/lib/checkout-session");
    const saved = cookieJar.get("wc_checkout");
    cookieJar.set("wc_checkout", signCheckout(made.id, secret));
    try {
      expect((await checkoutStatus()).status).toBe(403);
      expect(
        (await checkoutPost(request("/api/checkout", payload))).status,
      ).toBe(403);
      expect(providerCalls).toBe(1);
    } finally {
      cookieJar.set("wc_checkout", saved);
    }
  },
);
test.skipIf(!enabled)(
  "issuing-key replacement cannot reuse the original customer checkout cookie",
  async () => {
    const savedKey = process.env.DRINKSHARBOUR_API_KEY,
      savedAuth = cookieJar.get("wyn_customer");
    const second = await S("apiKey.service").issueKey(
      tenant,
      new mongoose.Types.ObjectId(),
      {
        name: "Synthetic rotated key",
        scopes: ["storefront:read", "checkout:write"],
      },
    );
    await M("StorefrontChannel").collection.updateOne(
      { tenant: tenant._id },
      { $set: { apiKey: second.key._id } },
    );
    process.env.DRINKSHARBOUR_API_KEY = second.secret;
    cookieJar.set(
      "wyn_customer",
      sealSession(
        {
          token: session.token,
          refreshToken: session.refreshToken,
          tenantId: String(tenant._id),
        },
        secret,
      ),
    );
    try {
      expect((await checkoutStatus()).status).toBe(403);
      expect(
        (await checkoutPost(request("/api/checkout", payload))).status,
      ).toBe(403);
      expect(providerCalls).toBe(1);
    } finally {
      process.env.DRINKSHARBOUR_API_KEY = savedKey;
      cookieJar.set("wyn_customer", savedAuth);
      await M("StorefrontChannel").collection.updateOne(
        { tenant: tenant._id },
        { $set: { apiKey: issuing.key._id } },
      );
    }
  },
);
test.skipIf(!enabled)(
  "market withdrawal blocks new quotes while an accepted checkout status and retry recover",
  async () => {
    await M("SalesChannel").collection.updateOne(
      { code: "SYNTHETIC_PILOT" },
      { $set: { active: false } },
    );
    try {
      expect((await quotePost(request("/api/quote", payload))).status).toBe(
        403,
      );
      expect((await checkoutStatus()).status).toBe(200);
      const replay = await checkoutPost(request("/api/checkout", payload));
      expect(replay.status).toBe(200);
      expect((await replay.json()).id).toBe(made.id);
      expect(providerCalls).toBe(1);
    } finally {
      await M("SalesChannel").collection.updateOne(
        { code: "SYNTHETIC_PILOT" },
        { $set: { active: true } },
      );
    }
  },
);

registerFinancialChecks(() => made);
