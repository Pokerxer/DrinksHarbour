'use strict';

const codes = (values, prefix = '', suffix = '') => values.map(value => `${prefix}${value}${suffix}`);

const groups = {
  beautyVolume: codes([1, 1.5, 2, 3, 5, 7.5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 80, 90, 100, 120, 125, 150, 175, 180, 200, 225, 250, 300, 350, 400, 450, 473, 500, 600, 750, 1000], '', 'ml'),
  beautyWeight: codes([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25, 30, 40, 45, 50, 60, 75, 80, 90, 100, 120, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500], '', 'g'),
  beautyCount: ['unit-single', ...codes([2, 4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30, 32, 40, 48, 50, 60, 64, 72, 80, 90, 100, 120, 150, 200], 'pack-')],
  sets: codes([2, 3, 4, 5, 6, 8, 10, 12, 16, 24], 'set-'),
  bulk: [...codes([25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750], '', 'g'), ...codes([0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50], '', 'kg')],
  liquid: [...codes([125, 150, 200, 250, 300, 330, 355, 375, 400, 440, 500, 600, 700, 750, 950], '', 'ml'), ...codes([1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 4.5, 5, 10, 15, 20, 25], '', 'L')],
  cases: [...codes([4, 6, 8, 10, 12, 15, 18, 20, 24, 30, 36, 48, 50, 60, 72, 100, 120, 144], 'case-'), ...codes([6, 12, 24, 48, 50, 100, 150, 200, 250, 500, 1000], 'pack-')],
  bedding: ['bed-cot', 'bed-single', 'bed-twin-xl', 'bed-double', 'bed-queen', 'bed-king', 'bed-super-king', 'bed-california-king'],
  capacity: [...codes([0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 240], 'capacity-', 'l')],
  dimensions: codes([10, 15, 20, 22, 24, 25, 26, 28, 30, 32, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100, 120, 150, 160, 180, 200, 220, 240, 250, 300], 'dimension-', 'cm'),
  alpha: ['xxs', '7xl', '8xl', 'petite', 'tall'],
  dress: [...codes([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32], 'uk-'), ...codes([30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60], 'eu-apparel-'), ...codes(['00', 20, 22, 24, 26, 28, 30, 32], 'us-')],
  waist: [...codes([22, 23, 24, 25, 26, 27, 29, 31, 33, 35, 37, 39, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60], 'w'), ...codes([24, 26, 27, 28, 29, 31, 33, 35, 38, 40], 'l')],
  kids: ['newborn', 'baby-0-3m', 'baby-3-6m', 'baby-6-9m', 'baby-9-12m', 'baby-12-18m', 'baby-18-24m', 'kids-14-15', 'kids-16-17', ...codes([92, 98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164, 170, 176], 'kids-', 'cm')],
  shoes: [...codes(Array.from({ length: 33 }, (_, index) => index + 18), 'eu-'), ...codes(Array.from({ length: 27 }, (_, index) => (index + 4) / 2), 'uk-shoe-'), ...codes([6.5, 7.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14, 15, 16, 17, 18], 'us-m-'), ...codes([4, 4.5, 5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13, 14, 15, 16], 'us-w-')],
  rings: [...codes([3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15], 'ring-us-')],
  storage: [...codes([4, 8, 32, 48, 64, 96, 128, 256, 512], 'storage-', 'gb'), ...codes([1.5, 3, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 30], 'storage-', 'tb')],
  ram: codes([2, 6, 12, 18, 24, 36, 48, 96, 128, 192, 256], 'ram-', 'gb'),
  tv: codes([19, 22, 27, 28, 34, 38, 40, 42, 48, 49, 58, 70, 77, 83, 86, 98, 100, 110, 115], 'screen-'),
  phoneScreen: codes([4, 4.7, 5, 5.4, 5.5, 5.8, 6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.6, 8], 'screen-'),
  laptopScreen: codes([11.6, 12, 13.6, 14.5, 15.3, 16.1, 17, 18.4], 'screen-'),
  tabletScreen: codes([8, 9.7, 10, 11.6, 12, 13.6, 14.5], 'screen-'),
  battery: codes([2000, 3000, 4000, 6000, 8000, 12000, 15000, 18000, 24000, 25000, 27000, 30000, 40000, 50000, 60000], 'battery-', 'mah'),
  power: codes([5, 10, 12, 15, 18, 20, 25, 30, 33, 45, 60, 65, 67, 90, 100, 120, 140, 150, 180, 200, 240, 300, 500, 600, 1000, 1500, 2000], 'power-', 'w'),
  cable: codes([0.15, 0.25, 0.3, 0.5, 1, 1.2, 1.5, 1.8, 2, 2.5, 3, 5, 7.5, 10, 15, 20, 25, 30, 50], 'length-', 'm'),
  cigars: codes([3, 4, 6, 8, 12, 15, 16, 18, 30, 40], 'box-'),
};

