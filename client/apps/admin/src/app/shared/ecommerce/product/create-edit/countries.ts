// Curated ecommerce sourcing dictionary for the originCountry input.
// Extends the legacy `countryFlags` alias map (below) into full
// { name, flag } entries: name is the exact free-text value stored on
// originCountry, flag powers the badge. Existing beverage-country keys stay
// intact — this file is additive; wine sub-flows keep free-text typing.
export interface SourcingCountry {
  name: string;
  flag: string;
}

export const SOURCING_COUNTRIES: ReadonlyArray<SourcingCountry> = [
  // West & East Africa — local supply, trade partners
  { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'Ghana', flag: '🇬🇭' },
  { name: 'Kenya', flag: '🇰🇪' },
  { name: 'South Africa', flag: '🇿🇦' },
  { name: 'Egypt', flag: '🇪🇬' },
  { name: 'Morocco', flag: '🇲🇦' },
  { name: 'Senegal', flag: '🇸🇳' },
  { name: 'Ivory Coast', flag: '🇨🇮' },
  { name: 'Tanzania', flag: '🇹🇿' },
  { name: 'Ethiopia', flag: '🇪🇹' },

  // Europe & British Isles (regional keys preserved alongside 'United Kingdom')
  { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { name: 'Ireland', flag: '🇮🇪' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Italy', flag: '🇮🇹' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'Netherlands', flag: '🇳🇱' },
  { name: 'Belgium', flag: '🇧🇪' },
  { name: 'Switzerland', flag: '🇨🇭' },
  { name: 'Austria', flag: '🇦🇹' },
  { name: 'Poland', flag: '🇵🇱' },
  { name: 'Czechia', flag: '🇨🇿' },
  { name: 'Romania', flag: '🇷🇴' },
  { name: 'Greece', flag: '🇬🇷' },
  { name: 'Turkey', flag: '🇹🇷' },
  { name: 'Sweden', flag: '🇸🇪' },
  { name: 'Norway', flag: '🇳🇴' },
  { name: 'Denmark', flag: '🇩🇰' },
  { name: 'Finland', flag: '🇫🇮' },

  // Middle East
  { name: 'UAE', flag: '🇦🇪' },
  { name: 'Saudi Arabia', flag: '🇸🇦' },
  { name: 'Qatar', flag: '🇶🇦' },
  { name: 'Israel', flag: '🇮🇱' },
  { name: 'Lebanon', flag: '🇱🇧' },
  { name: 'Jordan', flag: '🇯🇴' },

  // Asia
  { name: 'China', flag: '🇨🇳' },
  { name: 'Hong Kong', flag: '🇭🇰' },
  { name: 'Taiwan', flag: '🇹🇼' },
  { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'India', flag: '🇮🇳' },
  { name: 'Vietnam', flag: '🇻🇳' },
  { name: 'Thailand', flag: '🇹🇭' },
  { name: 'Indonesia', flag: '🇮🇩' },
  { name: 'Malaysia', flag: '🇲🇾' },
  { name: 'Philippines', flag: '🇵🇭' },
  { name: 'Bangladesh', flag: '🇧🇩' },
  { name: 'Pakistan', flag: '🇵🇰' },
  { name: 'Sri Lanka', flag: '🇱🇰' },
  { name: 'Singapore', flag: '🇸🇬' },

  // Americas
  { name: 'United States', flag: '🇺🇸' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Mexico', flag: '🇲🇽' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Chile', flag: '🇨🇱' },
  { name: 'Peru', flag: '🇵🇪' },
  { name: 'Colombia', flag: '🇨🇴' },

  // Oceania
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'New Zealand', flag: '🇳🇿' },
];

// Flag lookup for originCountry values: first the curated sourcing dictionary
// (keyed by name), then the legacy lowercase alias map so historic
// beverages keep their flags.
const SOURCING_FLAG_BY_NAME = new Map(
  SOURCING_COUNTRIES.map((country) => [country.name, country.flag] as const)
);

export const getSourceCountryFlag = (
  rawName: string
): string => {
  if (!rawName) return '🌍';
  const trimmed = rawName.trim().toLowerCase();
  const direct = SOURCING_COUNTRIES.find(
    (country) => country.name.toLowerCase() === trimmed
  );
  if (direct) return direct.flag;
  return legacyCountryFlags[trimmed] || '🌍';
};

export const SOURCING_COUNTRY_NAMES: ReadonlyArray<string> =
  SOURCING_COUNTRIES.map((country) => country.name);

// ── Legacy alias map (preserved verbatim from product-origin.tsx) ───────────
// Keys are the historic alias spellings used by beverage data; kept so older
// records still resolve a flag. Do not extend: use SOURCING_COUNTRIES.
const legacyCountryFlags: Record<string, string> = {
  scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  ireland: '🇮🇪',
  usa: '🇺🇸',
  canada: '🇨🇦',
  japan: '🇯🇵',
  france: '🇫🇷',
  italy: '🇮🇹',
  spain: '🇪🇸',
  germany: '🇩🇪',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  india: '🇮🇳',
  australia: '🇦🇺',
  mexico: '🇲🇽',
  'new_zealand': '🇳🇿',
  argentina: '🇦🇷',
  chile: '🇨🇱',
  'south_africa': '🇿🇦',
  portugal: '🇵🇹',
  netherlands: '🇳🇱',
  belgium: '🇧🇪',
  sweden: '🇸🇪',
  denmark: '🇩🇰',
  norway: '🇳🇴',
  finland: '🇫🇮',
  poland: '🇵🇱',
  russia: '🇷🇺',
  china: '🇨🇳',
  taiwan: '🇹🇼',
  brazil: '🇧🇷',
  cuba: '🇨🇺',
  jamaica: '🇯🇲',
  barbados: '🇧🇧',
  guyana: '🇬🇾',
};

export { legacyCountryFlags as countryFlags };
