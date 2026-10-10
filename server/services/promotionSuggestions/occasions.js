const { drinkEvents } = require("./drink-events");
const day = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
function occasions(now, custom = {}) {
  const today = day(now),
    year = Number(today.slice(0, 4));
  const fixed = [
    ["Christmas", "12-25"],
    ["New Year", "01-01"],
    ["Valentine’s Day", "02-14"],
    ["Nigeria Independence Day", "10-01"],
  ];
  const events = fixed.map(([name, md]) => {
    let date = `${year}-${md}`;
    if (date < today) date = `${year + 1}-${md}`;
    return { name, date, kind: "calendar" };
  });
  events.push(...drinkEvents(year), ...drinkEvents(year + 1));
  if (
    custom.eventName &&
    custom.eventDate &&
    !events.some(
      (e) => e.name === custom.eventName && e.date === custom.eventDate,
    )
  )
    events.push({
      name: custom.eventName,
      date: custom.eventDate,
      kind: "custom",
    });
  return events
    .map((e) => ({
      ...e,
      daysAway: Math.round((Date.parse(e.date) - Date.parse(today)) / 86400000),
    }))
    .filter((e) => e.daysAway >= 0 && e.daysAway <= 60)
    .sort((a, b) => a.date.localeCompare(b.date));
}
module.exports = { occasions };
