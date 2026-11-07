import { venueRequest } from './api';
import { collectCataloguePages } from './catalog-pages';
export type StockMappingInput = {
  sourceSubProductId: string;
  sourceSizeId: string;
  sourceLocationId: string;
  contentQuantity: {
    amountScaled: number;
    scale: 1 | 100;
    unit: 'count' | 'g' | 'ml';
  };
};
export type IngredientProfile = {
  id: string;
  subProductId: string;
  name: string;
  dimension: 'count' | 'mass' | 'volume';
  gramsPerMl: number | null;
  perishable: boolean | null;
  allergenSource: string[];
  stockForms: { id: string; name: string }[];
};
export const getIngredientProfiles = (token: string, locationId: string) =>
  collectCataloguePages<IngredientProfile>(
    token,
    `/locations/${locationId}/ingredient-profiles`,
  );
export const getIngredientCandidates = (token: string, locationId: string) =>
  collectCataloguePages<{ id: string; name: string }>(
    token,
    `/locations/${locationId}/ingredient-candidates`,
  );
export const createIngredientProfile = (
  token: string,
  locationId: string,
  input: {
    subProductId: string;
    dimension: 'count' | 'mass' | 'volume';
    perishable: boolean;
    allergenSource: string[];
    gramsPerMl?: number;
  },
) =>
  venueRequest<{ id: string; version: number }>(
    token,
    `/locations/${locationId}/ingredient-profiles`,
    'POST',
    { input, expectedVersion: 0 },
  );
