import { catalogBusiness } from '@/utils/catalog-business';

import registry from '@/utils/product-size-guidance.json';

const types: Readonly<Record<string, number>> = registry.types;

export function localSizeGuidance(type: string, tenantIndustries?: readonly string[] | null): string[] {
  if (type) return registry.groups[types[type]] ?? [];
  const [industry] = tenantIndustries ?? [];
  if (!industry || tenantIndustries?.length !== 1) return [];
  return [...new Set(Object.entries(types)
    .filter(([candidate]) => catalogBusiness(candidate) === industry)
    .flatMap(([, group]) => registry.groups[group] ?? []))];
}

const manualSizes = ['custom', 'variable'];

export function availableCustomSize(used: readonly string[]): string | undefined {
  const occupied = new Set(used);
  return Array.from({ length: 20 }, (_, index) =>
    index === 0 ? 'custom' : `custom-${index + 1}`
  ).find(code => !occupied.has(code));
}

export function businessSizeOptions(
  options: readonly { value: string; label: string; category: string }[],
  type: string,
  guidance: readonly string[] | undefined,
  tenantIndustries?: readonly string[] | null
) {
  const business = catalogBusiness(type);
  const byCode = new Map(options.map(option => [option.value, option]));
  const presets = type && guidance?.length ? guidance : localSizeGuidance(type, tenantIndustries);
  return [...new Set([...presets, ...manualSizes])].map(value => {
    const existing = byCode.get(value);
    if (existing && (business === 'beverage' || manualSizes.includes(value))) return existing;
    return { value, ...describeSize(value) };
  });
}

function describeSize(value: string) {
  const groups = [
    [/^(?:shot-|bottle-|can-)?(\d+(?:\.\d+)?)(ml|cl|L)$/i, 'Volume', '$1 $2'],
    [/^(\d+(?:\.\d+)?)(g|kg)$/, 'Weight', '$1 $2'],
    [/^pack-(\d+)$/, 'Packs & cases', 'Pack of $1'],
    [/^case-(\d+)$/, 'Packs & cases', 'Case of $1'],
    [/^set-(\d+)$/, 'Singles & sets', 'Set of $1'],
    [/^unit-single$/, 'Singles & sets', 'Single item'],
    [/^screen-(.+)$/, 'Screen sizes', '$1 inches'],
    [/^storage-(\d+(?:\.\d+)?)(gb|tb)$/, 'Storage', '$1 $2'],
    [/^ram-(\d+)gb$/, 'Memory', '$1 GB RAM'],
    [/^battery-(\d+)mah$/, 'Battery capacity', '$1 mAh'],
    [/^power-(\d+)w$/, 'Power', '$1 W'],
    [/^capacity-(.+)l$/, 'Capacity', '$1 L'],
    [/^dimension-(.+)cm$/, 'Dimensions', '$1 cm'],
    [/^length-(.+)m$/, 'Length', '$1 m'],
    [/^bed-(.+)$/, 'Bedding', '$1'],
    [/^ring-us-(.+)$/, 'Ring sizes', 'US ring $1'],
    [/^(eu-apparel|uk-shoe|eu|us-m|us-w|uk|us)-(.+)$/, 'Numbered sizes', '$1 $2'],
    [/^([wl])(\d+)$/, 'Waist & inseam', '$1 $2'],
  ] as const;
  for (const [pattern, category, label] of groups) {
    if (pattern.test(value)) {
      return { label: value.replace(pattern, label).replaceAll('-', ' ').replace(/\b(?:gb|tb)\b/g, unit => unit.toUpperCase()), category };
    }
  }
  return { label: value.replaceAll('-', ' '), category: 'Other sizes' };
}

const namedWineVolumes: Record<string, number> = {
  magnum: 1500, jeroboam: 3000, rehoboam: 4500, methuselah: 6000,
  salmanazar: 9000, balthazar: 12000, nebuchadnezzar: 15000,
};

export function sizePresetMeasurements(value: string) {
  const measuredCode = value
    .replace(/^(shot|bottle|can|capacity|keg|bag|tin|miniature|split|half|standard|nip)-/, '')
    .replace(/^kg-(\d+(?:\.\d+)?)$/, '$1kg');
  const [, amount, unit] = /^(\d+(?:\.\d+)?)(ml|cl|l|g|kg)$/i.exec(measuredCode) || [];
  const measure = unit?.toLowerCase();
  const quantity = Number(amount);
  const namedVolume = namedWineVolumes[value];
  const pack = /^(pack|case|set|box|sampler|teabag)-(\d+)$/.exec(value);
  return {
    unitType: measure === 'g' || measure === 'kg' ? `weight_${measure}`
      : measure ? `volume_${measure}` : namedVolume ? 'volume_ml'
      : pack?.[1] === 'set' ? 'set' : pack?.[1] === 'box' ? 'box'
      : pack?.[1] === 'case' ? 'count_case' : pack ? 'count_pack' : 'count_unit',
    volumeMl: measure === 'ml' ? quantity : measure === 'cl' ? quantity * 10 : measure === 'l' ? quantity * 1000 : namedVolume ?? null,
    weightGrams: measure === 'kg' ? quantity * 1000 : measure === 'g' ? quantity : null,
    unitsPerPack: pack ? Number(pack[2]) : 1,
    packaging: /^(pack|case)-/.test(value) ? value : undefined,
  };
}
