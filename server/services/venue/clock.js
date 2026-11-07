'use strict';
function businessDate(now, timezone, cutoff) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  const local = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (Number(parts.hour) * 60 + Number(parts.minute) < cutoff) local.setUTCDate(local.getUTCDate() - 1);
  return local.toISOString().slice(0, 10);
}
module.exports = { businessDate };
