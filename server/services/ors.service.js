// services/ors.service.js
// Distance / route calculations via Google Maps APIs
// Kept as ors.service.js for backwards-compatibility with existing imports

const DISTANCE_BASE = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';

// DrinksHarbour warehouse — Wyn City, 39 Gana St, Maitama, Abuja
const WAREHOUSE = {
  lat: parseFloat(process.env.WAREHOUSE_LAT || '9.0782726'),
  lon: parseFloat(process.env.WAREHOUSE_LON || '7.5005914'),
};

const getKey = () => process.env.GOOGLE_PLACES_API_KEY || '';

/**
 * Single-stop: warehouse → customer.
 * Used when there is only one vendor or vendor locations are unavailable.
 * @returns {Promise<number>} road distance in km
 */
async function getRoadDistanceKm(customerLat, customerLon) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set');

  const params = new URLSearchParams({
    origins:      `${WAREHOUSE.lat},${WAREHOUSE.lon}`,
    destinations: `${customerLat},${customerLon}`,
    mode:         'driving',
    units:        'metric',
    key:          apiKey,
  });

  const res = await fetch(`${DISTANCE_BASE}?${params}`);
  if (!res.ok) throw new Error(`Google Distance Matrix error ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Google Distance Matrix: ${data.status} — ${data.error_message || ''}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`No route found: ${element?.status || 'unknown'}`);
  }

  return element.distance.value / 1000;
}

/**
 * Multi-stop route: warehouse → vendor1 → vendor2 → ... → customer.
 * Uses Google Directions API with optimised waypoints.
 *
 * @param {{ lat: number, lon: number }[]} vendorLocations
 * @param {number} customerLat
 * @param {number} customerLon
 * @returns {Promise<{ distanceKm: number, stops: number }>}
 */
async function getRouteDistanceKm(vendorLocations, customerLat, customerLon) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set');

  // Filter out invalid coordinates
  const validVendors = vendorLocations.filter(
    v => v && typeof v.lat === 'number' && typeof v.lon === 'number'
       && !isNaN(v.lat) && !isNaN(v.lon),
  );

  // No valid vendor locations → fall back to direct warehouse→customer distance
  if (validVendors.length === 0) {
    const km = await getRoadDistanceKm(customerLat, customerLon);
    return { distanceKm: km, stops: 0 };
  }

  // Build waypoints string: "optimize:true|lat1,lon1|lat2,lon2"
  const waypointStr = 'optimize:true|' +
    validVendors.map(v => `${v.lat},${v.lon}`).join('|');

  const params = new URLSearchParams({
    origin:      `${WAREHOUSE.lat},${WAREHOUSE.lon}`,
    destination: `${customerLat},${customerLon}`,
    waypoints:   waypointStr,
    mode:        'driving',
    units:       'metric',
    key:         apiKey,
  });

  const res = await fetch(`${DIRECTIONS_BASE}?${params}`);
  if (!res.ok) throw new Error(`Google Directions error ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK') {
    // Directions failed — fall back to direct distance
    console.warn('[Shipping] Directions API failed:', data.status, '— falling back to direct distance');
    const km = await getRoadDistanceKm(customerLat, customerLon);
    return { distanceKm: km, stops: validVendors.length };
  }

  // Sum all legs of the optimised route
  const legs = data.routes?.[0]?.legs || [];
  const totalMetres = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);

  return {
    distanceKm: totalMetres / 1000,
    stops: validVendors.length,
  };
}

module.exports = { getRoadDistanceKm, getRouteDistanceKm, WAREHOUSE };
