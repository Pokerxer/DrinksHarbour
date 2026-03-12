// services/warehouse.service.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface Warehouse {
  _id: string;
  tenant: string;
  subProduct?: string;
  product?: any;
  location: string;
  locationType: string;
  zone?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  capacity: number;
  currentQuantity: number;
  reservedQuantity: number;
  condition?: string;
  temperature?: number;
  humidityLevel?: number;
  isLightSensitive: boolean;
  minStockLevel: number;
  maxStockLevel: number;
  reorderAlert: boolean;
  trackExpiration: boolean;
  expirationWarningDays: number;
  binManagement: string;
  pickPriority: number;
  pickZone?: string;
  pickPath?: string;
  isAccessible: boolean;
  accessNotes?: string;
  notes?: string;
  status: string;
  isActive: boolean;
  createdBy: any;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInventory {
  warehouse: Warehouse;
  movements: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface GetWarehousesParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  locationType?: string;
  status?: string;
  isActive?: boolean;
  subProductId?: string;
}

export const warehouseService = {
  async createWarehouse(data: any, token: string) {
    const response = await fetch(`${API_URL}/api/warehouses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create warehouse');
    }

    return response.json();
  },

  async getWarehouses(token: string, params?: GetWarehousesParams) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${API_URL}/api/warehouses${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch warehouses');
    }

    return response.json();
  },

  async getWarehouseById(warehouseId: string, token: string) {
    const response = await fetch(`${API_URL}/api/warehouses/${warehouseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch warehouse');
    }

    return response.json();
  },

  async updateWarehouse(warehouseId: string, data: any, token: string) {
    const response = await fetch(`${API_URL}/api/warehouses/${warehouseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update warehouse');
    }

    return response.json();
  },

  async deleteWarehouse(warehouseId: string, token: string) {
    const response = await fetch(`${API_URL}/api/warehouses/${warehouseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete warehouse');
    }

    return response.json();
  },

  async getWarehouseInventory(warehouseId: string, token: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${API_URL}/api/warehouses/${warehouseId}/inventory${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch warehouse inventory');
    }

    return response.json();
  },

  async adjustWarehouseStock(warehouseId: string, quantity: number, type: string, token: string, notes?: string) {
    const response = await fetch(`${API_URL}/api/warehouses/${warehouseId}/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ quantity, type, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to adjust warehouse stock');
    }

    return response.json();
  },

  async getLowStockWarehouses(token: string) {
    const response = await fetch(`${API_URL}/api/warehouses/low-stock`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch low stock warehouses');
    }

    return response.json();
  },

  async getCapacityUtilization(token: string) {
    const response = await fetch(`${API_URL}/api/warehouses/capacity-utilization`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch capacity utilization');
    }

    return response.json();
  },

  async transferStock(data: {
    subProductId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    quantity: number;
    notes?: string;
    reference?: string;
  }, token: string) {
    const response = await fetch(`${API_URL}/api/inventory/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to transfer stock');
    }

    return response.json();
  },
};
