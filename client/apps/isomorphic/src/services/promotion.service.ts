// services/promotion.service.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export type PromotionType =
  | 'percentage_discount'
  | 'fixed_discount'
  | 'buy_x_get_y'
  | 'bundle'
  | 'flash_sale'
  | 'loyalty'
  | 'seasonal'
  | 'clearance'
  | 'first_purchase'
  | 'free_shipping'
  | 'gift_with_purchase';

export type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'cancelled';

export type CustomerEligibility = 'all' | 'new_customers' | 'returning_customers' | 'loyalty_members' | 'specific_tiers';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';

export interface BundleItem {
  subProduct: string;
  size?: string;
  sizeName?: string;
  quantity: number;
  required?: boolean;
}

export interface RecurringSchedule {
  enabled: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
}

export interface DisplayBanner {
  enabled: boolean;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  headline?: string;
  subheadline?: string;
}

export interface Badge {
  enabled: boolean;
  text?: string;
  color?: string;
  backgroundColor?: string;
}

export interface PromotionAnalytics {
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  averageOrderValue: number;
  totalDiscount: number;
}

export interface Promotion {
  _id: string;
  tenant: string;
  name: string;
  slug?: string;
  description?: string;
  code?: string;
  type: PromotionType;
  discountValue: number;
  discountType: 'percentage' | 'fixed';
  maxDiscountAmount?: number;
  minPurchaseAmount?: number;
  minQuantity?: number;
  // Buy X Get Y
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercentage?: number;
  // Bundle
  bundleItems?: BundleItem[];
  bundlePrice?: number;
  // Targeting
  applyTo: 'all' | 'specific_products' | 'specific_categories' | 'specific_brands';
  subProducts?: any[];
  sizes?: any[];
  sizeNames?: string[];
  categories?: any[];
  brands?: any[];
  excludedSubProducts?: string[];
  excludedSizes?: string[];
  // Scheduling
  startDate: string;
  endDate?: string;
  isScheduled?: boolean;
  recurringSchedule?: RecurringSchedule;
  // Usage limits
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  currentUsageCount: number;
  remainingQuantity?: number;
  // Customer targeting
  customerEligibility: CustomerEligibility;
  loyaltyTiers?: LoyaltyTier[];
  specificCustomers?: string[];
  // Stacking
  stackable: boolean;
  stackableWith?: string[];
  excludeFromStacking?: string[];
  priority: number;
  // Display
  displayBanner?: DisplayBanner;
  badge?: Badge;
  showCountdown?: boolean;
  showRemainingStock?: boolean;
  highlightOnProductPage?: boolean;
  // Status
  status: PromotionStatus;
  isActive: boolean;
  autoActivate?: boolean;
  autoDeactivate?: boolean;
  // Analytics
  analytics: PromotionAnalytics;
  // Metadata
  createdBy?: any;
  updatedBy?: any;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GetPromotionsParams {
  type?: PromotionType;
  status?: PromotionStatus;
  isActive?: boolean;
  applyTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePromotionData {
  name: string;
  description?: string;
  code?: string;
  type: PromotionType;
  discountValue?: number;
  discountType?: 'percentage' | 'fixed';
  maxDiscountAmount?: number;
  minPurchaseAmount?: number;
  minQuantity?: number;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercentage?: number;
  bundleItems?: BundleItem[];
  bundlePrice?: number;
  applyTo?: string;
  subProducts?: string[];
  sizes?: string[];
  sizeNames?: string[];
  categories?: string[];
  brands?: string[];
  excludedSubProducts?: string[];
  excludedSizes?: string[];
  startDate?: string;
  endDate?: string;
  isScheduled?: boolean;
  recurringSchedule?: RecurringSchedule;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  remainingQuantity?: number;
  customerEligibility?: CustomerEligibility;
  loyaltyTiers?: LoyaltyTier[];
  stackable?: boolean;
  stackableWith?: string[];
  priority?: number;
  displayBanner?: DisplayBanner;
  badge?: Badge;
  showCountdown?: boolean;
  showRemainingStock?: boolean;
  highlightOnProductPage?: boolean;
  status?: PromotionStatus;
  isActive?: boolean;
  autoActivate?: boolean;
  autoDeactivate?: boolean;
  notes?: string;
  tags?: string[];
}

export interface DiscountResult {
  originalPrice: number;
  finalPrice: number;
  discount: number;
  appliedPromotions: Array<{
    promotionId: string;
    name: string;
    type: PromotionType;
    discount: number;
  }>;
}

export interface PromotionStats {
  counts: {
    total: number;
    active: number;
    scheduled: number;
    expired: number;
  };
  performance: {
    totalRevenue: number;
    totalDiscount: number;
    totalConversions: number;
    totalViews: number;
    conversionRate: number | string;
  };
  topPerformers: Array<{
    _id: string;
    name: string;
    type: PromotionType;
    analytics: PromotionAnalytics;
  }>;
}

// ════════════════════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════════════════════

export const promotionService = {
  /**
   * Create a new promotion
   */
  async createPromotion(data: CreatePromotionData, token: string) {
    const response = await fetch(`${API_URL}/api/promotions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create promotion');
    }

    return response.json();
  },

  /**
   * Get all promotions with optional filters
   */
  async getPromotions(token: string, params?: GetPromotionsParams) {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const baseUrl = API_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/promotions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    console.log(`Fetching promotions: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to fetch promotions';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
          // Ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      console.error('Fetch error:', error);
      throw new Error(error.message || 'Network error occurred');
    }
  },

  /**
   * Get a single promotion by ID
   */
  async getPromotionById(promotionId: string, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch promotion');
    }

    return response.json();
  },

  /**
   * Get a promotion by code
   */
  async getPromotionByCode(code: string, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/code/${encodeURIComponent(code)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch promotion by code');
    }

    return response.json();
  },

  /**
   * Update a promotion
   */
  async updatePromotion(promotionId: string, data: Partial<CreatePromotionData>, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update promotion');
    }

    return response.json();
  },

