const { ValidationError } = require("../../utils/errors");
const { validateDateRange } = require("../../utils/notificationDateRange");
function options(q, now = new Date()) {
  const fields = [
    "startDate",
    "endDate",
    "warehouseId",
    "maxDiscount",
    "marginFloor",
    "eventName",
    "eventDate",
  ];
  if (Object.keys(q).some((k) => !fields.includes(k)))
    throw new ValidationError("Unsupported promotion query");
  const range = validateDateRange(q, now, true);
  if (
    q.warehouseId &&
    (typeof q.warehouseId !== "string" || !/^[a-f\d]{24}$/i.test(q.warehouseId))
  )
    throw new ValidationError("Invalid warehouse");
  const number = (key, fallback, max) => {
    if (q[key] === undefined) return fallback;
    if (
      typeof q[key] !== "string" ||
      !/^\d+(\.\d{1,2})?$/.test(q[key]) ||
      +q[key] > max
    )
      throw new ValidationError(`Invalid ${key}`);
    return +q[key];
  };
  if (!!q.eventName !== !!q.eventDate)
    throw new ValidationError("Special day needs a name and date");
  if (
    q.eventName &&
    (typeof q.eventName !== "string" ||
      !q.eventName.trim() ||
      q.eventName.length > 100 ||
      typeof q.eventDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(q.eventDate) ||
      !Number.isFinite(Date.parse(q.eventDate)) ||
      new Date(q.eventDate).toISOString().slice(0, 10) !== q.eventDate)
  )
    throw new ValidationError("Invalid special day");
  if (q.eventDate) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const away = (Date.parse(q.eventDate) - Date.parse(today)) / 86400000;
    if (away < 0 || away > 60)
      throw new ValidationError(
        "Choose a special day within the next 60 days.",
      );
  }
  return {
    ...(range ? { startDate: q.startDate, endDate: q.endDate } : {}),
    warehouseId: q.warehouseId || "",
    maxDiscount: number("maxDiscount", 10, 50),
    marginFloor: number("marginFloor", 20, 90),
    eventName: q.eventName?.trim() || "",
    eventDate: q.eventDate || "",
  };
}
module.exports = { options };
