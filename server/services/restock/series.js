const DAY = 86400000;
const OFFSET = 3600000;
const id = (v) => String(v?._id || v || '');
const key = (r) =>
  [id(r.subProductId), id(r.sizeId), id(r.warehouseId)].join(':');
function dayStart(value) {
  const at = new Date(value).getTime();
  return new Date(Math.floor((at + OFFSET) / DAY) * DAY - OFFSET);
}
function dailySeries(rows, identity, now = new Date()) {
  const end = dayStart(now).getTime(),
    earliest = end - 180 * DAY;
  const own = rows.filter(
    (r) =>
      key(r) === identity &&
      Number.isFinite(Date.parse(r.at)) &&
      Date.parse(r.at) >= earliest &&
      Date.parse(r.at) < end,
  );
  if (!own.length)
    return {
      values: [],
      startDate: null,
      endDate: new Date(end).toISOString(),
    };
  const start = Math.min(...own.map((r) => dayStart(r.at).getTime()));
  const values = Array((end - start) / DAY).fill(0);
  for (const r of own) {
    const i = (dayStart(r.at).getTime() - start) / DAY;
    if (!Number.isFinite(r.units) || r.units < 0 || values[i] === null)
      values[i] = null;
    else values[i] += r.units;
  }
  return {
    values,
    startDate: new Date(start).toISOString(),
    endDate: new Date(end).toISOString(),
  };
}
module.exports = { DAY, id, key, dayStart, dailySeries };
