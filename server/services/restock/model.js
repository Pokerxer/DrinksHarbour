const { predict, mean } = require("./regression");
const { evaluate, validationResult } = require("./validation");
const { DAY } = require("./series");
const sum = (v) => v.reduce((a, b) => a + b, 0);
const average = (v, count) => Array(count).fill(mean(v.slice(-28)));
function seasonal(v, count) {
  const last = v.slice(-7);
  return Array.from({ length: count }, (_, i) => last[i % 7]);
}
function forecast(values, horizon, startDate) {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 90)
    throw new Error("Invalid forecast horizon");
  const at = new Date(startDate),
    v = values.slice(-180);
  const base = {
    model: null,
    method: "insufficient_history",
    daily: [],
    startDate: at.toISOString(),
    historyDays: v.length,
    errors: null,
    demand7: null,
    demand14: null,
    demand30: null,
    validation: validationResult(null, false),
    limitations: [
      "Historical stockout availability is not known; demand may be understated.",
    ],
  };
  if (v.length < 28 || v.some((n) => !Number.isFinite(n) || n < 0))
    return {
      ...base,
      limitations: [
        ...base.limitations,
        v.length < 28
          ? `At least 28 completed days are required; ${28 - v.length} more days of complete history are needed.`
          : "Demand history has missing or invalid quantities. Verify the source records.",
      ],
    };
  const flat = evaluate(v, average),
    weekly = evaluate(v, seasonal);
  const baseline = weekly && flat && weekly.mae < flat.mae ? seasonal : average;
  const baselineError = baseline === seasonal ? weekly : flat;
  let daily = baseline(v, horizon),
    method = "historical_baseline",
    model = null,
    selectedError = baselineError;
  if (v.length >= 84 && v.filter((n) => n > 0).length >= 14 && baselineError) {
    const weekday =
      (new Date(at.getTime() - v.length * DAY).getUTCDay() + 1) % 7;
    const trained = evaluate(v, (history, count) =>
      predict(history, count, weekday),
    );
    if (trained && trained.mae < baselineError.mae * 0.95) {
      const prediction = predict(v, horizon, weekday);
      if (prediction) {
        daily = prediction;
        method = "trained_forecast";
        model = "dh-demand-ridge-v1";
        selectedError = trained;
      }
    }
  }
  const errors = selectedError
    ? { ...selectedError, baselineMae: baselineError.mae }
    : null;
  return {
    ...base,
    method,
    model,
    daily,
    errors,
    validation: validationResult(errors, true),
    baseline: baseline === seasonal ? "weekly_seasonal" : "trailing_mean",
    demand7: horizon >= 7 ? sum(daily.slice(0, 7)) : null,
    demand14: horizon >= 14 ? sum(daily.slice(0, 14)) : null,
    demand30: horizon >= 30 ? sum(daily.slice(0, 30)) : null,
  };
}
module.exports = { forecast };
