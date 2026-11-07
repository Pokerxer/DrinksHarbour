/** The selling offer defines the size being purchased, not the catalogue default. */
interface VolumeOffer {
  size?: string;
  displayName?: string;
  volumeMl?: number;
}

const validVolume = (value?: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

function labelledVolume(label?: string): number | undefined {
  // Only a single measured container is unambiguous: never read 6 x 70cl as 70cl.
  const match = label?.trim().match(/^(?:(?:bottle|can)\s+)?(\d+(?:\.\d+)?)\s*(ml|cl|l)$/i);
  if (!match) return undefined;
  const factor = { ml: 1, cl: 10, l: 1000 }[match[2].toLowerCase() as 'ml' | 'cl' | 'l'];
  return validVolume(Number(match[1]) * factor);
}

export function resolveOfferVolume(
  offer?: VolumeOffer | null,
  catalogueVolume?: number,
): number | undefined {
  if (!offer) return validVolume(catalogueVolume);
  return labelledVolume(offer.size)
    ?? labelledVolume(offer.displayName)
    ?? validVolume(offer.volumeMl);
}
