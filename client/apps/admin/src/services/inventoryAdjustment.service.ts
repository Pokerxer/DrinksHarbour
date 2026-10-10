const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export class AdjustmentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AdjustmentError';
  }
}
export interface AdjustmentInput {
  warehouseId: string;
  subProductId: string;
  sizeId: string;
  targetQuantity: number;
  expectedQuantity: number;
  reason: string;
  notes?: string;
  reference?: string;
  requestId: string;
}
export const inventoryAdjustmentService = {
  async create(token: string, input: AdjustmentInput): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;
    if (!response.ok)
      throw new AdjustmentError(body?.message || 'Could not save the adjustment', response.status);
    if (!body?.success)
      throw new Error('The adjustment could not be confirmed. Retry with the same details');
    return { success: true };
  },
};