  /**
   * Delete a promotion
   */
  async deletePromotion(promotionId: string, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete promotion');
    }

    return response.json();
  },

  /**
   * Activate a promotion
   */
  async activatePromotion(promotionId: string, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to activate promotion');
    }

    return response.json();
  },

  /**
   * Deactivate a promotion
   */
  async deactivatePromotion(promotionId: string, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to deactivate promotion');
    }

    return response.json();
  },

  /**
   * Duplicate a promotion
   */
  async duplicatePromotion(promotionId: string, token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to duplicate promotion');
    }

    return response.json();
  },

  /**
   * Get active promotions for a subproduct
   */
  async getPromotionsForSubProduct(subProductId: string, token: string, sizeId?: string) {
    const queryParams = sizeId ? `?sizeId=${sizeId}` : '';
    const response = await fetch(`${API_URL}/api/promotions/subproduct/${subProductId}${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch promotions for subproduct');
    }

    return response.json();
  },

  /**
   * Apply promotion to subproducts
   */
  async applyToSubProducts(promotionId: string, subProductIds: string[], token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subProductIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to apply promotion to products');
    }

    return response.json();
  },

  /**
   * Remove subproducts from promotion
   */
  async removeSubProducts(promotionId: string, subProductIds: string[], token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}/remove-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subProductIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove products from promotion');
    }

    return response.json();
  },

  /**
   * Apply promotion to sizes
   */
  async applyToSizes(promotionId: string, sizeIds: string[], token: string) {
    const response = await fetch(`${API_URL}/api/promotions/${promotionId}/apply-sizes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sizeIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to apply promotion to sizes');
    }

    return response.json();
  },

  /**
   * Calculate discount for a cart item
   */
  async calculateDiscount(
    token: string,
    subProductId: string,
    originalPrice: number,
    quantity?: number,
    sizeId?: string,
    customerId?: string
  ): Promise<{ success: boolean; data: DiscountResult }> {
    const response = await fetch(`${API_URL}/api/promotions/calculate-discount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subProductId,
        sizeId,
        originalPrice,
        quantity: quantity || 1,
        customerId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to calculate discount');
    }

    return response.json();
  },

  /**
   * Validate a promotion code
   */
  async validateCode(
    code: string,
    token: string,
    subProductId?: string,
    sizeId?: string,
    amount?: number
  ) {
    const response = await fetch(`${API_URL}/api/promotions/validate-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, subProductId, sizeId, amount }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid promotion code');
    }

    return response.json();
  },

  /**
   * Get promotion statistics
   */
  async getPromotionStats(token: string): Promise<{ success: boolean; data: PromotionStats }> {
    const response = await fetch(`${API_URL}/api/promotions/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch promotion stats');
    }

    return response.json();
  },
};
