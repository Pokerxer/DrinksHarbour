// services/uomConversion.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface UOMConversion {
  _id: string;
  name: string;
  fromUOM: string;
  toUOM: string;
  conversionFactor: number;
  isActive: boolean;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
}

interface CreateResponse {
  success: boolean;
  data: UOMConversion;
  message?: string;
}

interface ListResponse {
  success: boolean;
  data: UOMConversion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const UOM_OPTIONS = [
  { value: 'Units', label: 'Units' },
  { value: 'Cases', label: 'Cases' },
  { value: 'Packs', label: 'Packs' },
  { value: 'Bottles', label: 'Bottles' },
  { value: 'Cartons', label: 'Cartons' },
  { value: 'Boxes', label: 'Boxes' },
  { value: 'Pallets', label: 'Pallets' },
  { value: 'Liters', label: 'Liters' },
  { value: 'Milliliters', label: 'Milliliters' },
  { value: 'Gallons', label: 'Gallons' },
];

class UOMConversionService {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  getUOMOptions() {
    return UOM_OPTIONS;
  }

  async getConversions(token: string, params?: {
    fromUOM?: string;
    toUOM?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.fromUOM) queryParams.set('fromUOM', params.fromUOM);
    if (params?.toUOM) queryParams.set('toUOM', params.toUOM);
    if (params?.isActive !== undefined) queryParams.set('isActive', String(params.isActive));
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const response = await fetch(
      `${API_URL}/api/uom-conversions?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async getConversion(id: string, token: string): Promise<{ success: boolean; data: UOMConversion }> {
    const response = await fetch(
      `${API_URL}/api/uom-conversions/${id}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async createConversion(data: Partial<UOMConversion>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/uom-conversions`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateConversion(id: string, data: Partial<UOMConversion>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/uom-conversions/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteConversion(id: string, token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/uom-conversions/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return response.json();
  }

  async convertUnits(value: number, fromUOM: string, toUOM: string, token: string): Promise<{
    success: boolean;
    data: {
      originalValue: number;
      fromUOM: string;
      toUOM: string;
      convertedValue: number;
    } | null;
    message?: string;
  }> {
    const queryParams = new URLSearchParams({
      value: String(value),
      fromUOM,
      toUOM,
    });

    const response = await fetch(
      `${API_URL}/api/uom-conversions/convert?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }
}

export const uomConversionService = new UOMConversionService();
