'use strict';
// services/venue/units.js — controlled units for venue recipes and pour stock (S2, spec §3).
// PURE module: no mongo, no model imports — only the domain error helper.
//
// Dimensions: count / volume (ml) / mass (g). Conversions are allowed only within a
// dimension. Exact factors: 1000 ml = 1 l; conversions between mass and volume require
// the item's `gramsPerMl` factor with the EXACT direction:
//     mass (g) = volume (ml) x gramsPerMl
//     volume (ml) = mass (g) / gramsPerMl
// (gramsPerMl is grams per millilitre: density-like; 750 ml at 0.995 g/ml weighs 746.25 g.)
//
// Fixed precision: quantities carry at most 2 decimals, represented internally as exact
// integer hundredths of ml/g; count stays integer — no fractional counts, ever.
// Volume↔mass numbers are computed on hundredths so 0.5 ml inputs never drift.

const { fail } = require('./errors');

const HUNDREDTHS = 100;
const ML_PER_L = 1000;
const DIMENSIONS = { count: 'count', volume: 'volume', mass: 'mass' };
const UNIT_CODES = ['count', 'ml', 'l', 'g'];
const NORMALIZED_UNITS = { count: 'count', volume: 'ml', mass: 'g' };

function unitDimension(unit) {
  if (unit === 'count') return DIMENSIONS.count;
  if (unit === 'ml' || unit === 'l') return DIMENSIONS.volume;
  if (unit === 'g') return DIMENSIONS.mass;
  fail('INVALID_INPUT', `Unknown unit ${String(unit)}`, 400);
}

// toHundredths(quantity, 'ml'|'l'|'g') -> exact integer hundredths OF ml/g
// ('l' inputs already land on ml hundredths: 1.5 l -> 150000).
function toHundredths(quantity, unit) {
  if (unit === 'l') return Math.round(quantity * ML_PER_L * HUNDREDTHS);
  return Math.round(quantity * HUNDREDTHS);
}

function fromHundredths(hundredths) {
  return hundredths / HUNDREDTHS;
}

function requirePositiveFinite(quantity, what) {
  if (typeof quantity !== 'number' || Number.isNaN(quantity) || !Number.isFinite(quantity) || quantity <= 0) fail('INVALID_INPUT', `${what} must be a positive number`, 400);
}

function requireGramsPerMl(profile) {
  const gramsPerMl = profile && profile.gramsPerMl;
  if (typeof gramsPerMl !== 'number' || Number.isNaN(gramsPerMl) || !Number.isFinite(gramsPerMl) || gramsPerMl <= 0) fail('UNIT_CONVERSION', 'g<->ml conversion requires the item gramsPerMl factor', 400);
  // Quantize the factor to hundredths so the result stays on the 2-decimal grid.
  return Math.round(gramsPerMl * HUNDREDTHS * HUNDREDTHS) / (HUNDREDTHS * HUNDREDTHS);
}

// Normalization contract: the returned unit is always the target dimension's base unit
// (volume -> ml, mass -> g, count -> count), so l inputs collapse to ml.
function convert(quantity, from, to, profile) {
  requirePositiveFinite(quantity, 'quantity');
  const fromDimension = unitDimension(from);
  if (from === 'g' || from === 'ml') require('./cost-math').quantityFrom(quantity, from);
  const toDimension = unitDimension(to);
  const targetUnit = NORMALIZED_UNITS[toDimension];
  if (from === to) {
    if (from === 'count' && !Number.isInteger(quantity)) fail('UNIT_CONVERSION', 'count stays integer; fractional counts are not convertible', 400);
    return { quantity, unit: from };
  }
  if (fromDimension === toDimension) {
    // l -> ml is the only non-identical same-dimension pair (count collapses above).
    return { quantity: fromHundredths(toHundredths(quantity, from)), unit: targetUnit };
  }
  if (fromDimension === DIMENSIONS.count || toDimension === DIMENSIONS.count) fail('UNIT_CONVERSION', 'count cannot be converted to or from ml/g units', 400);
  const factor = requireGramsPerMl(profile);
  return fromDimension === DIMENSIONS.volume
    ? { quantity: fromHundredths(Math.round(toHundredths(quantity, from) * factor)), unit: 'g' }
    : { quantity: fromHundredths(Math.round(toHundredths(quantity, from) / factor)), unit: 'ml' };
}

// components: [{profile, quantity, unit('count'|'ml'|'g')}]; unique per (profile, unit).
// ml/g quantities must be positive numbers (fractional ml/g allowed at 2 decimals);
// count quantities must be whole integers.
function assertRecipeQuantities(components) {
  if (!Array.isArray(components) || components.length === 0) fail('INVALID_INPUT', 'Recipe components are required', 400);
  const seen = new Set();
  const dimensions = new Set();
  for (const component of components) {
    if (!component || typeof component !== 'object' || !component.profile) fail('INVALID_INPUT', 'Each recipe component needs a profile', 400);
    requirePositiveFinite(component.quantity, 'Component quantity');
    const dimension = unitDimension(component.unit);
    if (component.unit === 'g' || component.unit === 'ml') require('./cost-math').quantityFrom(component.quantity, component.unit);
    const key = `${String(component.profile)}|${component.unit}`;
    if (seen.has(key)) fail('INVALID_INPUT', 'Duplicate profile/unit component', 400);
    seen.add(key); dimensions.add(dimension);
    if (component.unit === 'count' && !Number.isInteger(component.quantity)) fail('UNIT_CONVERSION', 'count components must be whole units', 400);
  }
  return undefined;
}

module.exports = { convert, assertRecipeQuantities, DIMENSIONS, UNIT_CODES, NORMALIZED_UNITS };
