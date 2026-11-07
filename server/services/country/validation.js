"use strict";
const { AppError } = require("../../utils/errors");
// ISO 3166-1 alpha-2. UK is a routing alias, not an ISO code: use GB.
const CODES = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  ),
);
const CAPABILITIES = ["marketplace", "storefront", "erm"];
const READINESS = [
  "legal",
  "payments",
  "fulfillment",
  "operations",
  "merchantPolicy",
];
function error(message, statusCode = 400, code = "COUNTRY_INVALID") {
  return Object.assign(new AppError(message, statusCode), { code });
}
function normalizeCode(code) {
  if (typeof code !== "string" || !CODES.has(code.toUpperCase()))
    throw error("A valid ISO 3166-1 alpha-2 country code is required");
  return code.toUpperCase();
}
function normalizeConfiguration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw error("Country configuration is required");
  const code = normalizeCode(input.code);
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100
  )
    throw error("Country name is required (maximum 100 characters)");
  const currency =
    typeof input.currency === "string" ? input.currency.toUpperCase() : "";
  if (!Intl.supportedValuesOf("currency").includes(currency))
    throw error("A supported ISO 4217 currency is required");
  let locale;
  try {
    locale = new Intl.Locale(input.locale);
    if (
      locale.region !== code ||
      Intl.DateTimeFormat.supportedLocalesOf([locale.toString()]).length !== 1
    )
      throw new Error();
  } catch {
    throw error(
      "A supported locale with the configured country region is required",
    );
  }
  if (
    !Array.isArray(input.timezones) ||
    !input.timezones.length ||
    input.timezones.length > 50
  )
    throw error("At least one IANA timezone is required");
  const timezones = [
    ...new Set(
      input.timezones.map((zone) => {
        if (typeof zone !== "string") throw error("Invalid timezone");
        try {
          const canonical = new Intl.DateTimeFormat("en", {
            timeZone: zone,
          }).resolvedOptions().timeZone;
          if (canonical !== "UTC" && !Intl.supportedValuesOf("timeZone").includes(canonical)) throw new Error();
          return canonical;
        } catch {
          throw error("Invalid IANA timezone");
        }
      }),
    ),
  ];
  const capabilities = {};
  for (const key of CAPABILITIES) {
    const value = input.capabilities?.[key];
    if (value !== undefined && typeof value !== "boolean")
      throw error(`Capability ${key} must be a boolean`);
    capabilities[key] = value ?? false;
  }
  return {
    code,
    name: input.name.trim(),
    currency,
    locale: locale.toString(),
    timezones,
    capabilities,
  };
}
function publicCountry(config) {
  return {
    code: config.code,
    name: config.name,
    version: config.version,
    active: config.active,
    currency: config.currency,
    locale: config.locale,
    timezones: [...config.timezones],
    capabilities: Object.fromEntries(
      CAPABILITIES.map((key) => [key, config.capabilities?.[key] === true]),
    ),
  };
}
function assertReadiness(config) {
  const missing = READINESS.filter((key) => {
    const review = config.readiness?.[key];
    return (
      !review ||
      typeof review.evidence !== "string" ||
      review.evidence.trim().length < 5 ||
      !review.reviewedBy ||
      !review.reviewedAt ||
      !Number.isFinite(new Date(review.reviewedAt).getTime())
    );
  });
  if (missing.length)
    throw error(
      `Country readiness reviews required: ${missing.join(", ")}`,
      409,
      "COUNTRY_NOT_READY",
    );
}
module.exports = {
  CAPABILITIES,
  READINESS,
  error,
  normalizeCode,
  normalizeConfiguration,
  publicCountry,
  assertReadiness,
};
