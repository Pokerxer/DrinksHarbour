import { describeBottleList, validateBottleList, type BottleListItem } from './weddingBottleList.ts';

export type WeddingChatIntent = 'review' | 'ideas' | 'non-alcoholic';
export const weddingAiTasks = {
  review: 'Review my wedding drinks list. Suggest gaps and questions to check with my venue or caterer.',
  ideas: 'Suggest drink ideas for a wedding, and ask about the menu, preferences and budget before narrowing the choices.',
  'non-alcoholic': 'Help me plan non-alcoholic options for a wedding. Check the exact product label and ABV when suggesting bottles.',
};
export function buildWeddingAiQuestion(question: string, items: BottleListItem[], interests: string, occasion = 'weddings', planningDetails = ''): { ok: true; query: string; context: string } | { ok: false; error: string } {
  const error = validateBottleList(items);
  if (error) return { ok: false, error };
  if (!question.trim() || question.trim().length > 1000) return { ok: false, error: 'Enter a question of up to 1,000 characters.' };
  const context = [`Current ${occasion === 'weddings' ? 'wedding' : occasion} planning list (a snapshot, not an order):`, interests ? `Drink preferences: ${interests}` : '', planningDetails ? `Event details shared by the customer:\n${planningDetails}` : '', describeBottleList(items) || 'No catalogue bottles manually selected yet. Keep any proposed list discussed in the conversation.'].filter(Boolean).join('\n\n');
  if (context.length > 6000) return { ok: false, error: 'Shorten the list before sharing it with the assistant.' };
  const query = [`${occasion === 'weddings' ? 'Wedding' : occasion} drinks planning in Nigeria.`, question.trim(), 'Use my latest corrections and selected bottles. Plan the complete drinks budget, guest coverage, water and mixers. Ask about missing duration and adult/non-drinking guest mix.', 'Show provisional quantity and serving calculations with explicit pour/duration assumptions. Do not guarantee sufficiency from guest count alone or inflate alcohol quantities to spend the budget. Confirm sizes, offers, stock and delivery separately.', 'Do not add anything to my cart or place an order.'].join('\n\n');
  return { ok: true, query, context };
}
export function buildWeddingChatPrompt(intent: WeddingChatIntent, items: BottleListItem[], interests: string): { ok: true; text: string } | { ok: false; error: string } {
  const result = buildWeddingAiQuestion(weddingAiTasks[intent], items, interests);
  if (!result.ok) return result;
  const text = `${result.query}\n\n${result.context}`;
  return text.length <= 2000 ? { ok: true, text } : { ok: false, error: 'Use the inline AI assistant for this longer list.' };
}
