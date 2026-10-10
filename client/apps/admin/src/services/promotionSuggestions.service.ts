export interface PromotionProduct {
  key: string;
  subProductId: string;
  sizeId: string;
  productName: string;
  sizeName: string;
  sku: string;
  image: string | null;
  units: number;
  available: number;
  quantity: number;
}
export interface PromotionOccasion {
  name: string;
  date: string;
  daysAway: number;
  kind: string;
  sourceUrl?: string;
  family?: string;
  verifiedOn?: string;
}
export interface PromotionSuggestion {
  key: string;
  type: 'combo' | 'occasion' | 'slow_mover';
  title: string;
  products: PromotionProduct[];
  warehouseId: string;
  warehouseName: string;
  confidence: 'strong' | 'emerging' | 'review';
  capacity: number;
  score: number;
  reasoning: string;
  occasion: PromotionOccasion | null;
  evidence: {
    jointBaskets: number;
    basketCount: number;
    support: number;
    lift: number;
    purchaseRate: number;
  } | null;
  pricing: {
    offerPrice: number | null;
    regularPrice?: number;
    discountPercent: number | null;
    marginPercent?: number;
    currency?: string;
    reason: string;
  };
}
export interface PromotionSuggestionPlan {
  suggestions: PromotionSuggestion[];
  occasions: PromotionOccasion[];
  model: string;
  basketCount: number;
  canPrice: boolean;
  truncated: boolean;
  generatedAt: string;
  warehouses: Array<{ _id: string; name: string }>;
  warnings: string[];
  historyStart: string;
  historyEnd: string;
  days: number;
}
export async function promotionSuggestionsRequest(
  token: string,
  query: string,
  signal: AbortSignal
): Promise<PromotionSuggestionPlan> {
  if (!token) throw new Error('Sign in to view promotion suggestions.');
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/reorder/promotion-suggestions?${query}`,
    { signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Unable to load promotion suggestions. Please retry.');
  }
  if (!body || typeof body !== 'object')
    throw new Error('Invalid promotion response.');
  const result = body as {
    success?: boolean;
    message?: string;
    data?: PromotionSuggestionPlan;
  };
  if (!response.ok || result.success !== true)
    throw new Error(result.message || 'Unable to load promotion suggestions.');
  const data = result.data;
  if (
    !data ||
    !Array.isArray(data.suggestions) ||
    !Array.isArray(data.warehouses) ||
    !Array.isArray(data.occasions) ||
    !Array.isArray(data.warnings) ||
    typeof data.model !== 'string' ||
    typeof data.canPrice !== 'boolean' ||
    !Number.isFinite(data.days) ||
    !data.suggestions.every(
      (s) =>
        s &&
        typeof s.key === 'string' &&
        typeof s.title === 'string' &&
        ['combo', 'occasion', 'slow_mover'].includes(s.type) &&
        Array.isArray(s.products) &&
        s.products.every((p) => p && typeof p.productName === 'string') &&
        s.pricing &&
        (s.pricing.offerPrice === null || Number.isFinite(s.pricing.offerPrice))
    )
  )
    throw new Error('Invalid promotion response.');
  return data;
}
