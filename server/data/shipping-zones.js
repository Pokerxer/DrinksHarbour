// data/shipping-zones.js
// Shipping rates dispatched from Abuja (FCT) warehouse
// All fees in NGN. Free delivery on orders >= FREE_THRESHOLD.

const FREE_THRESHOLD = 2_000_000;

// ─── State-level zone rates ───────────────────────────────────────────────────
const STATE_ZONES = [
  {
    zone: 'zone_1',
    label: 'Zone 1 — FCT (Local)',
    fee: 2_500,
    deliveryDaysMin: 1,
    deliveryDaysMax: 2,
    states: ['FCT - Abuja'],
  },
  {
    zone: 'zone_2',
    label: 'Zone 2 — Abuja Environs',
    fee: 10_000,
    deliveryDaysMin: 2,
    deliveryDaysMax: 3,
    states: ['Nasarawa', 'Niger', 'Kogi'],
  },
  {
    zone: 'zone_3',
    label: 'Zone 3 — North Central',
    fee: 15_000,
    deliveryDaysMin: 3,
    deliveryDaysMax: 5,
    states: ['Kaduna', 'Plateau', 'Benue', 'Kwara'],
  },
  {
    zone: 'zone_4',
    label: 'Zone 4 — Southwest',
    fee: 20_000,
    deliveryDaysMin: 3,
    deliveryDaysMax: 5,
    states: ['Lagos', 'Ogun', 'Oyo', 'Ondo', 'Osun', 'Ekiti'],
  },
  {
    zone: 'zone_5',
    label: 'Zone 5 — Southeast & South-South',
    fee: 20_000,
    deliveryDaysMin: 3,
    deliveryDaysMax: 6,
    states: ['Enugu', 'Anambra', 'Imo', 'Abia', 'Ebonyi',
             'Rivers', 'Delta', 'Edo', 'Bayelsa', 'Cross River', 'Akwa Ibom'],
  },
  {
    zone: 'zone_6',
    label: 'Zone 6 — Far North',
    fee: 18_000,
    deliveryDaysMin: 4,
    deliveryDaysMax: 7,
    states: ['Kano', 'Katsina', 'Sokoto', 'Borno', 'Bauchi',
             'Gombe', 'Yobe', 'Kebbi', 'Zamfara', 'Jigawa', 'Adamawa', 'Taraba'],
  },
  {
    zone: 'zone_7',
    label: 'Zone 7 — Remote',
    fee: 30_000,
    deliveryDaysMin: 5,
    deliveryDaysMax: 10,
    states: [], // catch-all
  },
];

