// services/inventory.service.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface InventoryMovement {
  _id: string;
  subProduct: string;
  tenant: string;
  product?: any;
  size?: any;
  warehouse?: any;
  type: string;
  category: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reference?: string;
  referenceType?: string;
  relatedOrder?: string;
  unitCost?: number;
  totalCost?: number;
  sellingPrice?: number;
  supplier?: any;
  supplierName?: string;
  batchNumber?: string;
  lotNumber?: string;
  expirationDate?: string;
  manufacturingDate?: string;
  reason?: string;
  notes?: string;
  status: string;
  isVerified: boolean;
  performedBy: any;
  performedAt: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummary {
  subProduct: {
    _id: string;
    sku: string;
    totalStock: number;
    availableStock: number;
    reservedStock: number;
    lowStockThreshold: number;
    stockStatus: string;
  };
  totals: {
    received: number;
    sold: number;
    returned: number;
    adjusted: number;
    damaged: number;
  };
  summary: Array<{
    _id: string;
    totalQuantity: number;
    count: number;
    totalCost?: number;
    totalRevenue?: number;
    totalProfit?: number;
  }>;
  recentMovements: InventoryMovement[];
  stockFlow: Array<{
    _id: {
      date: string;
      category: string;
    };
    totalQuantity: number;
  }>;
}

export interface InventoryValuation {
  totalItems: number;
  totalValue: number;
  totalRetailValue: number;
  potentialProfit: number;
}

export interface LowStockItem {
  _id: string;
  sku: string;
  product: any;
  totalStock: number;
  availableStock: number;
  lowStockThreshold: number;
  stockStatus: string;
  reorderPoint: number;
  reorderQuantity: number;
}

export interface GetMovementsParams {
  subProductId?: string;
  type?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const inventoryService = {
  async createMovement(data: any, token: string) {
    const response = await fetch(`${API_URL}/api/inventory/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create inventory movement');
    }

    return response.json();
  },

  async getMovements(token: string, params?: GetMovementsParams) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${API_URL}/api/inventory/movements${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch inventory movements');
    }

    return response.json();
  },

  async getInventorySummary(subProductId: string, token: string) {
    const response = await fetch(`${API_URL}/api/inventory/summary/${subProductId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch inventory summary');
    }

    return response.json();
  },

  async adjustInventory(subProductId: string, adjustment: number, reason: string, token: string, notes?: string, reference?: string) {
    const response = await fetch(`${API_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        subProductId,
        adjustment,
        reason,
        notes,
        reference,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to adjust inventory');
    }

    return response.json();
  },

  async recordReceived(subProductId: string, quantity: number, token: string, data?: {
    unitCost?: number;
    reference?: string;
    supplierId?: string;
    supplierName?: string;
    batchNumber?: string;
    lotNumber?: string;
    expirationDate?: string;
    notes?: string;
  }) {
    const response = await fetch(`${API_URL}/api/inventory/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        subProductId,
        quantity,
        ...data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to record received goods');
    }

    return response.json();
  },

  async recordReturn(subProductId: string, quantity: number, token: string, data?: {
    reason?: string;
    notes?: string;
    reference?: string;
    orderId?: string;
  }) {
    const response = await fetch(`${API_URL}/api/inventory/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        subProductId,
        quantity,
        ...data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to record return');
    }

    return response.json();
  },

  async cancelMovement(movementId: string, token: string, reason: string) {
    const response = await fetch(`${API_URL}/api/inventory/movements/${movementId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel movement');
    }

    return response.json();
  },

  async getLowStockItems(token: string) {
    const response = await fetch(`${API_URL}/api/inventory/low-stock`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch low stock items');
    }

    return response.json();
  },

  async getInventoryValuation(token: string) {
    const response = await fetch(`${API_URL}/api/inventory/valuation`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch inventory valuation');
    }

    return response.json();
  },
};
