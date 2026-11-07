"use strict";
const Child = require("../../../models/MerchantOrder"),
  Order = require("../../../models/Order"),
  Contract = require("../../../models/MerchantLocalDispatchContract"),
  Quote = require("../../../models/MerchantDispatchQuote");
const access = require("../../merchantFulfillment/access"),
  { hash } = require("../scope"),
  { ConflictError, ValidationError } = require("../../../utils/errors");
const sid = (v) => String(v?._id || v || "");
function enabled() {
  if (process.env.MERCHANT_LOCAL_DISPATCH_ENABLED !== "true")
    throw new ConflictError("Local dispatch creation is disabled");
}
function linesInput(input) {
  if (
    !Array.isArray(input?.lines) ||
    !input.lines.length ||
    input.lines.length > 100
  )
    throw new ValidationError("Own line quantities required");
  const rows = input.lines
    .map((row) => {
      if (
        !row ||
        Object.keys(row).some((k) => !["line", "quantity"].includes(k)) ||
        !/^[a-f0-9]{24}$/i.test(row.line) ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1
      )
        throw new ValidationError(
          "Canonical line and positive quantity required",
        );
      return { line: row.line.toLowerCase(), quantity: row.quantity };
    })
    .sort((a, b) => a.line.localeCompare(b.line));
  if (new Set(rows.map((r) => r.line)).size !== rows.length)
    throw new ValidationError("Repeated dispatch line unsupported");
  return rows;
}
async function requirements(child, selected, session) {
  let units = 0,
    weightGrams = 0,
    alcohol = false,
    fragile = false,
    ageVerification = false;
  const evidence = [];
  for (const selectedLine of selected) {
    const line = child.lines.find((row) => sid(row.line) === selectedLine.line),
      progress = child.quantityProgress?.find(
        (row) => sid(row.line) === selectedLine.line,
      );
    if (!line || selectedLine.quantity > line.quantity)
      throw new ConflictError(
        "Dispatch line ownership or quantity unavailable",
      );
    if (
      progress &&
      selectedLine.quantity >
        line.quantity - (progress.shipped || 0) - (progress.cancelled || 0)
    )
      throw new ConflictError(
        "Selected dispatch quantities are no longer available",
      );
    const product = await require("../../../models/Product")
      .findOne({ _id: line.product })
      .session(session || null)
      .lean();
    const sub = await require("../../../models/SubProduct")
      .findOne({
        _id: line.subproduct,
        tenant: child.tenant,
        product: line.product,
      })
      .session(session || null)
      .lean();
    const size = await require("../../../models/Size")
      .findOne({
        _id: line.size,
        tenant: child.tenant,
        subproduct: line.subproduct,
      })
      .session(session || null)
      .lean();
    if (
      ["fragile", "hazmat", "requiresAgeVerification"].some(
        (k) => typeof sub?.shipping?.[k] !== "boolean",
      )
    )
      throw new ConflictError(
        "Unknown shipping hazard/age/fragile requirements require review",
      );
    if (
      typeof product?.isAlcoholic !== "boolean" ||
      !sub ||
      !size ||
      !Number.isSafeInteger(size.shippingWeight) ||
      size.shippingWeight < 1 ||
      typeof size.packaging?.type !== "string" ||
      !size.packaging.type ||
      typeof size.packaging?.material !== "string" ||
      !size.packaging.material.trim()
    )
      throw new ConflictError(
        "Unknown alcohol, packaging or shipping weight requires review",
      );
    if (
      sub.shipping?.hazmat ||
      ["food", "prepared_food", "restaurant"].includes(product.type)
    )
      throw new ConflictError(
        "Hazmat or prepared food dispatch is unsupported",
      );
    evidence.push([
      selectedLine,
      product.isAlcoholic,
      product.type,
      sub.shipping,
      size.shippingWeight,
      size.packaging,
    ]);
    units += selectedLine.quantity;
    weightGrams += size.shippingWeight * selectedLine.quantity;
    alcohol = alcohol || product.isAlcoholic;
    ageVerification =
      ageVerification ||
      product.isAlcoholic ||
      !!sub.shipping?.requiresAgeVerification;
    fragile =
      fragile ||
      !!sub.shipping?.fragile ||
      size.packaging.type === "glass_bottle" ||
      /glass/i.test(size.packaging.material);
  }
  if (!Number.isSafeInteger(weightGrams) || !Number.isSafeInteger(units))
    throw new ConflictError("Dispatch weight exceeds supported bounds");
  return {
    units,
    weightGrams,
    alcohol,
    ageVerification,
    fragile,
    evidenceHash: hash(evidence),
  };
}
async function scope(childId, selected, actor, session) {
  const child = access.assertOwned(
    await Child.findOne({ _id: childId, ...access.scope(actor, true) })
      .session(session || null)
      .lean(),
    actor,
    true,
  );
  const parent = await Order.findOne({
    _id: child.order,
    merchantFulfillmentVersion: 2,
    settlementOwner: "platform",
    currency: "NGN",
    paymentStatus: { $in: ["paid", "partially_refunded"] },
  })
    .session(session || null)
    .lean();
  if (
    !parent?.user ||
    parent.integrationCheckout ||
    parent.source === "pos" ||
    parent.venueIdentityVersion === 1 ||
    parent.tableServiceBooking ||
    !["standard", "express", "partner_delivery"].includes(
      parent.shippingMethod,
    ) ||
    child.currency !== "NGN"
  )
    throw new ConflictError(
      "Paid version2 marketplace local dispatch authority required",
    );
  if (!["accepted", "picking", "partially_shipped"].includes(child.state))
    throw new ConflictError(
      "Accepted merchant quantities required for dispatch",
    );
  if (child.fulfillmentVersion !== 2)
    throw new ConflictError("Version2 quantity responsibility required");
  const warehouse = await require("../../../models/Warehouse")
    .findOne({ _id: child.location, tenant: child.tenant, isActive: true })
    .session(session || null)
    .lean();
  if (!warehouse)
    throw new ConflictError("Dispatch origin ownership unavailable");
  const req = await requirements(child, selected, session);
  const snapshot = {
    merchantOrder: childId,
    order: child.order,
    tenant: child.tenant,
    location: child.location,
    customer: parent.user,
    currency: "NGN",
    lines: selected,
    expectedVersion: child.version,
    requirements: req,
    basketHash: hash(child.lines),
    destinationHash: hash(parent.shippingAddress || {}),
    shippingMinor: child.shippingMinor,
    quantityHash: hash(child.quantityProgress || []),
  };
  return { child, parent, snapshot, baseHash: hash(snapshot) };
}
function coverage(contract, address, req) {
  const point = address?.coordinates;
  if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude))
    throw new ConflictError(
      "Exact destination coordinates required for coverage",
    );
  const rule = contract.coverage.findIndex(
    (r) =>
      r.country === address.country &&
      r.state === address.state &&
      r.city === address.city &&
      point.latitude >= r.minLat &&
      point.latitude <= r.maxLat &&
      point.longitude >= r.minLon &&
      point.longitude <= r.maxLon,
  );
  if (rule < 0)
    throw new ConflictError(
      "Destination outside reviewed local dispatch coverage",
    );
  if (
    req.units > contract.maxUnits ||
    req.weightGrams > contract.maxWeightGrams ||
    ["alcohol", "ageVerification", "fragile"].some(
      (k) => req[k] && !contract.capabilities[k],
    )
  )
    throw new ConflictError(
      "Reviewed dispatch capability does not cover basket (alcohol/age/fragile/weight)",
    );
  return rule;
}
async function quoteDispatch(childId, input, actor) {
  enabled();
  const selected = linesInput(input),
    loaded = await scope(childId, selected, actor);
  const contract = await Contract.findOne({
    tenant: loaded.child.tenant,
    location: loaded.child.location,
  })
    .sort({ version: -1 })
    .lean();
  if (
    !contract ||
    contract.status !== "reviewed" ||
    contract.validUntil <= new Date()
  )
    throw new ConflictError("Current reviewed dispatch contract required");
  const rule = coverage(
    contract,
    loaded.parent.shippingAddress,
    loaded.snapshot.requirements,
  );
  const budget = await require("../../../models/MerchantDispatchBudget")
    .findById(childId)
    .lean();
  if (
    contract.amountMinor >
    loaded.child.shippingMinor -
      (budget?.reservedMinor || 0) -
      (budget?.committedMinor || 0)
  )
    throw new ConflictError(
      "Reviewed charge exceeds remaining accepted shipping allocation",
    );
  await access.audit(loaded.child, actor, "LOCAL_DISPATCH_QUOTE_CREATED");
  return (
    await Quote.create({
      ...loaded.snapshot,
      contract: contract._id,
      contractVersion: contract.version,
      coverageRule: rule,
      amountMinor: contract.amountMinor,
      scopeHash: hash([
        loaded.baseHash,
        contract._id,
        contract.amountMinor,
        rule,
      ]),
      expiresAt: new Date(
        Math.min(Date.now() + 900000, contract.validUntil.getTime()),
      ),
      createdBy: actor._id,
    })
  ).toObject();
}
module.exports = {
  requirements,
  quoteDispatch,
  scope,
  linesInput,
  coverage,
  enabled,
  hash,
  sid,
};
