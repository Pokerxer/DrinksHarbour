// controllers/places.controller.js
// Proxy for Google Places API — keeps the API key server-side
const asyncHandler = require('express-async-handler');

const BASE = 'https://maps.googleapis.com/maps/api/place';

// Read key at call time so .env changes don't need a server restart
const getKey = () => process.env.GOOGLE_PLACES_API_KEY || '';

/**
 * GET /api/places/autocomplete?input=<query>
 * Returns Google Places predictions restricted to Nigeria.
 */
const autocomplete = asyncHandler(async (req, res) => {
  const { input = '' } = req.query;
  if (!input.trim()) return res.json({ success: true, data: [] });

  const key = getKey();
  if (!key) return res.status(503).json({ success: false, message: 'Places API not configured' });

  const params = new URLSearchParams({
    input: input.trim(),
    key,
    components: 'country:ng',
    language:   'en',
  });

  const r = await fetch(`${BASE}/autocomplete/json?${params}`);
  const data = await r.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn('[Places] autocomplete error:', data.status, data.error_message);
    return res.status(502).json({ success: false, message: data.error_message || data.status });
  }

  res.json({ success: true, data: data.predictions || [] });
});

/**
 * GET /api/places/details?place_id=<id>
 * Returns address details + coordinates for a place.
 */
const details = asyncHandler(async (req, res) => {
  const { place_id = '' } = req.query;
  if (!place_id) return res.status(400).json({ success: false, message: 'place_id required' });

  const key = getKey();
  if (!key) return res.status(503).json({ success: false, message: 'Places API not configured' });

  const params = new URLSearchParams({
    place_id,
    key,
    fields:   'geometry,address_components,formatted_address',
    language: 'en',
  });

  const r = await fetch(`${BASE}/details/json?${params}`);
  const data = await r.json();

  if (data.status !== 'OK') {
    console.warn('[Places] details error:', data.status, data.error_message);
    return res.status(502).json({ success: false, message: data.error_message || data.status });
  }

  const result     = data.result;
  const components = result.address_components || [];

  const get      = (type) => components.find(c => c.types.includes(type))?.long_name  || '';
  const getShort = (type) => components.find(c => c.types.includes(type))?.short_name || '';

  // Build street line from house number + route, fallback to neighbourhood
  const street =
    [get('street_number'), get('route')].filter(Boolean).join(' ') ||
    get('neighborhood') ||
    get('sublocality_level_1') ||
    get('sublocality') ||
    '';

  const city =
    get('locality') ||
    get('sublocality_level_1') ||
    get('sublocality') ||
    get('administrative_area_level_2') ||
    '';

  res.json({
    success: true,
    data: {
      formatted: result.formatted_address,
      street,
      city,
      state:    get('administrative_area_level_1'),
      postcode: get('postal_code'),
      country:  get('country'),
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
    },
  });
});

/**
 * GET /api/places/reverse?lat=<lat>&lon=<lon>
 * Reverse-geocodes a coordinate to address details.
 */
const reverse = asyncHandler(async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, message: 'lat and lon required' });

  const key = getKey();
  if (!key) return res.status(503).json({ success: false, message: 'Places API not configured' });

  const params = new URLSearchParams({
    latlng:   `${lat},${lon}`,
    key,
    language: 'en',
    result_type: 'street_address|route|neighborhood|sublocality|locality',
  });

  const r    = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await r.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return res.status(502).json({ success: false, message: data.error_message || data.status });
  }

  const result     = (data.results || [])[0];
  if (!result) return res.json({ success: true, data: null });

  const components = result.address_components || [];
  const get        = (type) => components.find(c => c.types.includes(type))?.long_name  || '';

  const street =
    [get('street_number'), get('route')].filter(Boolean).join(' ') ||
    get('neighborhood') || get('sublocality_level_1') || get('sublocality') || '';

  const city =
    get('locality') || get('sublocality_level_1') || get('sublocality') ||
    get('administrative_area_level_2') || '';

  res.json({
    success: true,
    data: {
      formatted: result.formatted_address,
      street,
      city,
      state:    get('administrative_area_level_1'),
      postcode: get('postal_code'),
      country:  get('country'),
      lat: parseFloat(lat),
      lon: parseFloat(lon),
    },
  });
});

/**
 * GET /api/places/maps-script?callback=<name>
 * Proxies the Google Maps JS API bundle so the key stays server-side.
 * Streams the JS content rather than redirecting (avoids cross-origin script errors).
 */
const mapsScript = asyncHandler(async (req, res) => {
  const key = getKey();
  if (!key) {
    console.error('[Maps] GOOGLE_PLACES_API_KEY not set');
    return res.status(503).send('// Maps API not configured');
  }

  const { callback = 'initMap', libraries = '' } = req.query;
  const params = new URLSearchParams({ key, callback, loading: 'async' });
  if (libraries) params.set('libraries', String(String(libraries)));

  const mapsUrl = `https://maps.googleapis.com/maps/api/js?${params}`;

  try {
    const upstream = await fetch(mapsUrl);
    const body     = await upstream.text();

    if (!upstream.ok) {
      console.error(`[Maps] Google returned ${upstream.status}:`, body.slice(0, 200));
      return res.status(upstream.status).send(`// Google Maps error: ${upstream.status}`);
    }

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Override Helmet's same-origin CORP so browsers can load this cross-origin script
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(body);
  } catch (err) {
    console.error('[Maps] Failed to fetch Maps JS API:', err.message);
    res.status(502).send('// Failed to fetch Google Maps API');
  }
});

module.exports = { autocomplete, details, reverse, mapsScript };
