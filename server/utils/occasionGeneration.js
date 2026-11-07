'use strict';
const CATEGORIES = ['toast', 'wine', 'beer', 'spirits', 'alcohol-free'];
function parseGeneration(raw) {
  if (raw == null || raw === '') return { value: undefined };
  try {
    if (typeof raw === 'string' && raw.length > 5000) throw Error();
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || !Array.isArray(value.categories) || !value.categories.length || value.categories.length > 5 || value.categories.some(id => !CATEGORIES.includes(id))) throw Error();
    if (!Number.isSafeInteger(value.guests) || value.guests < 1 || value.guests > 1000000) throw Error();
    if (typeof value.budget !== 'number' || !Number.isFinite(value.budget) || value.budget <= 0 || Math.abs(value.budget * 100 - Math.round(value.budget * 100)) > 0.00001 || value.budget > 10000000000 || !Number.isSafeInteger(Math.round(value.budget * 100))) throw Error();
    if (value.selections !== undefined && (!Array.isArray(value.selections) || value.selections.length > 20 || value.selections.some(item => !item || typeof item.productId !== 'string' || !/^[\w-]{1,80}$/.test(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999))) throw Error();
    if (value.selections && new Set(value.selections.map(item => item.productId)).size !== value.selections.length) throw Error();
    return { value: { categories: [...new Set(value.categories)], budget: value.budget, guests: value.guests, ...(value.selections ? { selections: value.selections.map(({ productId, quantity }) => ({ productId, quantity })) } : {}) } };
  } catch { return { error: 'Choose valid drink categories, a positive budget and a whole guest count (up to 1,000,000).' }; }
}
module.exports = { parseGeneration };
