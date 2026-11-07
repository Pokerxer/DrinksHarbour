'use strict';
const { volumeInMl, planningTargets } = require('./occasionPlanAssessment');

// Budget allocation may change brands, never the amount of beverage supplied.
// The source and replacement must have identical category, service type and volume.
function upgradeOccasionBudget(items, offers, request, profile) {
  if (!planningTargets(profile, request)) return items;
  const pinned = new Set((request.selections || []).map(item => item.productId));
  const result = items.map(item => ({ ...item }));
  const budget = Math.round(request.budget * 100);
  let spent = result.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0);
  const capacityKey = item => {
    const volume = volumeInMl(item.size, item.volumeMl);
    return volume ? `${item.category}:${item.servingCategory || item.category}:${volume}` : null;
  };
  for (let step = 0; step < 512 && spent < budget * 0.98; step++) {
    let best;
    for (const source of result) {
      if (pinned.has(source.productId)) continue;
      const key = capacityKey(source);
      if (!key) continue;
      for (const offer of offers) {
        if (pinned.has(offer.productId) || capacityKey(offer) !== key) continue;
        const delta = offer.unitCents - Math.round(source.unitPrice * 100);
        if (delta <= 0) continue;
        const destination = result.find(item => item.productId === offer.productId);
        const quantity = Math.min(source.quantity, offer.maxQuantity - (destination?.quantity || 0), Math.floor((budget - spent) / delta));
        if (quantity < 1 || (!destination && result.length >= 20 && quantity < source.quantity)) continue;
        const gain = delta * quantity;
        if (!best || gain > best.gain) best = { source, offer, destination, quantity, gain };
      }
    }
    if (!best) break;
    const { source, offer, destination, quantity, gain } = best;
    source.quantity -= quantity;
    source.lineTotal = source.quantity * Math.round(source.unitPrice * 100) / 100;
    if (!source.quantity) result.splice(result.indexOf(source), 1);
    if (destination) {
      destination.quantity += quantity;
      destination.lineTotal = destination.quantity * offer.unitCents / 100;
    } else {
      result.push({ productId: offer.productId, name: offer.name, slug: offer.slug, size: offer.size, category: offer.category, servingCategory: offer.servingCategory, volumeMl: offer.volumeMl, quantity, unitPrice: offer.unitCents / 100, lineTotal: quantity * offer.unitCents / 100 });
    }
    spent += gain;
  }
  return result;
}
module.exports = { upgradeOccasionBudget };
