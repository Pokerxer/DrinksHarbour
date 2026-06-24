'use strict';

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';

const transformGoogleResult = (result) => {
  const components = result.address_components || [];
  const get = (type) => components.find((c) => c.types.includes(type))?.long_name || '';

  const street = [get('street_number'), get('route')].filter(Boolean).join(' ')
    || get('sublocality') || get('neighborhood');

  return {
    formatted: result.formatted_address || '',
    street,
    city: get('locality') || get('administrative_area_level_2') || '',
    state: get('administrative_area_level_1') || '',
    postcode: get('postal_code') || '',
    country: get('country') || '',
    lat: result.geometry?.location?.lat ?? 0,
    lon: result.geometry?.location?.lng ?? 0,
  };
};

const fetchMapsScript = async (callback, libraries) => {
  const params = new URLSearchParams({
    key: process.env.GOOGLE_MAPS_API_KEY || '',
    v: 'weekly',
    callback: callback || '',
    libraries: libraries || '',
  });
  const res = await fetch(`${GOOGLE_BASE}/js?${params}`);
  return res.text();
};

const getAutocomplete = async (input) => {
  const params = new URLSearchParams({
    input,
    key: process.env.GOOGLE_MAPS_API_KEY || '',
    components: 'country:ng',
  });
  const res = await fetch(`${GOOGLE_BASE}/place/autocomplete/json?${params}`);
  const json = await res.json();
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(json.error_message || `Autocomplete failed: ${json.status}`);
  }
  return json.predictions || [];
};

const getPlaceDetails = async (placeId) => {
  const params = new URLSearchParams({
    place_id: placeId,
    key: process.env.GOOGLE_MAPS_API_KEY || '',
    fields: 'formatted_address,address_component,geometry',
  });
  const res = await fetch(`${GOOGLE_BASE}/place/details/json?${params}`);
  const json = await res.json();
  if (json.status !== 'OK') {
    throw new Error(json.error_message || `Place details failed: ${json.status}`);
  }
  return transformGoogleResult(json.result);
};

const reverseGeocode = async (lat, lon) => {
  const params = new URLSearchParams({
    latlng: `${lat},${lon}`,
    key: process.env.GOOGLE_MAPS_API_KEY || '',
  });
  const res = await fetch(`${GOOGLE_BASE}/geocode/json?${params}`);
  const json = await res.json();
  if (json.status !== 'OK' || !json.results?.length) {
    throw new Error(json.error_message || `Reverse geocode failed: ${json.status}`);
  }
  return transformGoogleResult(json.results[0]);
};

module.exports = {
  fetchMapsScript,
  getAutocomplete,
  getPlaceDetails,
  reverseGeocode,
};
