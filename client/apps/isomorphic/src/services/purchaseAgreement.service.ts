// services/purchaseAgreement.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PurchaseAgreement {
  _id: string;
  agreementNumber: string;
  name: string;
  agreementType: 'blanket_order' | 'call_for_tender';
  selectionType: 'exclusive' | 'non_exclusive';
  vendor?: string;
  vendorName: string;
  currency: string;
  startDate: string;
  endDate: string;
  totalQuantity: number;
  consumedQuantity: number;
  totalAmount: number;
  consumedAmount: number;
  status: 'draft' | 'active' | 'expired' | 'exhausted' | 'cancelled';
  termsConditions?: string;
  notes?: string;
  items: AgreementItem[];
  tenderResponses?: TenderResponse[];
  purchaseOrders?: string[];
  rfqs?: string[];
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
}

export interface AgreementItem {
  subProductId: string;
  subProductName: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  consumedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  packaging?: string;
  packagingQty: number;
  leadTimeDays: number;
}

export interface TenderResponse {
  vendorId?: string;
  vendorName: string;
  submittedAt?: string;
  totalAmount?: number;
  currency?: string;
  items?: any[];
  notes?: string;
  deliveryDate?: string;
  validityDate?: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}

interface CreateResponse {
  success: boolean;
  data: PurchaseAgreement;
  message?: string;
}

interface ListResponse {
  success: boolean;
  data: PurchaseAgreement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class PurchaseAgreementService {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async getAgreements(token: string, params?: {
    status?: string;
    type?: string;
    vendor?: string;
    page?: number;
    limit?: number;
  }): Promise<ListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.type) queryParams.set('type', params.type);
    if (params?.vendor) queryParams.set('vendor', params.vendor);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const response = await fetch(
      `${API_URL}/api/purchase-agreements?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async getAgreement(id: string, token: string): Promise<{ success: boolean; data: PurchaseAgreement }> {
    const response = await fetch(
      `${API_URL}/api/purchase-agreements/${id}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async createAgreement(data: Partial<PurchaseAgreement>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/purchase-agreements`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateAgreement(id: string, data: Partial<PurchaseAgreement>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/purchase-agreements/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteAgreement(id: string, token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/purchase-agreements/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return response.json();
  }

  async activateAgreement(id: string, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/purchase-agreements/${id}/activate`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return response.json();
  }

  async addTenderResponse(id: string, data: any, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/purchase-agreements/${id}/tender-response`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async selectTenderWinner(id: string, data: { vendorIndex: number; vendorId?: string; notes?: string }, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/purchase-agreements/${id}/select-winner`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async createPOFromAgreement(id: string, data: {
    items: any[];
    vendorReference?: string;
    expectedArrival?: string;
    notes?: string;
  }, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/purchase-agreements/${id}/create-po`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }
}

export const purchaseAgreementService = new PurchaseAgreementService();
