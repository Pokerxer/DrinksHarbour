import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { OccasionId } from './occasionBrief';
import type { DrinkCategoryPreference } from './occasionGeneration';
export type OccasionRequestInput = { submissionKey: string; occasion: OccasionId | ''; name: string; channel: 'email' | 'whatsapp'; email: string; whatsapp: string; city: string; date: string; guests: string; budget: string; notes: string; consent: boolean; preferences: DrinkCategoryPreference[]; items: { productId: string; name: string; quantity: number }[] };
export type OccasionReceipt = { reference: string; dueAt: string; channel: 'email' | 'whatsapp'; conversationId: string };
export async function submitOccasionRequest(input: OccasionRequestInput, file?: File, signal?: AbortSignal): Promise<OccasionReceipt> {
  const payload = new FormData();
  payload.set('payload', JSON.stringify(input));
  if (file) payload.set('file', file);
  const response = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/occasion-requests`, { method: 'POST', body: payload, signal });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'We could not confirm receipt. Retry with the same details.');
  if (!result.data?.reference || !result.data?.dueAt || !result.data?.conversationId) throw new Error('We could not confirm receipt. Retry with the same details.');
  return result.data as OccasionReceipt;
}
