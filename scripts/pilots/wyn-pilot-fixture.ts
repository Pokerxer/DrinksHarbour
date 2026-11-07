import { afterAll, beforeAll, expect, vi } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";
import { cookieJar, writtenCookies } from "./next-cookie-fixture.mjs";
import { sealSession } from "@wyn/lib/auth-session";
export const serverRequire = createRequire(
  path.join(process.cwd(), "server/package.json"),
);
export const mongoose = serverRequire("mongoose"),
  express = serverRequire("express");
const uri = process.env.DRINKSHARBOUR_DIRECT_TEST_MONGO_URI;
export const enabled = !!uri;
const previous = { ...process.env };
let server: ReturnType<ReturnType<typeof express>["listen"]>;
export let tenant: Record<string, unknown>,
  issuing: { key: { _id: unknown }; secret: string },
  customer: unknown,
  other: unknown;
export let session: {
    token: string;
    refreshToken: string;
    user: { _id: string };
  },
  otherSession: typeof session;
export let payload: Record<string, unknown>;
export let providerCalls = 0;
export const forwardedTokens: string[] = [];
export const secret = "synthetic-pilot-session-secret-at-least-32-characters";
// Only this fixture imports backend modules; the applications remain independent.
export const M = (name: string) => serverRequire(`./models/${name}`);
export const S = (name: string) => serverRequire(`./services/${name}`);
export const request = (path: string, body: unknown) =>
  new Request(`https://pilot.invalid${path}`, {
    method: "POST",
    headers: {
      Origin: "https://pilot.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
export const syncCheckoutCookie = (
  response: Response & {
    cookies?: { get(name: string): { value: string } | undefined };
  },
) => {
  const value = response.cookies?.get("wc_checkout")?.value;
  if (value) cookieJar.set("wc_checkout", value);
};
beforeAll(async () => {
  if (!enabled) return;
  expect(uri).toMatch(
    /^mongodb:\/\/127\.0\.0\.1:29128\/drinks_direct_test_[\w]+\?replicaSet=storefrontDirect$/,
  );
  await mongoose.connect(uri!.replace("?", `_actual_bff_${process.pid}?`), {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });
  Object.assign(process.env, {
    JWT_SECRET: "synthetic-pilot-backend-secret-only",
    MARKET_FOUNDATIONS_ENABLED: "true",
    STOREFRONT_MODE: "live",
    SESSION_SECRET: secret,
    SITE_URL: "https://pilot.invalid",
    STOREFRONT_PAYSTACK_PILOT_SECRET_KEY: "synthetic-account-only",
  });
  const oid = () => new mongoose.Types.ObjectId();
  const tenantId = oid(),
    warehouse = oid(),
    product = oid(),
    subproduct = oid(),
    size = oid(),
    actor = oid();
  customer = oid();
  other = oid();
  await M("Tenant").collection.insertOne({
    _id: tenantId,
    name: "Synthetic local pilot",
    slug: "synthetic-pilot",
    status: "approved",
    isActive: true,
    subscriptionStatus: "active",
    plan: "pro",
    revenueModel: "commission",
    commissionPercentage: 13,
    storefrontIntegrationEnabled: true,
  });
  await M("Warehouse").create({
    _id: warehouse,
    tenant: tenantId,
    name: "Synthetic shop",
    code: "PILOT",
    isActive: true,
  });
  tenant = await M("Tenant").findById(tenantId).lean();
  issuing = await S("apiKey.service").issueKey(tenant, actor, {
    name: "Synthetic pilot website",
    scopes: ["storefront:read", "checkout:write"],
  });
  const direct = await M("StorefrontChannel").create({
    tenant: tenantId,
    apiKey: issuing.key._id,
    warehouse,
    code: "SYNTHETIC_PILOT",
    paymentAccount: "PILOT",
    returnOrigins: ["https://pilot.invalid"],
    enabled: true,
    configuredBy: actor,
  });
  await M("SalesChannel").collection.insertOne({
    tenant: tenantId,
    kind: "storefront",
    market: "NG",
    currency: "NGN",
    active: true,
    version: 1,
    code: "SYNTHETIC_PILOT",
    storefrontChannel: direct._id,
    apiKey: issuing.key._id,
    location: warehouse,
    legalOwner: { type: "tenant", reference: String(tenantId) },
    paymentOwner: {
      type: "tenant",
      reference: String(tenantId),
      provider: "paystack",
      account: "PILOT",
    },
    pricingPolicy: {
      code: "TENANT_RETAIL",
      version: 1,
      termsReference: "synthetic-pilot-only",
    },
  });
  await M("CountryConfiguration").collection.insertOne({
    code: "NG",
    currency: "NGN",
    active: true,
    version: 1,
    capabilities: { marketplace: true, storefront: true, erm: true },
  });
  const term = {
    effectiveFrom: new Date("2020-01-01"),
    effectiveUntil: new Date("2090-01-01"),
  };
  await M("MarketCategoryPolicy").collection.insertOne({
    market: "NG",
    category: "beverage",
    channel: "storefront",
    version: 1,
    mode: "open",
    ...term,
  });
  await M("MarketEnrollment").collection.insertOne({
    tenant: tenantId,
    market: "NG",
    category: "beverage",
    channel: "storefront",
    version: 1,
    status: "approved",
    ...term,
  });
  await M("Product").collection.insertOne({
    _id: product,
    name: "Synthetic pilot bottle",
    type: "beer",
    tracksBatch: false,
    status: "approved",
    isPublished: true,
  });
  await M("SubProduct").collection.insertOne({
    _id: subproduct,
    tenant: tenantId,
    product,
    isPublished: true,
    status: "active",
    visibleInOnlineStore: true,
    baseSellingPrice: 1200,
    costPrice: 500,
    totalStock: 100,
    availableStock: 100,
  });
  await M("Size").collection.insertOne({
    _id: size,
    tenant: tenantId,
    subproduct,
    size: "75cl",
    status: "active",
    availability: "available",
    sellingPrice: 1200,
    costPrice: 500,
    availableStock: 100,
  });
  await M("WarehouseStock").create({
    tenant: tenantId,
    warehouse,
    subProduct: subproduct,
    size,
    currentQuantity: 3,
    reservedQuantity: 0,
  });
  const identity = serverRequire("./utils/customerIdentity").customerIdentity(
    tenant,
  );
  await M("User").collection.insertMany(
    [customer, other].map((_id, n) => ({
      _id,
      ...identity,
      status: "active",
      firstName: "Pilot",
      lastName: `Buyer${n}`,
      email: `buyer${n}@pilot.invalid`,
      isEmailVerified: true,
    })),
  );
  session = await S("tenantCustomer.sessions").issue(
    tenant,
    await M("User").findById(customer).lean(),
  );
  otherSession = await S("tenantCustomer.sessions").issue(
    tenant,
    await M("User").findById(other).lean(),
  );
  await Promise.all(
    ["IntegrationCheckout", "OnlineStockReservation"].map((name) =>
      M(name).createIndexes(),
    ),
  );
  vi.spyOn(S("storefrontGateway"), "initialize").mockImplementation(
    async (row: { reference: string }) => {
      providerCalls++;
      return {
        reference: row.reference,
        authorizationUrl: "https://checkout.paystack.com/synthetic-pilot",
      };
    },
  );
  vi.spyOn(S("accounting.orders"), "captureOrderAccounting").mockResolvedValue(
    undefined,
  );
  const app = express();
  app.use(
    express.json({
      verify(req, res, bytes) {
        req.rawBody = bytes;
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.path === "/api/integrations/v1/checkout")
      forwardedTokens.push(req.headers["x-customer-token"]);
    next();
  });
  app.use(
    "/api/integrations/v1",
    serverRequire("./routes/storefrontIntegration.routes"),
  );
  server = await new Promise((resolve) => {
    const handle = app.listen(0, "127.0.0.1", () => resolve(handle));
  });
  process.env.DRINKSHARBOUR_API_URL = `http://127.0.0.1:${server.address().port}/api/integrations/v1`;
  process.env.DRINKSHARBOUR_API_KEY = issuing.secret;
  cookieJar.set(
    "wyn_customer",
    sealSession(
      {
        token: session.token,
        refreshToken: session.refreshToken,
        tenantId: String(tenantId),
      },
      secret,
    ),
  );
  payload = {
    items: [
      { subProductId: String(subproduct), sizeId: String(size), quantity: 1 },
    ],
    shippingMethod: "pickup",
    ageVerified: true,
    customer: {
      firstName: "Pilot",
      lastName: "Buyer",
      email: "buyer0@pilot.invalid",
      phone: "08000000000",
    },
    attempt: "b8e187f7-591c-4569-bdef-118ad04a6c8c",
  };
}, 30000);
afterAll(async () => {
  if (!enabled) return;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  vi.restoreAllMocks();
  cookieJar.clear();
  writtenCookies.length = 0;
  for (const key of Object.keys(process.env))
    if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
});
