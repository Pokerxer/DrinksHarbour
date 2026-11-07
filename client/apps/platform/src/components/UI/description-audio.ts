import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export class AudioReadError extends Error {
  constructor(readonly reason: 'unreachable' | 'rate-limited' | 'unavailable') {
    super(reason);
  }
}

/** Convert rich descriptions to prose without reading markup or executable content. */
export function descriptionText(description?: string, shortDescription?: string): string {
  const toText = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, template, noscript').forEach(node => node.remove());
    doc.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6, tr').forEach(node => {
      node.before(doc.createTextNode(' '));
      node.after(doc.createTextNode(' '));
    });
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  };
  return toText(description || '') || toText(shortDescription || '');
}

/** Keep normal pages in one recording; bound unusually long prose below 5,000. */
function chunksFor(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 4800) {
    const sentences = [...remaining.slice(0, 4800).matchAll(/[.!?](?:\s|$)/g)];
    const sentenceEnd = sentences.at(-1)?.index;
    const space = remaining.lastIndexOf(' ', 4800);
    const end = sentenceEnd !== undefined && sentenceEnd > 2400
      ? sentenceEnd + 1 : space > 0 ? space : 4800;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining.length < 5 && chunks.length) {
    chunks[chunks.length - 1] += ` ${remaining}`;
  } else if (remaining) {
    chunks.push(remaining.length < 5 ? `Description: ${remaining}` : remaining);
  }
  return chunks;
}

function playChunk(url: string, signal: AbortSignal, onPlaying: () => void) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const audio = new Audio(url);
    const finish = (error?: unknown) => {
      audio.pause();
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
      if (error) reject(error); else resolve();
    };
    const ended = () => finish();
    const failed = () => finish(new Error('Audio playback failed'));
    const aborted = () => finish(signal.reason);
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    audio.play().then(() => {
      if (!signal.aborted) onPlaying();
    }).catch(finish);
  });
}

/** Fish Audio through the existing server proxy, one bounded request at a time. */
export async function readDescription(
  text: string, signal: AbortSignal, onPlaying: () => void,
) {
  for (const chunk of chunksFor(text)) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetchWithAuth(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk }),
        skipAuthRefresh: true,
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new AudioReadError('unreachable');
    }
    signal.throwIfAborted();
    if (response.status === 429) throw new AudioReadError('rate-limited');
    if (response.status === 503) throw new AudioReadError('unavailable');
    if (!response.ok) throw new Error('Audio generation failed');
    const blob = await response.blob();
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    try {
      await playChunk(url, signal, onPlaying);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
