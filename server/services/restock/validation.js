const { mean } = require("./regression");
function evaluate(values, estimate) {
  const ends =
    values.length >= 42
      ? [values.length - 14, values.length - 7]
      : values.length >= 35
        ? [values.length - 7]
        : [];
  const actual = [],
    predicted = [];
  for (const end of ends) {
    const next = estimate(values.slice(0, end), 7);
    if (
      !next ||
      next.length !== 7 ||
      next.some((n) => !Number.isFinite(n) || n < 0)
    )
      return null;
    actual.push(...values.slice(end, end + 7));
    predicted.push(...next);
  }
  if (!actual.length) return null;
  const error = actual.map((n, i) => Math.abs(n - predicted[i])),
    total = actual.reduce((a, b) => a + b, 0);
  return {
    mae: mean(error),
    wape: total > 0 ? error.reduce((a, b) => a + b, 0) / total : null,
    bias: mean(actual.map((n, i) => predicted[i] - n)),
    holdoutDays: actual.length,
  };
}
function validationResult(errors, supported) {
  if (!supported)
    return {
      status: "unavailable",
      reason:
        "Complete dated demand history is needed before estimating future demand.",
    };
  if (!errors)
    return {
      status: "unvalidated",
      reason:
        "At least 35 completed days are needed for an out-of-sample validation.",
    };
  const relative = errors.wape ?? (errors.mae === 0 ? 0 : Infinity);
  const status = relative <= 0.25 ? "good" : relative <= 0.5 ? "mixed" : "weak";
  return {
    status,
    reason:
      status === "good"
        ? "Low error on recent held-out days; future demand can still change."
        : status === "mixed"
          ? "Recent validation has material error. Review stock and demand before ordering."
          : "Recent forecasts fit poorly. Review quantities manually before replenishing.",
  };
}
module.exports = { evaluate, validationResult };
