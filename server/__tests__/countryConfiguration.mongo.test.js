"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  express = require("express"),
  jwt = require("jsonwebtoken");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "country configuration durable HTTP authority readiness versioning and legacy boundaries",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "country_config");
    const Country = require("../models/CountryConfiguration"),
      country = require("../services/country");
    await Country.init();
    await Country.createIndexes();
    const previousFlag = process.env.MARKET_FOUNDATIONS_ENABLED,
      previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "country-test-secret-only";
    delete process.env.MARKET_FOUNDATIONS_ENABLED;
    t.after(() => {
      if (previousFlag === undefined)
        delete process.env.MARKET_FOUNDATIONS_ENABLED;
      else process.env.MARKET_FOUNDATIONS_ENABLED = previousFlag;
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const User = require("../models/User"),
      admin = new mongoose.Types.ObjectId(),
      tenantAdmin = new mongoose.Types.ObjectId();
    await User.collection.insertMany([
      { _id: admin, role: "super_admin", status: "active" },
      {
        _id: tenantAdmin,
        role: "tenant_admin",
        status: "active",
        tenant: new mongoose.Types.ObjectId(),
      },
    ]);
    const app = express();
    app.use(express.json());
    app.use("/countries", require("../routes/country.routes"));
    app.use((err, req, res, next) =>
      res
        .status(err.statusCode || 500)
        .json({ message: err.message, code: err.code }),
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (path, method = "GET", body, actor) => {
      const res = await fetch(
        `http://127.0.0.1:${server.address().port}/countries${path}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(actor
              ? {
                  Authorization: `Bearer ${jwt.sign({ userId: String(actor) }, process.env.JWT_SECRET)}`,
                }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return {
        status: res.status,
        cache: res.headers.get("cache-control"),
        body: await res.json(),
      };
    };
    await t.test("malformed country commands return validation errors without writes", async () => {
      for (const [path, method] of [["/admin", "POST"], ["/admin/GB", "PUT"], ["/admin/GB/review", "POST"], ["/admin/GB/activation", "POST"]]) {
        assert.equal((await call(path, method, undefined, admin)).status, 400);
      }
      assert.equal(await Country.countDocuments(), 0);
    });
    const input = {
      code: "GB",
      name: "United Kingdom",
      currency: "GBP",
      locale: "en-GB",
      timezones: ["Europe/London"],
      capabilities: { marketplace: true, storefront: true, erm: true },
      reason: "Synthetic test configuration",
    };
    let config;
    await t.test(
      "legacy NG is available only disabled; unknown enabled country denied without mutation",
      async () => {
        assert.equal((await country.resolveCountry()).version, 0);
        process.env.MARKET_FOUNDATIONS_ENABLED = "true";
        await assert.rejects(
          country.resolveCountry(),
          (e) => e.code === "COUNTRY_UNKNOWN",
        );
        assert.equal(await Country.countDocuments(), 0);
        delete process.env.MARKET_FOUNDATIONS_ENABLED;
      },
    );
    await t.test(
      "anonymous and tenant-admin cannot read private configuration or mutate",
      async () => {
        assert.equal((await call("/admin")).status, 401);
        assert.equal(
          (await call("/admin", "GET", null, tenantAdmin)).status,
          403,
        );
        assert.equal(
          (await call("/admin", "POST", input, tenantAdmin)).status,
          403,
        );
        assert.equal(await Country.countDocuments(), 0);
      },
    );
    await t.test(
      "create ignores supplied activation/readiness and rejects duplicate countries",
      async () => {
        const res = await call(
          "/admin",
          "POST",
          { ...input, active: true, readiness: { legal: true } },
          admin,
        );
        assert.equal(res.status, 201, JSON.stringify(res.body));
        config = res.body.data;
        assert.equal(config.active, false);
        assert.equal(config.version, 1);
        assert.equal(config.revisions.length, 1);
        assert.equal((await call("/GB")).status, 403);
        assert.equal((await call("/admin", "POST", input, admin)).status, 409);
      },
    );
    await t.test(
      "activation requires all evidence and reviews stamp authenticated actor/time",
      async () => {
        assert.equal(
          (
            await call(
              "/admin/GB/activation",
              "POST",
              {
                expectedVersion: config.version,
                active: true,
                reason: input.reason,
              },
              admin,
            )
          ).status,
          409,
        );
        for (const prerequisite of country.READINESS) {
          const res = await call(
            "/admin/GB/review",
            "POST",
            {
              expectedVersion: config.version,
              prerequisite,
              evidence: `SYNTHETIC-${prerequisite}`,
              reason: input.reason,
              reviewedBy: String(tenantAdmin),
              reviewedAt: "2000-01-01",
            },
            admin,
          );
          assert.equal(res.status, 200, JSON.stringify(res.body));
          config = res.body.data;
          assert.equal(
            config.readiness[prerequisite].reviewedBy,
            String(admin),
          );
          assert.notEqual(
            config.readiness[prerequisite].reviewedAt,
            "2000-01-01T00:00:00.000Z",
          );
        }
        const res = await call(
          "/admin/GB/activation",
          "POST",
          {
            expectedVersion: config.version,
            active: true,
            reason: input.reason,
          },
          admin,
        );
        assert.equal(res.status, 200, JSON.stringify(res.body));
        config = res.body.data;
        assert.equal(config.active, true);
        const publicRes = await call("/GB");
        assert.equal(publicRes.status, 200);
        assert.equal(
          JSON.stringify(publicRes.body).includes("SYNTHETIC"),
          false,
        );
        assert.equal(publicRes.body.data.revisions, undefined);
      },
    );
    await t.test(
      "parallel expected-version edits write once; configuration edit invalidates readiness",
      async () => {
        const responses = await Promise.all(
          [1, 2].map((n) =>
            call(
              "/admin/GB",
              "PUT",
              {
                ...input,
                name: `Country ${n}`,
                expectedVersion: config.version,
              },
              admin,
            ),
          ),
        );
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        const current = await Country.findOne({ code: "GB" }).lean();
        assert.equal(current.version, config.version + 1);
        assert.equal(current.active, false);
        assert.deepEqual(current.readiness || {}, {});
        assert.equal(current.revisions.length, current.version);
        assert.equal(current.revisions.at(-2).snapshot.active, true);
        assert.equal((await call("/GB")).status, 403);
        const privateRes = await call("/admin", "GET", null, admin);
        assert.equal(privateRes.cache, "private, no-store");
      },
    );
  },
);
