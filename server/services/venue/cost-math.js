'use strict';
// Pure arithmetic only. Callers own stock locks, provenance and reviewed policy.
const { fail } = require('./errors');
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function checkedNumber(value, code) {
  if (value < -MAX_SAFE || value > MAX_SAFE)
    fail(code, 'Result exceeds the safe integer boundary', 400);
  return Number(value);
}

function requireMinor(value, { signed = false } = {}) {
  if (!Number.isSafeInteger(value) || (!signed && value < 0))
    fail('INVALID_MONEY', 'Money must be a safe integer in minor units', 400);
  return value;
}

function sumMinor(values) {
  return checkedNumber(
    values.reduce(
      (sum, value) => sum + BigInt(requireMinor(value, { signed: true })),
      0n,
    ),
    'INVALID_MONEY',
  );
}

function assertQuantity(quantity, { allowZero = false } = {}) {
  if (
    !quantity ||
    !['count', 'g', 'ml'].includes(quantity.unit) ||
    quantity.scale !== (quantity.unit === 'count' ? 1 : 100) ||
    !Number.isSafeInteger(quantity.amountScaled) ||
    quantity.amountScaled < (allowZero ? 0 : 1)
  ) {
    fail(
      'INVALID_QUANTITY',
      'Quantity requires exact positive count or hundredths of g/ml',
      400,
    );
  }
  return {
    amountScaled: quantity.amountScaled,
    scale: quantity.scale,
    unit: quantity.unit,
  };
}

function quantityFrom(value, unit) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !['count', 'g', 'ml', 'kg', 'l'].includes(unit)
  )
    fail('INVALID_QUANTITY', 'Unsupported quantity or unit', 400);
  // Decimal text avoids rejecting valid 0.29 because 0.29 * 100 is inexact.
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const coefficient = BigInt(whole + fraction);
  const shift =
    Number(exponent) -
    fraction.length +
    (unit === 'count' ? 0 : ['kg', 'l'].includes(unit) ? 5 : 2);
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  if (coefficient % divisor !== 0n)
    fail('INVALID_QUANTITY', 'Quantity exceeds supported precision', 400);
  const amountScaled = checkedNumber(
    shift < 0 ? coefficient / divisor : coefficient * 10n ** BigInt(shift),
    'INVALID_QUANTITY',
  );
  return assertQuantity({
    amountScaled,
    scale: unit === 'count' ? 1 : 100,
    unit: unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit,
  });
}

function multiplyQuantity(quantity, multiplier) {
  const normalized = assertQuantity(quantity);
  if (!Number.isSafeInteger(multiplier) || multiplier < 1)
    fail(
      'INVALID_QUANTITY',
      'Multiplier must be a positive whole quantity',
      400,
    );
  return {
    ...normalized,
    amountScaled: checkedNumber(
      BigInt(normalized.amountScaled) * BigInt(multiplier),
      'INVALID_QUANTITY',
    ),
  };
}

function allocateSourceCost({
  costMinor,
  quantityScaled,
  issuedBeforeScaled = 0,
  issueScaled,
}) {
  requireMinor(costMinor);
  if (
    ![quantityScaled, issuedBeforeScaled, issueScaled].every(
      Number.isSafeInteger,
    ) ||
    quantityScaled < 1 ||
    issuedBeforeScaled < 0 ||
    issueScaled < 1 ||
    BigInt(issuedBeforeScaled) + BigInt(issueScaled) > BigInt(quantityScaled)
  ) {
    fail(
      'INVALID_QUANTITY',
      'Source issue exceeds the retained original quantity',
      400,
    );
  }
  const cost = BigInt(costMinor),
    quantity = BigInt(quantityScaled),
    before = BigInt(issuedBeforeScaled);
  return checkedNumber(
    (cost * (before + BigInt(issueScaled))) / quantity -
      (cost * before) / quantity,
    'INVALID_MONEY',
  );
}

function largestRemainderAllocation(totalMinor, components) {
  requireMinor(totalMinor);
  if (!Array.isArray(components) || !components.length)
    fail('INVALID_ALLOCATION', 'Package components are required', 400);
  const ids = new Set();
  const rows = components.map((component) => {
    if (
      !component ||
      typeof component.componentId !== 'string' ||
      !component.componentId.trim() ||
      ids.has(component.componentId) ||
      !Number.isSafeInteger(component.weight) ||
      component.weight < 0
    ) {
      fail(
        'INVALID_ALLOCATION',
        'Components need unique stable IDs and nonnegative integer weights',
        400,
      );
    }
    ids.add(component.componentId);
    return {
      componentId: component.componentId,
      weight: BigInt(component.weight),
    };
  });
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0n);
  if (totalWeight === 0n)
    fail(
      'INVALID_ALLOCATION',
      'All-zero weights require an explicit approved allocation',
      400,
    );
  for (const row of rows) {
    const numerator = BigInt(totalMinor) * row.weight;
    row.amount = numerator / totalWeight;
    row.remainder = numerator % totalWeight;
  }
  const remainder =
    BigInt(totalMinor) - rows.reduce((sum, row) => sum + row.amount, 0n);
  const ranked = [...rows].sort((a, b) =>
    a.remainder !== b.remainder
      ? a.remainder > b.remainder
        ? -1
        : 1
      : a.componentId < b.componentId
        ? -1
        : 1,
  );
  for (let index = 0; index < Number(remainder); index++)
    ranked[index].amount++;
  return rows.map((row) => ({
    componentId: row.componentId,
    amountMinor: checkedNumber(row.amount, 'INVALID_MONEY'),
  }));
}
module.exports = {
  quantityFrom,
  assertQuantity,
  multiplyQuantity,
  allocateSourceCost,
  requireMinor,
  sumMinor,
  largestRemainderAllocation,
};