// ─── LGA-level overrides (more granular pricing within a state) ───────────────
// Format: 'State|LGA' → { fee, label, deliveryDaysMin, deliveryDaysMax }
const LGA_OVERRIDES = {
  // FCT — by distance from city centre
  'FCT - Abuja|Abuja Municipal':  { fee: 2_500,  deliveryDaysMin: 1, deliveryDaysMax: 1 },
  'FCT - Abuja|Bwari':            { fee: 4_000,  deliveryDaysMin: 1, deliveryDaysMax: 2 },
  'FCT - Abuja|Gwagwalada':       { fee: 5_000,  deliveryDaysMin: 1, deliveryDaysMax: 2 },
  'FCT - Abuja|Kuje':             { fee: 5_500,  deliveryDaysMin: 1, deliveryDaysMax: 2 },
  'FCT - Abuja|Kwali':            { fee: 7_000,  deliveryDaysMin: 2, deliveryDaysMax: 3 },
  'FCT - Abuja|Abaji':            { fee: 8_000,  deliveryDaysMin: 2, deliveryDaysMax: 3 },

  // Lagos — Island/close mainland cheaper, outer LGAs more expensive
  'Lagos|Lagos Island':           { fee: 16_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Lagos Mainland':         { fee: 16_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Eti-Osa':                { fee: 16_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Apapa':                  { fee: 16_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Surulere':               { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Mushin':                 { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Oshodi-Isolo':           { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
  'Lagos|Shomolu':                { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Lagos|Kosofe':                 { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Lagos|Agege':                  { fee: 18_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Lagos|Alimosho':               { fee: 18_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Lagos|Ifako-Ijaye':            { fee: 18_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Lagos|Ajeromi-Ifelodun':       { fee: 18_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Lagos|Amuwo-Odofin':           { fee: 19_000, deliveryDaysMin: 4, deliveryDaysMax: 5 },
  'Lagos|Ikorodu':                { fee: 21_000, deliveryDaysMin: 4, deliveryDaysMax: 6 },
  'Lagos|Ibeju-Lekki':            { fee: 21_000, deliveryDaysMin: 4, deliveryDaysMax: 6 },
  'Lagos|Badagry':                { fee: 22_000, deliveryDaysMin: 4, deliveryDaysMax: 6 },
  'Lagos|Epe':                    { fee: 22_000, deliveryDaysMin: 4, deliveryDaysMax: 6 },

  // Rivers — Port Harcourt LGA cheaper
  'Rivers|Port Harcourt':         { fee: 18_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Rivers|Obio-Akpor':            { fee: 18_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },

  // Kano — Kano Municipal cheaper
  'Kano|Kano Municipal':          { fee: 15_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Kano|Fagge':                   { fee: 15_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },

  // Kaduna — Kaduna North/South cheaper
  'Kaduna|Kaduna North':          { fee: 13_000, deliveryDaysMin: 2, deliveryDaysMax: 4 },
  'Kaduna|Kaduna South':          { fee: 13_000, deliveryDaysMin: 2, deliveryDaysMax: 4 },

  // Enugu — Enugu South/North/East cheaper
  'Enugu|Enugu North':            { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Enugu|Enugu South':            { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
  'Enugu|Enugu East':             { fee: 17_000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
};

// ─── Distance-based pricing tiers ────────────────────────────────────────────
const DISTANCE_BASE_FEE = 2_000;  // NGN — handling / packaging
const DISTANCE_TIERS = [
  { upToKm: 30,   ratePerKm: 200 },  // local (FCT)
  { upToKm: 100,  ratePerKm: 100 },  // near states
  { upToKm: 500,  ratePerKm: 50  },  // mid-range
  { upToKm: Infinity, ratePerKm: 30 }, // far north / remote
];
const DISTANCE_MIN_FEE = 2_500;
const DISTANCE_MAX_FEE = 45_000;

/**
 * Calculate shipping fee from a road distance (km) + subtotal.
 * Used when ORS coordinates are available.
 */
function calculateShippingByDistance(distanceKm, subtotal) {
  if (subtotal >= FREE_THRESHOLD) {
    return { fee: 0, distanceKm, method: 'distance', isFree: true, label: 'Free Delivery',
             deliveryDaysMin: 1, deliveryDaysMax: 7 };
  }

  let fee  = DISTANCE_BASE_FEE;
  let prev = 0;
  for (const tier of DISTANCE_TIERS) {
    const segEnd = Math.min(distanceKm, tier.upToKm);
    if (segEnd <= prev) break;
    fee += (segEnd - prev) * tier.ratePerKm;
    prev = segEnd;
    if (distanceKm <= tier.upToKm) break;
  }

  fee = Math.round(Math.max(DISTANCE_MIN_FEE, Math.min(DISTANCE_MAX_FEE, fee)) / 100) * 100;

  // Delivery day estimate based on road distance
  let daysMin, daysMax;
  if (distanceKm <= 50) {
    daysMin = 1; daysMax = 1;          // same-day / next-day within Abuja metro
  } else if (distanceKm <= 200) {
    daysMin = 1; daysMax = 2;
  } else if (distanceKm <= 500) {
    daysMin = 2; daysMax = 4;
  } else {
    daysMin = 3; daysMax = 6;
  }

  return {
    fee,
    distanceKm: Math.round(distanceKm),
    method: 'distance',
    isFree: false,
    label: `Road delivery (~${Math.round(distanceKm)} km)`,
    deliveryDaysMin: daysMin,
    deliveryDaysMax: daysMax,
  };
}

/**
 * Calculate shipping fee for a given state + LGA + subtotal.
 * @param {string} state  - Nigerian state name
 * @param {string} lga    - Local Government Area name
 * @param {number} subtotal - Cart subtotal in NGN
 * @returns {{ fee: number, zone: string, label: string, deliveryDaysMin: number, deliveryDaysMax: number, isFree: boolean }}
 */
// Normalise any FCT variant to the canonical key used in STATE_ZONES / LGA_OVERRIDES
function normaliseState(state) {
  if (!state) return '';
  const s = state.trim();
  if (/federal capital territory|fct/i.test(s) || /abuja/i.test(s)) return 'FCT - Abuja';
  return s;
}

function calculateShipping(state, lga, subtotal) {
  state = normaliseState(state);

  // Free delivery threshold
  if (subtotal >= FREE_THRESHOLD) {
    return {
      fee: 0,
      zone: 'free',
      label: 'Free Delivery',
      deliveryDaysMin: 1,
      deliveryDaysMax: 7,
      isFree: true,
    };
  }

  if (!state) {
    return { fee: 0, zone: '', label: '', deliveryDaysMin: 0, deliveryDaysMax: 0, isFree: false };
  }

  // Check LGA-level override first
  const lgaKey = `${state}|${lga}`;
  if (lga && LGA_OVERRIDES[lgaKey]) {
    const override = LGA_OVERRIDES[lgaKey];
    const stateZone = STATE_ZONES.find(z => z.states.some(s => s.toLowerCase() === state.toLowerCase()));
    return {
      fee: override.fee,
      zone: stateZone ? stateZone.zone : 'zone_7',
      label: stateZone ? stateZone.label : 'Zone 7 — Remote',
      deliveryDaysMin: override.deliveryDaysMin,
      deliveryDaysMax: override.deliveryDaysMax,
      isFree: false,
    };
  }

  // Fall back to state zone
  const zone = STATE_ZONES.find(z =>
    z.states.some(s => s.toLowerCase() === state.toLowerCase())
  );

  if (zone) {
    return {
      fee: zone.fee,
      zone: zone.zone,
      label: zone.label,
      deliveryDaysMin: zone.deliveryDaysMin,
      deliveryDaysMax: zone.deliveryDaysMax,
      isFree: false,
    };
  }

  // Remote / unknown state
  return {
    fee: 30_000,
    zone: 'zone_7',
    label: 'Zone 7 — Remote',
    deliveryDaysMin: 5,
    deliveryDaysMax: 10,
    isFree: false,
  };
}

module.exports = { calculateShipping, calculateShippingByDistance, FREE_THRESHOLD, STATE_ZONES, LGA_OVERRIDES };
