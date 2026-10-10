function pricePreview(items, ceiling = 10, marginFloor = 20, canPrice = true) {
  const manual = (reason) => ({
    offerPrice: null,
    discountPercent: null,
    reason,
  });
  if (!canPrice) return manual("Pricing review requires owner/admin access.");
  if (
    !items.length ||
    items.some(
      (p) =>
        !Number.isFinite(p.price) ||
        p.price <= 0 ||
        !Number.isFinite(p.cost) ||
        p.cost <= 0,
    )
  )
    return manual("Current prices and costs are required.");
  if (
    new Set(items.map((p) => p.currency)).size !== 1 ||
    !["NGN", "USD", "GBP", "EUR", "CAD", "AUD", "ZAR", "GHS"].includes(
      items[0].currency,
    )
  )
    return manual("Review currency before pricing this offer.");
  if (items.some((p) => p.conflict))
    return manual(
      "An existing promotion or size discount overlaps; review stacking.",
    );
  const regularPrice = items.reduce((n, p) => n + p.price, 0),
    cost = items.reduce((n, p) => n + p.cost, 0);
  const minimum = cost / (1 - marginFloor / 100);
  const offerPrice =
    Math.ceil(
      Math.max(minimum, regularPrice * (1 - ceiling / 100)) * 100 - 1e-8,
    ) / 100;
  if (offerPrice >= regularPrice)
    return manual("The current margin does not support a discount.");
  return {
    regularPrice,
    offerPrice,
    currency: items[0].currency,
    discountPercent:
      Math.floor((1 - offerPrice / regularPrice) * 10000 + 1e-8) / 100,
    marginPercent: Math.floor((1 - cost / offerPrice) * 10000 + 1e-8) / 100,
    reason: "",
  };
}
module.exports = { pricePreview };