const byType = {
  beauty_skincare: ['beautyVolume', 'beautyWeight', 'beautyCount', 'sets'],
  beauty_makeup: ['beautyVolume', 'beautyWeight', 'beautyCount', 'sets'],
  beauty_hair: ['beautyVolume', 'beautyWeight', 'beautyCount', 'sets'],
  beauty_fragrance: ['beautyVolume', 'sets'],
  beauty_nails: ['beautyVolume', 'beautyWeight', 'beautyCount', 'sets'],
  beauty_tool: ['beautyCount', 'sets'],
  beauty_hygiene: ['beautyVolume', 'beautyWeight', 'beautyCount', 'sets'],
  home_kitchen: ['capacity', 'dimensions', 'sets'],
  home_cookware: ['capacity', 'dimensions', 'sets'],
  home_decor: ['dimensions', 'sets'],
  home_furniture: ['dimensions', 'bedding'],
  home_bedding: ['bedding', 'dimensions', 'sets'],
  home_storage: ['capacity', 'dimensions', 'sets'],
  home_cleaning: ['liquid', 'bulk', 'cases'],
  home_small_appliance: ['capacity', 'power'],
  home_lighting: ['power', 'dimensions'],
  home_bath: ['dimensions', 'capacity', 'sets'],
  home_garden: ['dimensions', 'capacity', 'bulk'],
  fashion_top: ['alpha', 'dress'],
  fashion_dress: ['alpha', 'dress'],
  fashion_bottom: ['alpha', 'dress', 'waist'],
  fashion_outerwear: ['alpha', 'dress'],
  fashion_innerwear: ['alpha', 'dress', 'sets'],
  fashion_shoes: ['shoes'],
  fashion_kids: ['kids', 'alpha'],
  fashion_jewellery: ['rings', 'dimensions', 'sets'],
  fashion_bag: ['capacity', 'dimensions'],
  fashion_accessory: ['dimensions', 'sets'],
  fashion_watch: ['dimensions'],
  electronics_phone: ['storage', 'ram', 'phoneScreen'],
  electronics_tablet: ['storage', 'ram', 'tabletScreen'],
  electronics_laptop: ['storage', 'ram', 'laptopScreen'],
  electronics_desktop: ['storage', 'ram', 'power'],
  electronics_storage: ['storage'],
  electronics_tv_display: ['tv'],
  electronics_power: ['battery', 'power', 'cable'],
  electronics_computer_accessory: ['cable', 'dimensions'],
  electronics_networking: ['cable'],
  electronics_audio: ['cable', 'power'],
  electronics_gaming: ['storage', 'ram'],
  electronics_camera: ['storage', 'battery'],
  electronics_wearable: ['dimensions', 'storage'],
  electronics_printer: ['dimensions'],
  foodservice_disposables: ['cases', 'capacity', 'dimensions'],
  foodservice_kitchen_smallware: ['dimensions', 'capacity', 'sets'],
  foodservice_tabletop_bar: ['dimensions', 'capacity', 'sets'],
  foodservice_equipment: ['capacity', 'power'],
  foodservice_janitorial: ['cases', 'liquid', 'bulk'],
  hospitality_cigar: ['cigars'],
  hospitality_shisha_flavour: ['bulk'],
  hospitality_charcoal: ['bulk'],
  hospitality_shisha_kit: ['dimensions', 'sets'],
  hospitality_shisha_accessory: ['dimensions', 'sets'],
  hospitality_cigar_accessory: ['dimensions', 'sets'],
  hospitality_cigar_storage: ['dimensions', 'capacity'],
  hospitality_venue_apparel: ['alpha', 'dress'],
  hospitality_venue_drinkware: ['capacity', 'sets', 'cases'],
  hospitality_venue_gift_pack: ['sets', 'cases'],
};

function additionalSizePresets(type, beverageFamily) {
  const selected = byType[type];
  if (selected) return selected.flatMap(group => groups[group]);
  if (type?.startsWith('foodservice_')) {
    const liquid = ['foodservice_dairy', 'foodservice_condiment', 'foodservice_cleaning'].includes(type);
    return [...groups.bulk, ...groups.cases, ...(liquid ? groups.liquid : [])];
  }
  if (beverageFamily === 'hot') return [...groups.bulk, ...groups.cases];
  if (beverageFamily === 'beer') return ['keg-5L', 'keg-10L', 'keg-20L', 'keg-30L', 'keg-50L', ...groups.cases];
  if (beverageFamily === 'wine') return groups.cases;
  if (beverageFamily === 'spirit') return ['5cl', '10cl', '20cl', '35cl', '75cl', '1.75L', '3L', ...groups.cases];
  if (beverageFamily) return [...groups.liquid, ...groups.cases];
  return [];
}

const extraSizeCodes = [
  ...new Set(Object.values(groups).flat()),
  ...codes(Array.from({ length: 19 }, (_, index) => index + 2), 'custom-'),
  'split-187ml', 'half-375ml', 'standard-750ml', 'magnum', 'jeroboam',
  'rehoboam', 'methuselah', 'salmanazar', 'balthazar', 'nebuchadnezzar', 'kg-0.25', 'unit-pair', 'keg-10L',
];

module.exports = { additionalSizePresets, extraSizeCodes };
