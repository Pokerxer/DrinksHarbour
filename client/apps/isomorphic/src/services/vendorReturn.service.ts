// services/vendorReturn.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface VendorReturn {
  _id: string;
  returnNumber: string;
  vendor?: string | { _id: string; name?: string; email?: string; phone?: string };
  vendorName: string;
  purchaseOrder?: string | { _id: string; poNumber?: string };
  poNumber?: string;
  vendorBill?: string;
  billNumber?: string;
  currency: string;
  items: ReturnItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  returnDate: string;
  requestedDate?: string;
  shippedDate?: string;
  receivedDate?: string;
  refundedDate?: string;
  reason?: string;
  notes?: string;
  internalNotes?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  returnAddress?: string;
  refundAmount: number;
  refundStatus: string;
  refundMethod?: string;
  refundReference?: string;
  refundDate?: string;
  createdBy?: string | { _id: string; name?: string; email?: string };
  confirmedBy?: string | { _id: string; name?: string; email?: string };
  confirmedAt?: string;
  receivedBy?: string | { _id: string; name?: string; email?: string };
  receivedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReturnItem {
  subProductId?: string;
  subProductName?: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  reason?: string;
  condition?: string;
  taxRate?: number;
}

export const vendorReturnService = {
  async createVendorReturn(
    returnData: any,
    token: string
  ): Promise<{ success: boolean; data: VendorReturn }> {
    const response = await fetch(`${API_URL}/api/vendor-returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(returnData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create vendor return');
    }

    return response.json();
  },

  async getVendorReturn(
    id: string,
    token: string
  ): Promise<{ success: boolean; data: VendorReturn }> {
    const response = await fetch(`${API_URL}/api/vendor-returns/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch vendor return');
    }

    return response.json();
  },

  async getVendorReturns(
    token: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      vendor?: string;
      purchaseOrder?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data: VendorReturn[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
    };
    stats: {
      totalCount: number;
      totalValue: number;
      totalRefunded: number;
      draftCount: number;
      confirmedCount: number;
      refundedCount: number;
      cancelledCount: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.status) queryParams.set('status', params.status);
    if (params.vendor) queryParams.set('vendor', params.vendor);
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);
    if (params.search) queryParams.set('search', params.search);
    if (params.purchaseOrder) queryParams.set('purchaseOrder', params.purchaseOrder);

    const response = await fetch(
      `${API_URL}/api/vendor-returns?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch vendor returns');
    }

    return response.json();
  },

  async updateVendorReturn(
    id: string,
    returnData: any,
    token: string
  ): Promise<{ success: boolean; data: VendorReturn }> {
    const response = await fetch(`${API_URL}/api/vendor-returns/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(returnData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update vendor return');
    }

    return response.json();
  },

  async updateReturnStatus(
    id: string,
    status: string,
    notes?: string,
    token: string
  ): Promise<{ success: boolean; data: VendorReturn }> {
    const response = await fetch(
      `${API_URL}/api/vendor-returns/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update return status');
    }

    return response.json();
  },

  async recordRefund(
    id: string,
    refundData: {
      amount: number;
      method?: string;
      reference?: string;
      notes?: string;
    },
    token: string
  ): Promise<{ success: boolean; data: VendorReturn }> {
    const response = await fetch(
      `${API_URL}/api/vendor-returns/${id}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(refundData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to record refund');
    }

    return response.json();
  },

  async deleteVendorReturn(
    id: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/vendor-returns/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete vendor return');
    }

    return response.json();
  },

  async createReturnFromBill(
    billId: string,
    items: any[],
    reason: string,
    token: string,
    options?: {
      notes?: string;
      returnAddress?: string;
    }
  ): Promise<{ success: boolean; data: VendorReturn }> {
    const response = await fetch(`${API_URL}/api/vendor-returns/from-bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        billId,
        items,
        reason,
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create return from bill');
    }

    return response.json();
  },
};
