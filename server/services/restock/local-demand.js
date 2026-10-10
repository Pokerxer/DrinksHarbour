const { dailySeries, key, dayStart, DAY } = require("./series");
const { forecast } = require("./model");
function localDemand(sales, outflows, line, now, incomplete) {
  const transfers = outflows.rows.filter((r) => key(r) === line.key);
  const series = dailySeries([...sales, ...transfers], line.key, now);
  const blocked = incomplete || outflows.uncertain.has(line.key);
  const f = forecast(blocked ? [] : series.values, 90, dayStart(now));
  const localSales = sales.filter((r) => key(r) === line.key);
  const total = (rows) => rows.reduce((n, r) => n + r.units, 0);
  const cutoff = dayStart(now).getTime() - 30 * DAY;
  const transferUnits30 = total(
    transfers.filter((r) => Date.parse(r.at) >= cutoff),
  );
  const salesUnits30 = total(
    localSales.filter((r) => Date.parse(r.at) >= cutoff),
  );
  const hasTransfers = total(transfers) > 0;
  const basis = hasTransfers
    ? total(localSales) > 0
      ? "sales_and_transfers"
      : "transfers"
    : "sales";
  return {
    series,
    forecast: f,
    incomplete: blocked,
    transferIncomplete: outflows.uncertain.has(line.key),
    demandBasis: basis,
    transferUnits30,
    demandUnits30: blocked ? null : salesUnits30 + transferUnits30,
  };
}
module.exports = { localDemand };

function attachDemand(line, demand) {
  Object.assign(line, {
    transferUnits30: demand.transferUnits30,
    demandUnits30: demand.demandUnits30,
    demandBasis: demand.demandBasis,
    transferDataStatus: demand.transferIncomplete ? "incomplete" : "complete",
    historyStart: demand.series.startDate,
    forecast: demand.forecast,
  });
  if (demand.transferIncomplete)
    line.limitations.push(
      "Some posted transfer quantities lack complete dated evidence.",
    );
}
module.exports.attachDemand = attachDemand;
