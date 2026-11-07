'use strict';
const POUR_ML = { toast: 125, wine: 150, spirits: 25, 'alcohol-free': 250, mixers: 250 };
function validProfile(profile, request) {
  return profile && Number.isFinite(profile.durationHours) && profile.durationHours >= 1 && profile.durationHours <= 24 && Number.isSafeInteger(profile.adultDrinkers) && profile.adultDrinkers >= 0 && profile.adultDrinkers <= request.guests && Number.isFinite(profile.alcoholPortionsPerDrinker) && profile.alcoholPortionsPerDrinker >= 0 && profile.alcoholPortionsPerDrinker <= 4 && Number.isFinite(profile.softPortionsPerGuest) && profile.softPortionsPerGuest >= 0 && profile.softPortionsPerGuest <= 12 && Number.isFinite(profile.waterLitresPerGuest) && profile.waterLitresPerGuest >= 0 && profile.waterLitresPerGuest <= 10;
}
function planningTargets(profile, request) {
  if (!validProfile(profile, request)) return null;
  const shared = Math.ceil(profile.adultDrinkers * profile.alcoholPortionsPerDrinker);
  const toast = request.categories.includes('toast') ? Math.min(profile.adultDrinkers, shared) : 0;
  const choices = ['wine', 'beer', 'spirits'].filter(category => request.categories.includes(category));
  const targets = { toast, wine: 0, beer: 0, spirits: 0, 'alcohol-free': Math.ceil(request.guests * profile.softPortionsPerGuest), water: request.guests * profile.waterLitresPerGuest, mixers: 0 };
  choices.forEach((category, index) => { targets[category] = Math.floor((shared - toast) / choices.length) + (index < (shared - toast) % choices.length ? 1 : 0); });
  targets.mixers = Math.ceil(targets.spirits * 100 / 250);
  return targets;
}
const servingGroup = item => item.servingCategory === 'ready-to-drink' ? 'spirits' : item.category;
function unitCapacity(item) {
  const volume = volumeInMl(item.size, item.volumeMl);
  if (!volume) return 0;
  if (item.servingCategory === 'ready-to-drink' || item.category === 'beer') return 1;
  if (item.category === 'water') return volume / 1000;
  return POUR_ML[item.category] ? volume / POUR_ML[item.category] : 0;
}
function quantityWithinPlan(offer, items, request, profile) {
  const targets = planningTargets(profile, request);
  if (!targets) return offer.maxQuantity;
  const group = servingGroup(offer), unit = unitCapacity(offer), target = targets[group];
  if (!unit || target === undefined) return 0;
  const supplied = items.filter(item => servingGroup(item) === group).reduce((sum, item) => sum + unitCapacity(item) * item.quantity, 0);
  return Math.max(0, Math.ceil((target - supplied) / unit - 1e-8));
}
function volumeInMl(label, explicit) {
  const text = String(label || '').trim();
  if (/case|pack|\d\s*[x×]|\bbottles\b/i.test(text)) return null;
  if (Number.isFinite(explicit) && explicit > 0 && explicit <= 100000) return explicit;
  const match = text.match(/^(?:(?:can|bottle|pet)[-\s]?)?(\d+(?:\.\d+)?)\s*(ml|cl|l)$/i);
  return match ? Number(match[1]) * { ml: 1, cl: 10, l: 1000 }[match[2].toLowerCase()] : null;
}
function assessOccasionPlan(items, request, profile) {
  const portions = { toast: 0, wine: 0, beer: 0, spirits: 0, 'ready-to-drink': 0, 'alcohol-free': 0, mixers: 0 };
  let waterMl = 0, unknownVolumes = 0;
  for (const item of items) {
    const volume = volumeInMl(item.size, item.volumeMl);
    if (!volume) { unknownVolumes++; continue; }
    if (item.servingCategory === 'ready-to-drink') portions['ready-to-drink'] += item.quantity;
    else if (item.category === 'water') waterMl += volume * item.quantity;
    else if (item.category === 'beer') portions.beer += item.quantity;
    else if (POUR_ML[item.category]) portions[item.category] += Math.floor(volume * item.quantity / POUR_ML[item.category]);
  }
  const cents = items.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0), budget = Math.round(request.budget * 100);
  const knownPortions = Object.values(portions).reduce((sum, count) => sum + count, 0) + Math.floor(waterMl / 250);
  const targets = planningTargets(profile, request), hasProfile = !!targets;
  const alcoholTarget = targets ? targets.toast + targets.wine + targets.beer + targets.spirits : null;
  const alcoholicPortions = portions.toast + portions.wine + portions.beer + portions.spirits + portions['ready-to-drink'];
  const supplied = { ...portions, spirits: portions.spirits + portions['ready-to-drink'], water: waterMl / 1000 };
  const shortages = targets ? Object.fromEntries(Object.entries(targets).map(([category, target]) => [category, Math.max(0, Math.round((target - (supplied[category] || 0)) * 100) / 100)]).filter(([, gap]) => gap > 0)) : {};
  return {
    budget: { spent: cents / 100, remaining: (budget - cents) / 100, usedPercent: Math.round(cents / budget * 10000) / 100, status: cents >= budget * 0.98 ? 'allocated' : 'underallocated' },
    coverage: { portions, waterLitres: waterMl / 1000, unknownVolumes, requiresConfirmation: true, obviousShortfall: knownPortions < request.guests, alcoholTarget, shortages, targets, possibleOverstock: alcoholTarget !== null && alcoholicPortions > alcoholTarget * 1.25, ...(hasProfile ? { profile: { durationHours: profile.durationHours, adultDrinkers: profile.adultDrinkers, alcoholPortionsPerDrinker: profile.alcoholPortionsPerDrinker, softPortionsPerGuest: profile.softPortionsPerGuest, waterLitresPerGuest: profile.waterLitresPerGuest }, softTarget: targets['alcohol-free'], waterTargetLitres: targets.water } : {}) },
    missingCategories: request.categories.filter(category => !items.some(item => item.category === category || category === 'alcohol-free' && ['water', 'mixers'].includes(item.category))),
  };
}
function capacitySummary(assessment) {
  const labels = { toast: 'Toast (125ml pours)', wine: 'Wine (150ml pours)', beer: 'Beer (sealed containers)', spirits: 'Spirits (25ml measures)', 'ready-to-drink': 'Ready-to-drink cocktails (sealed containers)', 'alcohol-free': 'Soft drinks/juice (250ml portions)', mixers: 'Mixers (250ml portions)' };
  return Object.entries(assessment.coverage.portions).filter(([, count]) => count > 0).map(([category, count]) => `- ${labels[category]}: ${count.toLocaleString('en-NG')}`).concat(`- Water: ${assessment.coverage.waterLitres.toLocaleString('en-NG')} litres${assessment.coverage.waterLitres ? '' : ' — needs confirmation'}`).join('\n');
}
module.exports = { volumeInMl, assessOccasionPlan, capacitySummary, planningTargets, quantityWithinPlan, servingGroup };
