import { venueRequest } from './api';
import type {StockMappingInput} from './ingredients';

/**
 * S2 venue-ops contracts (server/routes/venue-ops.routes.js) — the DTOs mirror the
 * server serializers exactly (services/venue/recipes.js, pour-stock.js, waste.js);
 * nothing is inferred or renamed client-side.
 *
 * Waste is recorded server-side through the opened-bottle waste coordination —
 * there is deliberately no POST waste route in S2, only the ledger read.
 */

export type RecipeComponentDTO = { stockMapping?:StockMappingInput; profileId: string; quantity: number; unit: 'count' | 'ml' | 'g' };

export type RecipeVersionDTO = {
  id: string;
  subProductId: string;
  sizeId: string;
  version: number;
  components: RecipeComponentDTO[];
  yieldAssumption: { units: number | null; lossMl: number | null };
  method: string | null;
  /** Projected authoring input in minor units; null means the cost is unknown — never guessed. */
  costMinorPerUnit: number | null;
  effectiveFrom: string | null;
  supersededBy: string | null;
  createdBy: string;
  createdAt: string | null;
};

export type RecipeGroupDTO = { isVenueServing?:boolean;displayName?:string;
  subProductId: string;
  sizeId: string;
  versions: RecipeVersionDTO[];
  activeVersion: RecipeVersionDTO | null;
};

/** Authoring input — the server PUT contract: component refs are `profile` ids; 'l' collapses to 'ml' server-side. */
export type RecipeInput = {
  components: { profile: string; quantity: number; unit: 'count' | 'ml' | 'g' | 'l';stockMapping?:StockMappingInput }[];
  yieldAssumption: { units: number; lossMl?: number };
  method?: string | null;
  costMinorPerUnit?: number | null;
  effectiveFrom?: string | null;
};

export type OpenedBottleDTO = {
  id: string;
  subProductId: string;
  sizeId: string;
  batchAllocation: { batch: string; quantity: number }[];
  contentsMl: number;
  remainingMl: number;
  state: string;
  openedAt: string | null;
};

export type WasteEventDTO = {
  id: string;
  locationId: string;
  consumptionEventId: string | null;
  lineId: string | null;
  reason: string;
  quantity: number;
  unit: string;
  approvedBy: string;
  policyConsentRef: string | null;
  actorId: string;
  createdAt: string | null;
};

export type WasteEventList = { items: WasteEventDTO[]; next: string | null };

// Recipes are tenant-global; the locationId is only the eligibility/context anchor.
export const getRecipes = (token: string, locationId: string) =>
  venueRequest<{ items: RecipeGroupDTO[] }>(token, `/locations/${locationId}/recipes`, 'GET');

// Save = supersede with a new version. `expectedVersion` is the caller's view of the
// current latest version (0 = none); drift fails STATE_CHANGED server-side.
export const saveRecipe = (
  token: string,
  locationId: string,
  subProductId: string,
  body: { sizeId: string; expectedVersion: number; input: RecipeInput },
) => venueRequest<RecipeVersionDTO>(token, `/locations/${locationId}/recipes/${subProductId}`, 'PUT', body);

export const openBottle = (token: string, locationId: string, body: { subProductId: string; sizeId: string }) =>
  venueRequest<OpenedBottleDTO>(token, `/locations/${locationId}/opened-bottles`, 'POST', body);

export const pourOpenedBottle = (token: string, locationId: string, openedBottleId: string, body: { ml: number }) =>
  venueRequest<OpenedBottleDTO>(token, `/locations/${locationId}/opened-bottles/${openedBottleId}/pours`, 'POST', body);

export const getWasteEvents = (token: string, locationId: string, after?: string) =>
  venueRequest<WasteEventList>(token, `/locations/${locationId}/waste${after ? `?after=${encodeURIComponent(after)}` : ''}`, 'GET');
