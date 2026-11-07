import type { AiTurn } from './weddingAiChat.ts';

type Turn = Pick<AiTurn, 'role' | 'content'>;
const bounded = (text: string, limit = 4000) => text.length <= limit ? text : `${text.slice(0, Math.floor((limit - 40) / 2))}\n[Earlier detail omitted]\n${text.slice(-Math.floor((limit - 40) / 2))}`;

// Reserve the current selection/upload first, then the opening brief and latest
// complete turns. This stays inside the public API's20-turn/24k-character caps.
export function occasionChatHistory(history: AiTurn[], context: string, reference = ''): Turn[] {
  const current: Turn[] = [];
  for (let index = 0; index < context.length; index += 3500) current.push({ role: 'user', content: context.slice(index, index + 3500) });
  const retained = reference.slice(-5000);
  for (let index = 0; index < retained.length; index += 3400) current.push({ role: 'user', content: `Previously uploaded reference:\n${retained.slice(index, index + 3400)}` });
  const opening = history.length ? { role: history[0].role, content: bounded(history[0].content) } : undefined;
  let remaining = 24000 - current.reduce((sum, turn) => sum + turn.content.length, 0) - (opening?.content.length || 0);
  const recent: Turn[] = [];
  for (let index = history.length - 1; index > 0 && recent.length < 19 - current.length; index--) {
    const content = history[index].content.slice(0, 12000), chunks: Turn[] = [];
    for (let offset = 0; offset < content.length; offset += 3500) chunks.push({ role: history[index].role, content: content.slice(offset, offset + 3500) });
    if (content.length <= remaining && chunks.length + recent.length <= 19 - current.length) { recent.unshift(...chunks); remaining -= content.length; }
    else { const excerpt = bounded(content); if (excerpt.length <= remaining) recent.unshift({ role: history[index].role, content: excerpt }); break; }
  }
  return [...(opening ? [opening] : []), ...recent, ...current];
}
