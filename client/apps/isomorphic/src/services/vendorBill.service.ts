// services/vendorBill.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface VendorBill {
  _id: string;
  billNumber: string;
  vendor?: string;
  vendorName: string;
  purchaseOrder?: string;
  currency: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  billDate: string;
  dueDate?: string;
  status: 'draft' | 'confirmed' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  matchingStatus: 'pending' | 'matched' | 'mismatch' | 'overreceived' | 'underreceived';
  matchingNotes?: string;
  payments: Payment[];
  paidAmount: number;
  notes?: string;
  terms?: string;
  createdAt?: string;
  // Enhanced 3-way matching
  shouldBePaid?: 'yes' | 'no' | 'exception' | 'pending';
  poOrderedQty?: number;
  poReceivedQty?: number;
  billQty?: number;
  matchingDetails?: {
    priceMatch: boolean;
    quantityMatch: boolean;
    receivedMatch: boolean;
    poTotal: number;
    billTotal: number;
    receivedTotal: number;
    variance: number;
    varianceReason: string;
    itemComparisons?: {
      key: string;
      subProductName: string;
      sizeName?: string;
      status: string;
      message: string;
      billQty: number;
      billPrice: number;
      billAmount: number;
      poOrderedQty: number;
      poOrderedPrice: number;
      poReceivedQty: number;
      qtyDiff?: number;
      priceDiff?: number;
    }[];
    sizeBreakdown?: {
      sizeName: string;
      billQty: number;
      billAmount: number;
      poOrderedQty: number;
      poOrderedAmount: number;
      poReceivedQty: number;
      poReceivedAmount: number;
    };
  };
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: string;
  validatedBy?: string;
  validatedAt?: string;
  billControlPolicy?: 'ordered' | 'received';
}

export interface BillItem {
  subProductId?: string;
  subProductName?: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface Payment {
  amount: number;
  date: string;
  method?: string;
  reference?: string;
  notes?: string;
}

export const vendorBillService = {
  async createVendorBill(
    billData: any,
    token: string
  ): Promise<{ success: boolean; data: VendorBill }> {
    const response = await fetch(`${API_URL}/api/vendor-bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(billData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create vendor bill');
    }

    return response.json();
  },

  async getVendorBill(
    id: string,
    token: string
  ): Promise<{ success: boolean; data: VendorBill }> {
    const response = await fetch(`${API_URL}/api/vendor-bills/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch vendor bill');
    }

    return response.json();
  },

  async getVendorBills(
    token: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      vendor?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data: VendorBill[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.status) queryParams.set('status', params.status);
    if (params.vendor) queryParams.set('vendor', params.vendor);
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);

    const response = await fetch(
      `${API_URL}/api/vendor-bills?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch vendor bills');
    }

    return response.json();
  },

  async updateVendorBill(
    id: string,
    billData: any,
    token: string
  ): Promise<{ success: boolean; data: VendorBill }> {
    const response = await fetch(`${API_URL}/api/vendor-bills/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(billData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update vendor bill');
    }

    return response.json();
  },

  async deleteVendorBill(
    id: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/vendor-bills/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete vendor bill');
    }

    return response.json();
  },

  async recordPayment(
    id: string,
    paymentData: {
      amount?: number;
      date?: string;
      method?: string;
      reference?: string;
      notes?: string;
    },
    token: string
  ): Promise<{ success: boolean; data: VendorBill }> {
    const response = await fetch(
      `${API_URL}/api/vendor-bills/${id}/pay`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(paymentData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to record payment');
    }

    return response.json();
  },

  async validateBill(
    id: string,
    token: string,
    override?: string,
    notes?: string
  ): Promise<{ success: boolean; data: VendorBill }> {
    const response = await fetch(
      `${API_URL}/api/vendor-bills/${id}/validate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ override, notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to validate bill');
    }

    return response.json();
  },
};
