'use client';

import { useEffect, useRef, useState } from 'react';
import type { OccasionGeneration } from '@/lib/occasionGeneration';
import { useTenant } from '@/context/TenantContext';
import { askWeddingAi, type AiTurn } from '@/lib/weddingAiChat';
import { buildWeddingAiQuestion } from '@/lib/weddingChatPrompt';
import { validateOccasionAttachment } from '@/lib/occasionAttachment';
import { validateBottleList, type BottleListItem } from '@/lib/weddingBottleList';

export function useWeddingAiChat(items: BottleListItem[], interests: string, occasion = 'weddings', allowIncompleteList = false) {
  const { tenant } = useTenant();
  const [messages, setMessages] = useState<AiTurn[]>([]), [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const lastRequest = useRef<{ question: string; attachment?: File; generation?: OccasionGeneration }>({ question: '' });
  const reference = useRef(''), planningDetails = useRef('');
  const history = useRef<AiTurn[]>([]), busy = useRef(false), revision = useRef(0), controller = useRef<AbortController | null>(null);
  useEffect(() => () => { revision.current++; controller.current?.abort(); }, []);
  function clear() {
    revision.current++; controller.current?.abort(); busy.current = false; history.current = [];
    setMessages([]); setLoading(false); setError(null); lastRequest.current = { question: '' }; reference.current = ''; planningDetails.current = '';
  }
  async function ask(question: string, attachment?: File, submittedDetails?: string, generation?: OccasionGeneration): Promise<boolean> {
    if (busy.current) return false;
    const attachmentError = validateOccasionAttachment(attachment);
    if (attachmentError) { setError({ message: attachmentError, retryable: false }); return false; }
    const effectiveQuestion = question.trim() || (attachment ? 'Help me plan with this attached list or photo.' : '');
    const snapshot = allowIncompleteList && validateBottleList(items) ? [] : items;
    const prompt = buildWeddingAiQuestion(effectiveQuestion, snapshot, interests, occasion, submittedDetails ?? planningDetails.current);
    if (!prompt.ok) { setError({ message: prompt.error, retryable: false }); return false; }
    if (submittedDetails !== undefined) planningDetails.current = submittedDetails;
    const run = ++revision.current, request = new AbortController(); controller.current = request;
    const user: AiTurn = { role: 'user', content: [effectiveQuestion, submittedDetails !== undefined ? prompt.context : '', attachment ? `Attached: ${attachment.name}` : ''].filter(Boolean).join('\n\n') };
    busy.current = true; setLoading(true); setError(null); lastRequest.current = { question, attachment, generation };
    setMessages([...history.current, user]);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; request.abort(); }, generation ? 180000 : 90000);
    try {
      const selections = snapshot.flatMap(item => item.productId ? [{ productId: item.productId, quantity: Number(item.quantity) }] : []);
      const reply = await askWeddingAi({ query: prompt.query, context: prompt.context, history: history.current, tenantId: tenant?._id, occasion, attachment, reference: reference.current, generation: generation && selections.length ? { ...generation, selections } : generation }, request.signal);
      if (run !== revision.current || request.signal.aborted) return false;
      if (!reply.ok) { setMessages(history.current); setError({ message: reply.error, retryable: reply.retryable }); return false; }
      if (reply.attachmentContext) reference.current = [reference.current, reply.attachmentContext].filter(Boolean).join('\n\n').slice(-5000);
      const assistant: AiTurn = { role: 'assistant', content: reply.text, ...(reply.products?.length ? { products: reply.products } : {}) };
      const next = [...history.current, user, assistant];
      history.current = next.length > 40 ? [...next.slice(0, 4), ...next.slice(-36)] : next;
      setMessages(history.current); return true;
    } catch {
      if (run !== revision.current || (request.signal.aborted && !timedOut)) return false;
      setMessages(history.current); setError({ message: timedOut ? 'The assistant took too long. Please try again.' : 'Could not reach the AI assistant. Check your connection and try again.', retryable: true });
      return false;
    } finally {
      clearTimeout(timeout);
      if (run === revision.current) { busy.current = false; setLoading(false); }
    }
  }
  return { messages, loading, error, ask, clear, retry: () => ask(lastRequest.current.question, lastRequest.current.attachment, undefined, lastRequest.current.generation) };
}
