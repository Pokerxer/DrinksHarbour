// services/exchangeRate.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface ExchangeRate {
  _id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  isActive: boolean;
  source?: 'manual' | 'live';
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

/**
 * Every method throws on a non-OK response or a `{success:false}` envelope so
 * callers can toast the server's message. Returning the parsed body blindly
 * made auth errors and outages look like "no rates yet" — an empty table with
 * no explanation.
 */
class ExchangeRateService {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private async unwrap<T extends { success?: boolean; message?: string }>(
    response: Response,
    fallbackMessage: string
  ): Promise<T> {
    let body: T;
    try {
      // ts-reset types response.json() as unknown — narrow explicitly.
      body = (await response.json()) as T;
    } catch {
      throw new Error(
        response.ok
          ? fallbackMessage
          : `${fallbackMessage} (HTTP ${response.status})`
      );
    }
    if (!response.ok || body.success === false) {
      throw new Error(body.message || fallbackMessage);
    }
    return body;
  }

  async getRates(
    token: string,
    params?: {
      fromCurrency?: string;
      toCurrency?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<ListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.fromCurrency)
      queryParams.set('fromCurrency', params.fromCurrency);
    if (params?.toCurrency) queryParams.set('toCurrency', params.toCurrency);
    if (params?.isActive !== undefined)
      queryParams.set('isActive', String(params.isActive));
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const response = await fetch(
      `${API_URL}/api/exchange-rates?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return this.unwrap<ListResponse>(response, 'Failed to load exchange rates');
  }

  async getLatestRates(
    token: string
  ): Promise<{ success: boolean; data: ExchangeRate[] }> {
    const response = await fetch(`${API_URL}/api/exchange-rates/latest`, {
      headers: this.getHeaders(token),
    });
    return this.unwrap(response, 'Failed to load latest exchange rates');
  }

  async createRate(
    data: Partial<ExchangeRate>,
    token: string
  ): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/exchange-rates`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return this.unwrap<CreateResponse>(response, 'Failed to create rate');
  }

  async updateRate(
    id: string,
    data: Partial<ExchangeRate>,
    token: string
  ): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/exchange-rates/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return this.unwrap<CreateResponse>(response, 'Failed to update rate');
  }

  async syncLiveRates(token: string): Promise<{
    success: boolean;
    data?: { updated: number; skippedManual: number; pairs: number };
    message?: string;
  }> {
    const response = await fetch(`${API_URL}/api/exchange-rates/sync`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return this.unwrap(response, 'Could not fetch live rates');
  }

  async deleteRate(
    id: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/exchange-rates/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.unwrap(response, 'Failed to delete rate');
  }
}

export const exchangeRateService = new ExchangeRateService();
