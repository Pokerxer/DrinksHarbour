import { compareKey } from './use-compare';
import type { OfflineProduct } from './offline';
import type { KioskProduct } from './types';

const normalize = (value?: string) => value?.trim().toLowerCase();
const matches = (left?: string, right?: string) =>
  Boolean(normalize(left) && normalize(left) === normalize(right));

export function suggestBottles(product: KioskProduct, catalogue: OfflineProduct[]) {
  const key = compareKey(product);
  const grapes = new Set(product.grapeVarieties?.map(normalize));
  const seen = new Set<string>();
  return catalogue
    .filter((candidate) => {
      if (!candidate.suggestible || candidate.currency !== product.currency ||
          candidate.alcoholic !== product.alcoholic || compareKey(candidate) === key ||
          matches(candidate.name, product.name)) return false;
      if (product.category && candidate.category) return matches(product.category, candidate.category);
      if (product.beverageType && candidate.beverageType) {
        return matches(product.beverageType, candidate.beverageType);
      }
      return true;
    })
    .map((candidate) => ({
      candidate,
      similarity:
        8 * Number(matches(candidate.category, product.category)) +
        4 * Number(matches(candidate.subCategory, product.subCategory)) +
        2 * Number(candidate.grapeVarieties?.some((grape) => grapes.has(normalize(grape))) ?? false) +
        Number(matches(candidate.brand, product.brand)),
      distance: Math.abs(candidate.price - product.price),
    }))
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance ||
      a.candidate.name.localeCompare(b.candidate.name))
    .filter(({ candidate }) => {
      const name = normalize(candidate.name) ?? '';
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}
