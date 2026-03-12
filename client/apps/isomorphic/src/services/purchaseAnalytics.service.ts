// services/purchaseAnalytics.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PurchaseAnalyticsSummary {
  totalPOs: number;
  totalAmount: number;
  statusBreakdown: {
    draft: number;
    confirmed: number;
    received: number;
    validated: number;
    cancelled: number;
  };
  approvalBreakdown: {
    pending: number;
    approved: number;
    rejected: number;
  };
  topVendors: {
    name: string;
    count: number;
    amount: number;
  }[];
  monthlyTrend: {
    month: string;
    count: number;
    amount: number;
  }[];
  pendingApprovals: number;
  sizeBreakdown: {
    sizeName: string;
    totalQuantity: number;
    totalAmount: number;
    orderCount: number;
  }[];
  topProducts: {
    productName: string;
    sizeName: string;
    totalQuantity: number;
    totalAmount: number;
    orderCount: number;
  }[];
}

export interface VendorAnalytics {
  vendorName: string;
  totalOrders: number;
  totalAmount: number;
  totalQuantity: number;
  validated: number;
  pending: number;
  sizeBreakdown: {
    sizeName: string;
    quantity: number;
    amount: number;
  }[];
  productBreakdown: {
    productName: string;
    quantity: number;
    amount: number;
  }[];
}

export const purchaseAnalyticsService = {
  async getSummary(
    token: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: string;
    } = {}
  ): Promise<{ success: boolean; data: PurchaseAnalyticsSummary }> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);
    if (params.period) queryParams.set('period', params.period);

    const response = await fetch(
      `${API_URL}/api/purchase-orders/analytics/summary?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch purchase analytics');
    }

    return response.json();
  },

  async getByVendor(
    token: string,
    params: {
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ success: boolean; data: VendorAnalytics[] }> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);

    const response = await fetch(
      `${API_URL}/api/purchase-orders/analytics/by-vendor?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch vendor analytics');
    }

    return response.json();
  },
};
