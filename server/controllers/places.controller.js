'use strict';

const placesService = require('../services/places.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/places/maps-script
 * Public — proxies the Google Maps JS API loader so the key isn't called
 * directly from the browser. Serves raw JS, not a JSON envelope.
 */
exports.mapsScript = async (req, res) => {
  try {
    const { callback, libraries } = req.query;
    const script = await placesService.fetchMapsScript(callback, libraries);
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    // Don't cache — the Maps JS bundle contains the API key. A stale bundle
    // that embeds an old/expired key would keep showing ExpiredKeyMapError even
    // after the key is rotated, for up to the previous TTL.
    res.set('Cache-Control', 'no-store');
    // Global helmet default is same-origin CORP, which blocks <script src> loads
    // from the frontend's domain. This endpoint is meant to be loaded cross-origin.
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(script);
  } catch (err) {
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(502).send('// Failed to load Google Maps script');
  }
};

/**
 * GET /api/places/autocomplete?input=
 */
exports.autocomplete = async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) return errorResponse(res, 'input is required', 400);
    const predictions = await placesService.getAutocomplete(input);
    return successResponse(res, predictions, 'Predictions fetched');
  } catch (err) {
    return errorResponse(res, 'Autocomplete failed', 502, err);
  }
};

/**
 * GET /api/places/details?place_id=
 */
exports.details = async (req, res) => {
  try {
    const { place_id } = req.query;
    if (!place_id) return errorResponse(res, 'place_id is required', 400);
    const details = await placesService.getPlaceDetails(place_id);
    return successResponse(res, details, 'Place details fetched');
  } catch (err) {
    return errorResponse(res, 'Place details failed', 502, err);
  }
};

/**
 * GET /api/places/reverse?lat=&lon=
 */
exports.reverse = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return errorResponse(res, 'lat and lon are required', 400);
    const details = await placesService.reverseGeocode(lat, lon);
    return successResponse(res, details, 'Reverse geocode successful');
  } catch (err) {
    return errorResponse(res, 'Reverse geocode failed', 502, err);
  }
};
