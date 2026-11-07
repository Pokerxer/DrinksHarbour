import type { OccasionGeneration } from './occasionGeneration.ts';
import { occasionChatHistory } from './occasionChatHistory.ts';
import { publicBottleChoices, type BottleChoice } from './weddingBottleList.ts';
import { validateOccasionAttachment, isOccasionImage } from './occasionAttachment.ts';
export type AiTurn = { role: 'user' | 'assistant'; content: string; products?: BottleChoice[] };
export type AiReply = { ok: true; text: string; attachmentContext?: string; products?: BottleChoice[] } | { ok: false; error: string; retryable: boolean };
export async function askWeddingAi(input: { query: string; context: string; history: AiTurn[]; tenantId?: string; occasion?: string; attachment?: File; reference?: string; generation?: OccasionGeneration }, signal: AbortSignal): Promise<AiReply> {
  const attachmentError = validateOccasionAttachment(input.attachment);
  if (attachmentError) return { ok: false, error: attachmentError, retryable: false };
  if (input.query.length > 2000 || input.context.length > 6000) return { ok: false, error: 'Shorten the question or list and try again.', retryable: false };
  const history = occasionChatHistory(input.history, input.context, input.reference);
  const body = new FormData(); body.append('query', input.query); body.append('conversationHistory', JSON.stringify(history));
  body.append('mode', 'occasion'); body.append('occasion', input.occasion || 'weddings');
  if (input.generation) body.append('generation', JSON.stringify(input.generation));
  if (input.attachment) body.append(isOccasionImage(input.attachment) ? 'images' : 'file', input.attachment);
  if (input.tenantId) body.append('tenantId', input.tenantId);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chatbot/query`, { method: 'POST', body, signal, credentials: 'omit' });
  const payload: unknown = await response.json().catch(() => null);
  const result = payload && typeof payload === 'object' ? payload as { success?: boolean; message?: unknown; data?: { response?: unknown; attachmentContext?: unknown; attachmentUnreadable?: boolean; products?: unknown; generatedList?: { items?: unknown } } } : null;
  if (!response.ok || result?.success !== true) {
    const error = typeof result?.message === 'string' ? result.message.slice(0, 300) : 'The AI assistant could not answer. Please try again.';
    return { ok: false, error, retryable: response.status !== 429 };
  }
  if (result.data?.attachmentUnreadable) return { ok: false, error: typeof result.data.response === 'string' ? result.data.response : 'Could not read the attachment. Please try another file.', retryable: false };
  if (typeof result.data?.response !== 'string' || !result.data.response.trim()) return { ok: false, error: 'The assistant returned an empty reply. Please try again.', retryable: true };
  const proposed = Array.isArray(result.data.generatedList?.items) ? result.data.generatedList.items : [];
  const products = publicBottleChoices({ success: true, data: { products: Array.isArray(result.data.products) ? result.data.products : [] } }, 20).map(product => {
    const line = proposed.find((value: unknown) => value && typeof value === 'object' && 'productId' in value && value.productId === product.productId) as { quantity?: unknown } | undefined;
    return typeof line?.quantity === 'number' && Number.isSafeInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 9999 ? { ...product, suggestedQuantity: line.quantity } : product;
  });
  return { ok: true, ...(products.length ? { products } : {}), text: result.data.response.slice(0, 12000), ...(typeof result.data.attachmentContext === 'string' ? { attachmentContext: result.data.attachmentContext.slice(0, 5000) } : {}) };
}
