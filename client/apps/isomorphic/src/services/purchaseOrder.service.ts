// services/purchaseOrder.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  vendor?: string;
  vendorName?: string;
  vendorReference?: string;
  currency: string;
  confirmationDate?: string;
  expectedArrival?: string;
  arrivalDate?: string;
  items: POItem[];
  notes?: string;
  status: string;
  tenant?: string;
  createdAt?: string;
  updatedAt?: string;
  // PO/RFQ common fields
  validUntil?: string;
  termsConditions?: string;
  originalPO?: string;
  isBackorder?: boolean;
  // Approval workflow
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  // Lock/Unlock fields
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockReason?: string;
  // Agreement link
  purchaseAgreement?: string;
  agreementType?: 'blanket_order' | 'call_for_tender' | 'none';
}

export interface VendorResponse {
  vendorId?: string;
  vendorName: string;
  quoteDate?: string;
  totalAmount?: number;
  currency?: string;
  items?: {
    subProductId?: string;
    subProductName?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    notes?: string;
  }[];
  notes?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  respondedAt?: string;
}

export interface POItem {
  subProductId: string;
  productName: string;
  sku: string;
  size?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  packPrice: number;
  receivedQty: number;
  type: string;
  uom?: string;
  packagingQty?: number;
  packaging?: string;
  taxRate?: number;
  totalCost?: number;
}

export interface CreatePOResponse {
  success: boolean;
  data: PurchaseOrder;
  message?: string;
}

export const purchaseOrderService = {
  async createPurchaseOrder(
    poData: any,
    token: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(`${API_URL}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(poData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create purchase order');
    }

    return response.json();
  },

  async updatePurchaseOrderStatus(
    id: string,
    status: string,
    token: string,
    receivedItems?: { itemId: string; receivedQty: number }[]
  ): Promise<CreatePOResponse> {
    const body = receivedItems
      ? JSON.stringify({ status, receivedItems })
      : JSON.stringify({ status });

    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || 'Failed to update purchase order status'
      );
    }

    return response.json();
  },

  async generatePurchaseOrderReceipt(
    id: string,
    token: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/receipt`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate receipt');
    }

    return response.json();
  },

  async getPurchaseOrder(id: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(`${API_URL}/api/purchase-orders/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch purchase order');
    }

    return response.json();
  },

  async getPurchaseOrders(token: string, params: any = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `${API_URL}/api/purchase-orders?${queryParams}`
      : `${API_URL}/api/purchase-orders`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Invalid response format from server. Status: ${response.status}`);
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        }
        
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch purchase orders';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network error: Unable to connect to the server. Please check your internet connection and ensure the backend server is running.');
      }
      throw error;
    }
  },

  async deletePurchaseOrder(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/purchase-orders/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete purchase order');
    }

    return response.json();
  },

  async approvePO(id: string, notes?: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve PO');
    }

    return response.json();
  },

  async rejectPO(id: string, notes?: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject PO');
    }

    return response.json();
  },

  async lockPO(id: string, reason?: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to lock PO');
    }

    return response.json();
  },

  async unlockPO(id: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/unlock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to unlock PO');
    }

    return response.json();
  },

  async createBillFromPO(id: string, token: string, options?: {
    billDate?: string;
    dueDate?: string;
    notes?: string;
    billControlPolicy?: 'ordered' | 'received';
  }): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/create-bill`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options || {}),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create bill from PO');
    }

    return response.json();
  },

  async sendPOToVendor(id: string, token: string, email?: string): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/send-to-vendor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send PO to vendor');
    }

    return response.json();
  },
};
