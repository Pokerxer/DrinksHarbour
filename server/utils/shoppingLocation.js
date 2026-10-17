'use strict';
const { ValidationError } = require('./errors');
const validLocation = value => value && typeof value === 'object' &&
  typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
  typeof value.lon === 'number' && Number.isFinite(value.lon) && Math.abs(value.lon) <= 180;

function parseShoppingLocation(raw) {
  if (raw === undefined) return null;
  try {
    if (typeof raw !== 'string' || raw.length > 160) throw new Error();
    const value = JSON.parse(raw);
    if (!validLocation(value) || Array.isArray(value) || Object.keys(value).some(k => !['lat', 'lon'].includes(k))) throw new Error();
    return { lat: value.lat, lon: value.lon };
  } catch { throw new ValidationError('Invalid shopping location'); }
}
function distanceKm(from, to) {
  if (!validLocation(from) || !validLocation(to)) return null;
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(to.lat - from.lat) / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lon - from.lon) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
module.exports = { validLocation, parseShoppingLocation, distanceKm };
