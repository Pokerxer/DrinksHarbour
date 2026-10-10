const { affinity } = require("./affinity");
const { pricePreview } = require("./pricing");
const { occasions } = require("./occasions");
const { matchesEvent } = require("./drink-events");
function planSuggestions({
  variants,
  baskets,
  days,
  now,
  canPrice,
  maxDiscount = 10,
  marginFloor = 20,
  eventName,
  eventDate,
}) {
  const events = occasions(now, { eventName, eventDate });
  const suggestions = [],
    pairs = affinity(baskets);
  const safe = (p) =>
    Number.isFinite(p.available) &&
    Number.isFinite(p.protected) &&
    Math.floor(p.available - p.protected) >= 1 &&
    !p.incomplete &&
    !p.critical;
  const publicProduct = (p) => ({
    key: p.key,
    subProductId: p.subProductId,
    sizeId: p.sizeId,
    productName: p.productName,
    sizeName: p.sizeName,
    sku: p.sku,
    image: p.image,
    units: p.units,
    available: p.available,
    quantity: 1,
  });
  for (const pair of pairs) {
    const first = variants.filter(
      (p) => p.variantKey === pair.keys[0] || p.key === pair.keys[0],
    );
    for (const a of first) {
      const b = variants.find(
        (p) =>
          (p.variantKey === pair.keys[1] || p.key === pair.keys[1]) &&
          p.warehouseId === a.warehouseId,
      );
      if (!b || !safe(a) || !safe(b) || a.currency !== b.currency) continue;
      const items = [a, b],
        capacity = Math.floor(
          Math.min(...items.map((p) => p.available - p.protected)),
        );
      if (capacity < 1) continue;
      const excess = Math.max(
        ...items.map((p) =>
          p.units > 0
            ? Math.min(
                1,
                Math.max(0, (p.available / (p.units / days) - 30) / 90),
              )
            : 1,
        ),
      );
      suggestions.push({
        key: `combo:${a.key}:${b.key}`,
        type: "combo",
        title: `${a.productName} + ${b.productName}`,
        products: items.map(publicProduct),
        warehouseId: a.warehouseId,
        warehouseName: a.warehouseName,
        confidence: pair.confidence,
        evidence: pair,
        capacity,
        score: pair.jointBaskets * Math.min(3, pair.lift) * (1 + excess),
        reasoning:
          "Customers bought these variants together more often than their individual popularity would suggest. Review the offer before changing prices.",
        pricing: pricePreview(items, maxDiscount, marginFloor, canPrice),
        occasion: null,
      });
    }
  }
  for (const p of variants.filter(safe)) {
    const cover = p.units > 0 ? p.available / (p.units / days) : null;
    const chosen = events.find(
      (e) => e.name === eventName && e.date === eventDate,
    );
    const event = chosen
      ? matchesEvent(chosen, p)
        ? chosen
        : null
      : events.find((e) => matchesEvent(e, p));
    if (
      cover !== null &&
      cover < (event ? Math.max(30, event.daysAway + 7) : 60)
    )
      continue;
    const type = event ? "occasion" : "slow_mover";
    suggestions.push({
      key: `${type}:${p.key}`,
      type,
      title: event
        ? `${event.name}: ${p.productName}`
        : `Review an offer for ${p.productName}`,
      products: [publicProduct(p)],
      warehouseId: p.warehouseId,
      warehouseName: p.warehouseName,
      confidence: "review",
      evidence: null,
      capacity: Math.floor(p.available - p.protected),
      score: 0,
      reasoning:
        p.units > 0
          ? `Recorded sales imply approximately ${Math.ceil(cover)} days of stock. A small offer may help; no sales uplift is predicted.`
          : "No customer sales were recorded in the selected period. Review demand before choosing a discount.",
      pricing: pricePreview([p], maxDiscount, marginFloor, canPrice),
      occasion: event || null,
    });
  }
  suggestions.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return {
    suggestions: suggestions.slice(0, 500),
    truncated: suggestions.length > 500,
    occasions: events,
    model: "Local basket association rules (support, purchase rate and lift)",
    basketCount: new Set(baskets.map((b) => b.id)).size,
    canPrice,
  };
}
module.exports = { planSuggestions };
