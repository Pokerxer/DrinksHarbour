import { readJson, readError } from './response';
// services/reorder.service.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface ReorderRule {
  _id: string;
  tenant: string;
  subProduct: any;
  product?: any;
  size?: any;
  warehouse?: any;
  name: string;
  description?: string;
  triggerType: 'min_quantity' | 'reorder_point' | 'days_of_stock' | 'forecast_based' | 'manual';
  minQuantity: number;
  reorderPoint: number;
  daysOfStock: number;
  forecastDays: number;
  quantityType: 'fixed' | 'days_of_supply' | 'economic_order_quantity' | 'max_level' | 'supplier_moq';
  orderQuantity: number;
  maxStockLevel?: number;
  daysOfSupply: number;
  preferredVendor?: any;
  vendorName?: string;
  leadTimeDays: number;
  unitCost?: number;
  minimumOrderQuantity: number;
  isAutomatic: boolean;
  autoCreatePurchaseOrder: boolean;
  autoApprove: boolean;
  notifyOnTrigger: boolean;
  notifyEmails: string[];
  checkFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  lastCheckedAt?: string;
  nextCheckAt?: string;
  status: 'active' | 'paused' | 'disabled';
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  recentTriggers: Array<{
    triggeredAt: string;
    currentStock: number;
    orderQuantity: number;
    purchaseOrderId?: string;
    status: string;
    notes?: string;
  }>;
  createdBy?: any;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReorderSuggestion {
  subProductId: string;
  sku: string;
  product: any;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  suggestedQuantity: number;
  leadTimeDays: number;
  unitCost: number;
  estimatedCost: number;
  urgency: 'critical' | 'high' | 'normal';
  // Variant identity (DRI-33 contract, emit-only-with-identity per DRI-16/DRI-29
  // precedent). Variant suggestions carry the exact Size: sizeId + the Size
  // code/displayName, plus verbatim colour/option + packaging fields ONLY when
  // the Size actually carries them. SubProduct-aggregate (sizeless/legacy)
  // suggestions keep the exact pre-change payload shape — the UI renders those
  // rows byte-identically.
  sizeId?: string;
  /** Raw Size code of the targeted Size row (variant suggestions only). */
  size?: string | ({ displayName?: string | null; size?: string | null; colorName?: string | null; optionName?: string | null } | null);
  /** Populate-style displayName of the targeted Size row (variant suggestions only). */
  displayName?: string | null;
  /** Defensive alternate identity shape (color/option flat siblings, DRI-16 style). */
  sizeName?: string;
  colorName?: string;
  colorHexCode?: string;
  optionName?: string;
  unitType?: string;
  unitsPerPack?: number;
}

export interface GetRulesParams {
  subProductId?: string;
  status?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateRuleData {
  subProductId: string;
  name: string;
  description?: string;
  triggerType?: string;
  minQuantity?: number;
  reorderPoint?: number;
  daysOfStock?: number;
  quantityType?: string;
  orderQuantity?: number;
  maxStockLevel?: number;
  daysOfSupply?: number;
  vendorName?: string;
  leadTimeDays?: number;
  unitCost?: number;
  minimumOrderQuantity?: number;
  isAutomatic?: boolean;
  autoCreatePurchaseOrder?: boolean;
  notifyOnTrigger?: boolean;
  notifyEmails?: string[];
  checkFrequency?: string;
  notes?: string;
  tags?: string[];
}

export const reorderService = {
  async createRule(data: CreateRuleData, token: string) {
    const response = await fetch(`${API_URL}/api/reorder/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to create reorder rule');
    }

    return readJson(response);
  },

  async getRules(token: string, params?: GetRulesParams) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${API_URL}/api/reorder/rules${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch reorder rules');
    }

    return readJson(response);
  },

  async getRuleById(ruleId: string, token: string) {
    const response = await fetch(`${API_URL}/api/reorder/rules/${ruleId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch reorder rule');
    }

    return readJson(response);
  },

  async updateRule(ruleId: string, data: Partial<CreateRuleData>, token: string) {
    const response = await fetch(`${API_URL}/api/reorder/rules/${ruleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update reorder rule');
    }

    return readJson(response);
  },

  async deleteRule(ruleId: string, token: string) {
    const response = await fetch(`${API_URL}/api/reorder/rules/${ruleId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete reorder rule');
    }

    return readJson(response);
  },

  async triggerRule(ruleId: string, token: string, notes?: string) {
    const response = await fetch(`${API_URL}/api/reorder/rules/${ruleId}/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to trigger reorder rule');
    }

    return readJson(response);
  },

  async checkAllRules(token: string) {
    const response = await fetch(`${API_URL}/api/reorder/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to check reorder rules');
    }

    return readJson(response);
  },

  async getSuggestions(token: string) {
    const response = await fetch(`${API_URL}/api/reorder/suggestions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch reorder suggestions');
    }

    return readJson(response);
  },
};
