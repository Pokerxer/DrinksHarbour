// services/exchangeRate.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface ExchangeRate {
  _id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  isActive: boolean;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
}

interface CreateResponse {
  success: boolean;
  data: ExchangeRate;
  message?: string;
}

interface ListResponse {
  success: boolean;
  data: ExchangeRate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class ExchangeRateService {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async getRates(token: string, params?: {
    fromCurrency?: string;
    toCurrency?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.fromCurrency) queryParams.set('fromCurrency', params.fromCurrency);
    if (params?.toCurrency) queryParams.set('toCurrency', params.toCurrency);
    if (params?.isActive !== undefined) queryParams.set('isActive', String(params.isActive));
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const response = await fetch(
      `${API_URL}/api/exchange-rates?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async getLatestRates(token: string): Promise<{ success: boolean; data: ExchangeRate[] }> {
    const response = await fetch(
      `${API_URL}/api/exchange-rates/latest`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async createRate(data: Partial<ExchangeRate>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/exchange-rates`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateRate(id: string, data: Partial<ExchangeRate>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/exchange-rates/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteRate(id: string, token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/exchange-rates/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return response.json();
  }

  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string, token: string): Promise<{
    success: boolean;
    data: {
      originalAmount: number;
      fromCurrency: string;
      toCurrency: string;
      convertedAmount: number;
      rate: number;
    } | null;
    message?: string;
  }> {
    const queryParams = new URLSearchParams({
      amount: String(amount),
      fromCurrency,
      toCurrency,
    });

    const response = await fetch(
      `${API_URL}/api/exchange-rates/convert?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }
}

export const exchangeRateService = new ExchangeRateService();
