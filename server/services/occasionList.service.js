'use strict';
const { parseGeneration } = require('../utils/occasionGeneration');
const { generationPrompt, generationFormat } = require('./weddingBeveragePrompt');
const { upgradeOccasionBudget } = require('../utils/occasionBudgetUpgrade');
const { volumeInMl, assessOccasionPlan, capacitySummary, planningTargets, quantityWithinPlan, servingGroup } = require('../utils/occasionPlanAssessment');
const labels = { toast: 'Champagne & sparkling wine', wine: 'Wine', beer: 'Beer', spirits: 'Spirits', 'alcohol-free': 'Non-alcoholic drinks' };
function matches(entry, category) {
  const text = `${entry.type} ${entry.subType} ${entry.category} ${entry.subCategory}`.toLowerCase();
  const sparkling = /champagne|sparkling|prosecco|cava/.test(text);
  if (category === 'water') return entry.abv === 0 && /\bwater\b/i.test(`${text} ${entry.name}`);
  if (category === 'mixers') return entry.abv === 0 && /tonic|soda|ginger ale|cola/i.test(`${text} ${entry.name}`);
  if (category === 'toast') return sparkling;
  if (category === 'wine') return /wine/.test(text) && !sparkling;
  if (category === 'beer') return /beer|lager|stout|cider/.test(text) && entry.abv !== 0;
  if (category === 'spirits') return /spirit|whisk|gin|vodka|rum|cognac|tequila|brandy|liqueur/.test(text);
  return entry.abv === 0 && /non.?alcohol|soft.?drink|juice|water|malt|soda|beer|wine/.test(text);
}
const money = cents => `₦${(cents / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
function offerFor(entry, category, budget) {
  if (!entry || !Number.isFinite(entry.totalStock) || entry.totalStock <= 0) return null;
  const size = (entry.sizes || []).filter(size => typeof size.label === 'string' && !/not specified|unknown/i.test(size.label) && Number.isFinite(size.price) && size.price > 0 && Number.isFinite(size.stock) && size.stock >= 1).sort((a, b) => a.price - b.price)[0];
  if (!size || Math.round(size.price * 100) < 1 || Math.round(size.price * 100) > budget) return null;
  const ready = /ready.?to.?drink|ready_to_drink|premix|\brtd\b/i.test(`${entry.name} ${entry.subType}`);
  return { productId: entry.id, name: entry.name, slug: entry.slug, image: entry.image, category: matches(entry, 'water') ? 'water' : category, servingCategory: ready ? 'ready-to-drink' : category, size: size.label, volumeMl: volumeInMl(size.label, size.volumeMl), unitCents: Math.round(size.price * 100), maxQuantity: Math.min(9999, Math.floor(size.stock)) };
}
function priceTiers(offers) {
  const sorted = offers.sort((a, b) => a.unitCents - b.unitCents);
  if (sorted.length <= 16) return sorted;
  return Array.from({ length: 16 }, (_, index) => sorted[Math.round(index * (sorted.length - 1) / 15)]);
}

async function generateOccasionList(input, { loadCatalog, callClaude }) {
  const parsed = parseGeneration(input.generation);
  if (parsed.error || !parsed.value) throw new Error(parsed.error || 'Choose preferences before generating a list.');
  const request = parsed.value, budget = Math.round(request.budget * 100);
  const wedding = input.occasion === 'weddings';
  let planning = {};
  const catalogueError = () => Object.assign(new Error('The catalogue is temporarily unavailable. Please try again.'), { code: 'OCCASION_CATALOGUE_UNAVAILABLE' });
  let catalogue;
  try { catalogue = await loadCatalog(input.tenantId); } catch { throw catalogueError(); }
  if (!catalogue || !Array.isArray(catalogue.entries)) throw catalogueError();
  const entries = catalogue.entries;
  const candidates = [], seen = new Set();
  let remaining = budget;
  const items = [], added = new Set(), adjustments = [];
  function append(offer, requested) {
    const existing = items.find(item => item.productId === offer.productId);
    const quantity = Math.min(requested, offer.maxQuantity - (existing?.quantity || 0), Math.floor(remaining / offer.unitCents));
    if (!quantity) return 0;
    const lineCents = quantity * offer.unitCents;
    if (existing) { existing.quantity += quantity; existing.lineTotal = Math.round(existing.lineTotal * 100 + lineCents) / 100; }
    else items.push({ productId: offer.productId, name: offer.name, slug: offer.slug, size: offer.size, category: offer.category, servingCategory: offer.servingCategory, volumeMl: offer.volumeMl, quantity, unitPrice: offer.unitCents / 100, lineTotal: lineCents / 100 });
    remaining -= lineCents; added.add(offer.productId); return quantity;
  }
  for (const selection of request.selections || []) {
    const entry = entries.find(entry => entry.id === selection.productId);
    const category = [...new Set([...request.categories, ...Object.keys(labels)])].find(category => entry && matches(entry, category)) || 'selected';
    const offer = offerFor(entry, category, budget);
    if (!offer) { adjustments.push('A selected catalogue product could not be included: its current offer is unavailable or exceeds the budget.'); continue; }
    candidates.push(offer); seen.add(offer.productId);
    const quantity = append(offer, selection.quantity);
    if (quantity < selection.quantity) adjustments.push(`${offer.name}: requested ${selection.quantity}; included ${quantity} because of current availability or the remaining budget.`);
  }
  const roles = [...new Set([...request.categories.filter(category => category !== 'alcohol-free'), ...(wedding ? ['water', ...(request.categories.includes('spirits') ? ['mixers'] : []), 'alcohol-free'] : request.categories.includes('alcohol-free') ? ['alcohol-free'] : [])])];
  for (const category of roles) {
    const eligible = entries.filter(entry => !seen.has(entry.id) && matches(entry, category)).map(entry => offerFor(entry, category, budget)).filter(Boolean);
    for (const offer of priceTiers(eligible)) {
      seen.add(offer.productId);
      candidates.push(offer);
    }
  }
  const additions = candidates.filter(offer => !added.has(offer.productId) && offer.unitCents <= remaining && (roles.includes(offer.category) || request.categories.includes('alcohol-free') && offer.category === 'water'));
  if (additions.length && items.length < 20) {
    const selected = [...items], reservedCents = budget - remaining;
    const system = generationPrompt({ request, selected, candidates: additions, remaining, wedding, occasion: input.occasion });
    async function propose(extra = '', fixedProfile) {
      const raw = await callClaude(input.query || 'Generate my occasion drinks plan.', `${system}${extra}`, input.conversationHistory || [], generationFormat);
      const text = String(raw || '').trim(), fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      let proposal;
      try { proposal = JSON.parse(fenced ? fenced[1] : text); if (!Array.isArray(proposal.items)) throw Error(); } catch { throw new Error('Could not generate your drinks list. Please try again.'); }
      if (fixedProfile) proposal.planningProfile = fixedProfile;
      items.splice(0, items.length, ...selected); remaining = budget - reservedCents; added.clear(); selected.forEach(item => added.add(item.productId));
      for (const line of proposal.items.slice(0, 20)) {
        const offer = additions.find(candidate => candidate.productId === line?.productId);
        if (!offer || added.has(offer.productId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1) continue;
        const allowance = wedding ? quantityWithinPlan(offer, items, request, proposal.planningProfile) : offer.maxQuantity;
        append(offer, Math.min(line.quantity, allowance)); if (items.length === 20) break;
      }
      if (wedding && planningTargets(proposal.planningProfile, request)) {
        for (const group of ['water', 'alcohol-free', 'toast', 'wine', 'beer', 'spirits', 'mixers']) {
          const options = additions.filter(offer => servingGroup(offer) === group).sort((a, b) => Number(!items.some(item => item.productId === a.productId)) - Number(!items.some(item => item.productId === b.productId)) || a.unitCents - b.unitCents);
          for (const offer of options) {
            if (items.length >= 20 && !items.some(item => item.productId === offer.productId)) continue;
            const required = quantityWithinPlan(offer, items, request, proposal.planningProfile);
            if (required) append(offer, required);
          }
        }
      }
      if (!items.length) throw new Error('Could not generate a valid drinks list from the catalogue. Please try again.');
      return proposal;
    }
    planning = await propose();
    const assessment = assessOccasionPlan(items, request, planning.planningProfile);
    const possible = additions.reduce((sum, offer) => Math.min(budget, sum + Math.min(budget, offer.unitCents * offer.maxQuantity)), reservedCents);
    const fixableGap = Object.keys(assessment.coverage.shortages).some(group => additions.some(offer => servingGroup(offer) === group));
    if (wedding && (possible > budget - remaining || assessment.coverage.possibleOverstock || fixableGap) && (assessment.budget.usedPercent < 98 || assessment.missingCategories.length || assessment.coverage.obviousShortfall || assessment.coverage.possibleOverstock || fixableGap)) {
      const original = [...items], originalPlanning = planning, originalRemaining = remaining;
      const score = value => (value.coverage.possibleOverstock ? -2000000 : 0) + (value.coverage.obviousShortfall ? 0 : 1000000) - Object.keys(value.coverage.shortages).length * 100000 - value.missingCategories.length * 10000 + value.budget.usedPercent * 100;
      try {
        const revised = await propose(`\nREVISION REQUIRED: The first draft is incomplete. Server assessment:${JSON.stringify(assessment)}. Previous proposed items:${JSON.stringify(original)}. Produce a full replacement for your additions. The server enforces the per-category service targets and rounds to whole bottles. Meet the toast and refreshment targets; respect the single shared alcoholic allocation. Use premium BRAND substitutions to spend the budget instead of raising quantities past the targets. Preserve the reserved customer choices and the existing guest/duration profile. Explain any remaining unallocated balance. One revision only.`, assessment.coverage.profile);
        if (score(assessOccasionPlan(items, request, revised.planningProfile)) > score(assessment)) planning = revised;
        else { items.splice(0, items.length, ...original); remaining = originalRemaining; planning = originalPlanning; }
      } catch { items.splice(0, items.length, ...original); remaining = originalRemaining; planning = originalPlanning; adjustments.push('The optional budget refinement could not be completed; review the remaining balance with your planner.'); }
    }
  }
  if (wedding) {
    const upgraded = upgradeOccasionBudget(items, candidates, request, planning.planningProfile);
    if (JSON.stringify(upgraded) !== JSON.stringify(items)) adjustments.push('Higher-priced catalogue alternatives were used to allocate the drinks budget without increasing beverage quantities. Confirm the final brands and tastes with your planner.');
    items.splice(0, items.length, ...upgraded);
  }
  const totalCents = items.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0);
  if (!items.length) return {
    response: [
      `I could not find a currently priced, in-stock catalogue offer for ${request.categories.map(id => labels[id]).join(', ')} within your ${money(budget)} drinks budget.`,
      adjustments.length ? `Selection checks: ${adjustments.join(' ')}` : '',
      'No drinks list has been generated. Try searching for a specific bottle, change your category preferences, or ask our team to check current offers. Your budget does not need to be increased unless a chosen offer exceeds it.',
    ].filter(Boolean).join('\n\n'),
    intent: 'occasion_planning', products: [], generatedList: { status: 'no_matches', items: [], total: 0, remaining: request.budget, budget: request.budget, guests: request.guests },
  };
  const products = items.map(item => { const offer = candidates.find(candidate => candidate.productId === item.productId); return { id: item.productId, name: item.name, slug: item.slug, ...(offer.image ? { image: offer.image } : {}) }; });
  const assessment = assessOccasionPlan(items, request, planning.planningProfile), uncovered = assessment.missingCategories;
  const note = value => typeof value === 'string' ? value.trim().slice(0, 800) : '';
  const question = note(planning.nextQuestion), nextQuestion = question.includes('?') ? `${question.slice(0, question.indexOf('?'))}?` : '';
  const profile = assessment.coverage.profile;
  const assumptions = profile ? [`Provisional reception length: ${profile.durationHours} hours.`, `Provisional adult alcohol-drinking guests: ${profile.adultDrinkers} of ${request.guests}; confirm the actual adult/child/non-drinker mix.`, `Draft shared alcohol allocation: ${profile.alcoholPortionsPerDrinker} service portions per adult drinker across all categories combined, including the toast. This is inventory planning, not a consumption recommendation.`, `Draft soft-drink target: ${assessment.coverage.softTarget} portions; draft water target: ${assessment.coverage.waterTargetLitres} litres. These assumptions need host/caterer confirmation.`] : ['Reception duration and adult/non-drinking guest mix still need confirmation.'];
  const response = [
    `### Proposed drinks list for ${request.guests.toLocaleString('en-NG')} guests`,
    `Categories: ${request.categories.map(id => labels[id]).join(', ')}. Budget: **${money(budget)}**.`,
    items.map(item => `- **${item.quantity} × ${item.name}** (${item.size}) — ${money(Math.round(item.unitPrice * 100))} each; **${money(Math.round(item.lineTotal * 100))}**`).join('\n'),
    adjustments.length ? `Selection checks: ${adjustments.join(' ')}` : '',
    `**Estimated drinks subtotal: ${money(totalCents)}. Budget remaining: ${money(budget - totalCents)}.**`,
    `Budget allocated: **${assessment.budget.usedPercent}%**.${assessment.budget.status === 'underallocated' ? ' This draft has an unallocated balance and needs further planning; it is not a completed full-budget allocation.' : ' The remainder is unallocated bottle-price rounding or a balance to discuss; no service fee has been invented.'}`,
    assessment.budget.status === 'underallocated' ? 'The unallocated balance is not a service charge. Review higher-quality brands, stock limits and the guest mix with the planner before treating this as a complete allocation.' : '',
    `### Guest coverage check\n${capacitySummary(assessment)}\nThese are approximate service capacities, not individual consumption targets. ${assessment.coverage.unknownVolumes ? `${assessment.coverage.unknownVolumes} product volumes could not be verified. ` : ''}${assessment.coverage.obviousShortfall ? 'The verified supply is clearly short of even one refreshment per guest; more planning or alternatives are required. ' : ''}Sufficiency remains provisional until reception duration, adult drinking guests and serving style are confirmed.`,
    assessment.coverage.possibleOverstock ? 'The alcoholic inventory exceeds the provisional shared guest allocation. Reduce quantities or improve brand quality rather than treating the excess as required guest consumption.' : '',
    Object.keys(assessment.coverage.shortages).length ? `Unfilled provisional requirements: ${Object.entries(assessment.coverage.shortages).map(([category, gap]) => `${category}: ${gap} ${category === 'water' ? 'litres' : 'service portions'}`).join('; ')}. Confirm venue supplies or affordable alternatives before treating guest coverage as complete.` : profile ? 'The provisional per-category supply targets are covered, subject to host/caterer confirmation of the guest mix and serving assumptions.' : '',
    profile ? 'The shared alcoholic allocation after the toast is split equally across the selected wine, beer and spirit categories unless refined with the planner. Mixers assume 100ml per spirit portion; confirm the bar service style.' : '',
    `### Planning assumptions\n${assumptions.map(value => `- ${value}`).join('\n')}`,
    uncovered.length ? `Not included in this draft: ${uncovered.map(id => labels[id]).join(', ')}. We can explore alternatives together.` : '',
    'Delivery, chilling, ice, glassware and bartending are unquoted and excluded from the drinks subtotal. Confirm which are inside your budget, current offers and quantities before checkout. This plan does not reserve stock.',
    nextQuestion || (wedding ? 'How long will the reception last, and how many adults are expected to drink alcohol?' : 'Which part of the drinks plan would you like to refine next?'),
  ].filter(Boolean).join('\n\n');
  return { response, intent: 'occasion_planning', products, generatedList: { items, total: totalCents / 100, remaining: (budget - totalCents) / 100, budget: request.budget, guests: request.guests, assessment } };
}
module.exports = { generateOccasionList };
