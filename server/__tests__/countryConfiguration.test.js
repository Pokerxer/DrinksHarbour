"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
let country;
try {
  country = require("../services/country");
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") throw e;
}
const fixture = () => ({
  code: "GB",
  name: "United Kingdom",
  currency: "GBP",
  locale: "en-GB",
  timezones: ["Europe/London"],
  capabilities: { marketplace: true, storefront: true, erm: true },
});
test("country validation rejects invented ISO codes and invalid currency locale or timezone", () => {
  assert.equal(
    typeof country?.normalizeConfiguration,
    "function",
    "country normalization must exist",
  );
  for (const fields of [
    { code: "ZZ" },
    { code: "UK" },
    { currency: "ZZZ" },
    { locale: "en-US" },
    { locale: "xx-GB" },
    { timezones: ["Invented/Zone"] },
    { timezones: ["+01:00"] },
    { capabilities: { marketplace: "true" } },
  ]) {
    assert.throws(
      () => country.normalizeConfiguration({ ...fixture(), ...fields }),
      (e) => e.statusCode === 400,
    );
  }
  const normalized = country.normalizeConfiguration({
    ...fixture(),
    code: "gb",
  });
  assert.equal(normalized.code, "GB");
  assert.equal(normalized.locale, "en-GB");
});
test("country public DTO never contains private readiness actor history or arbitrary fields", () => {
  assert.equal(
    typeof country?.publicCountry,
    "function",
    "public country projection must exist",
  );
  const dto = country.publicCountry({
    ...fixture(),
    active: true,
    version: 3,
    readiness: { legal: { evidence: "SECRET" } },
    revisions: ["SECRET"],
    password: "SECRET",
    capabilities: { marketplace: true, credential: "SECRET" },
  });
  assert.equal(dto.code, "GB");
  assert.equal(dto.version, 3);
  assert.equal(JSON.stringify(dto).includes("SECRET"), false);
  assert.deepEqual(Object.keys(dto.capabilities).sort(), [
    "erm",
    "marketplace",
    "storefront",
  ]);
});
test("activation requires every independently reviewed prerequisite and cannot accept booleans", () => {
  assert.equal(
    typeof country?.assertReadiness,
    "function",
    "readiness guard must exist",
  );
  assert.throws(
    () => country.assertReadiness({ ...fixture(), readiness: { legal: true } }),
    (e) => e.code === "COUNTRY_NOT_READY",
  );
  const readiness = Object.fromEntries(
    ["legal", "payments", "fulfillment", "operations", "merchantPolicy"].map(
      (key) => [
        key,
        {
          evidence: "synthetic-reference",
          reviewedBy: "507f1f77bcf86cd799439011",
          reviewedAt: new Date(),
        },
      ],
    ),
  );
  assert.doesNotThrow(() =>
    country.assertReadiness({ ...fixture(), readiness }),
  );
  delete readiness.payments;
  assert.throws(
    () => country.assertReadiness({ readiness }),
    (e) => e.code === "COUNTRY_NOT_READY",
  );
});
