'use client';

import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import type { BottleChoice } from '@/lib/weddingBottleList';
import type { AiTurn } from '@/lib/weddingAiChat';
import WeddingAiProductChoices from './WeddingAiProductChoices';

export default function WeddingAiTranscript({ messages, loading, error, onRetry, occasion = 'weddings', onChoose }: { messages: AiTurn[]; loading: boolean; error: { message: string; retryable: boolean } | null; onRetry: () => void; occasion?: string; onChoose?: (choice: BottleChoice) => void }) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, loading]);
  return <>
    <div ref={log} aria-label={occasion === 'weddings' ? 'Wedding AI conversation' : 'Occasion AI conversation'} role="log" aria-live="polite" aria-relevant="additions" className="mt-4 min-h-[18rem] max-h-[32rem] space-y-5 overflow-y-auto overscroll-contain rounded-xl bg-white p-2 sm:p-4">
      {!messages.length && <p className="text-sm leading-7 text-gray-600">{occasion === 'weddings' ? 'Hi, I’m your wedding drinks planner. Tell me about your day and the drinks you have in mind, or send your list or a photo. We’ll build the plan together.' : 'Hi, I’m your DrinksHarbour occasion planner. What are you planning? Tell me what you have in mind, or send a drinks list or photo. We’ll build your plan together.'}</p>}
      {messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'rounded-lg bg-rose-50 p-3' : 'border-l-2 border-[#7c1d1d] pl-3'}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#7c1d1d]">{message.role === 'user' ? 'You' : 'DrinksHarbour AI'}</p>
        <div className="break-words text-sm leading-7 text-gray-700 [&_p]:my-2 [&_p]:text-sm [&_p]:leading-7 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-base [&_h3]:font-bold">
          <Markdown components={{ h1: ({ children }) => <h4 className="font-bold">{children}</h4>, h2: ({ children }) => <h4 className="font-bold">{children}</h4>, h3: ({ children }) => <h4 className="font-bold">{children}</h4>, a: ({ href, children }) => <a href={message.products?.some(product => href === product.slug || href === `./${product.slug}`) ? `/product/${encodeURIComponent(href!.replace(/^\.\//, ''))}` : href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#7c1d1d] underline underline-offset-4">{children}</a> }}>{message.content}</Markdown>
        </div>
        {message.role === 'assistant' && message.products?.length ? <WeddingAiProductChoices products={message.products} loading={loading} onChoose={onChoose} /> : null}
      </div>)}
      {loading && <p role="status" className="text-sm font-medium text-[#7c1d1d]">AI is reviewing your message and planning with you…</p>}
    </div>
    {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-800">{error.message}{error.retryable && <button type="button" onClick={onRetry} className="ml-2 min-h-9 font-bold underline">Try AI again</button>}</div>}
  </>;
}
