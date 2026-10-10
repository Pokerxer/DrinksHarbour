const { ValidationError } = require("./errors");
const DAY = 86400000,
  OFFSET = 3600000;
function validateDateRange(q = {}, now = new Date(), completed = false) {
  if (q.startDate === undefined && q.endDate === undefined) return null;
  const parse = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new ValidationError("Invalid timeframe date");
    const at = Date.parse(`${value}T00:00:00Z`);
    if (
      !Number.isFinite(at) ||
      new Date(at).toISOString().slice(0, 10) !== value
    )
      throw new ValidationError("Invalid timeframe date");
    return at - OFFSET;
  };
  const start = parse(q.startDate),
    end = parse(q.endDate) + DAY;
  const today = Math.floor((now.getTime() + OFFSET) / DAY) * DAY - OFFSET;
  if (
    end <= start ||
    end - start > 366 * DAY ||
    end > today + (completed ? 0 : DAY)
  )
    throw new ValidationError(
      "Use a valid timeframe of up to 366 days with no future dates",
    );
  return {
    start: new Date(start),
    end: new Date(end),
    previous: new Date(start - (end - start)),
    days: (end - start) / DAY,
    startDate: q.startDate,
    endDate: q.endDate,
  };
}
module.exports = { validateDateRange };
