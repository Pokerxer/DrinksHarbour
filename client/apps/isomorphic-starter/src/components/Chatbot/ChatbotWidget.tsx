'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderMessage(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <span key={i} className="block h-2" />;

    // Section headers: **About**, **Tasting Notes** etc.
    const headerMatch = line.match(/^\*\*([^*]+)\*\*:?\s*$/);
    if (headerMatch) {
      return (
        <p key={i} className="font-semibold text-slate-800 mt-3 mb-0.5 first:mt-0">
          {headerMatch[1]}
        </p>
      );
    }

    const isBullet = /^[•\-\*]\s/.test(line);
    const content = isBullet ? line.replace(/^[•\-\*]\s/, '') : line;

    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : part
    );

    if (isBullet) {
      return (
        <div key={i} className="flex gap-2 my-0.5 ml-1">
          <span className="mt-1 w-1 h-1 rounded-full bg-red-700 flex-shrink-0" />
          <span className="leading-snug">{parts}</span>
        </div>
      );
    }
    return <p key={i} className="leading-snug my-0.5">{parts}</p>;
  });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProductCard {
  id: string;
  name: string;
  slug: string;
  type: string;
  minPrice: number;
  hasDiscount: boolean;
  image: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: string[];
  docName?: string;
  products?: ProductCard[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ── Icons (inline SVG helpers) ────────────────────────────────────────────────
const SendIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const ImageIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const DocIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const BotAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center flex-shrink-0 shadow-sm">
    <span className="text-white font-black text-[10px] tracking-tight leading-none">DH</span>
  </div>
);

// ── Product card component ────────────────────────────────────────────────────
function ProductCardItem({ p }: { p: ProductCard }) {
  return (
    <Link
      href={`/shop/${p.slug}`}
      className="flex-shrink-0 w-36 rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group snap-start"
    >
      <div className="h-24 bg-slate-50 overflow-hidden">
        {p.image ? (
          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🍷</div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{p.name}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs font-bold text-red-700">₦{p.minPrice.toLocaleString()}</p>
          {p.hasDiscount && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded-full font-medium">SALE</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function ChatbotWidget() {
  const [isOpen, setIsOpen]   = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews]   = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc]       = useState<File | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [retryFn, setRetryFn]   = useState<(() => void) | null>(null);
  const [quickReplies, setQuickReplies] = useState<Array<{ label: string; query: string } | string>>([]);
  const [unread, setUnread]     = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const docInputRef    = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Track unread when closed
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
    }
  }, [isOpen]);

  // Greeting
  const getGreeting = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/chatbot/greeting`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) {
        setMessages([{ role: 'assistant', content: data.data.greeting || data.data.response, timestamp: Date.now() }]);
        if (data.data.quickReplies?.length) setQuickReplies(data.data.quickReplies);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      getGreeting();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // File handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files    = Array.from(e.target.files || []);
    const toAdd    = files.slice(0, 5 - selectedImages.length);
    setSelectedImages(prev => [...prev, ...toAdd]);
    setImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedDoc(file);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    setSelectedImages([]);
    setImagePreviews([]);
    setSelectedDoc(null);
  };

  const doSend = useCallback(async (queryText: string, imgs: File[], doc: File | null, history: { role: string; content: string }[]) => {
    setError(null);
    setRetryFn(null);
    setIsLoading(true);
    try {
      const formData = new FormData();
      imgs.forEach(img => formData.append('images', img));
      if (doc) formData.append('file', doc);
      if (queryText) formData.append('query', queryText);
      formData.append('conversationHistory', JSON.stringify(history));

      const res  = await fetch(`${API_URL}/api/chatbot/query`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      if (data.success) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.data.response,
          timestamp: Date.now(),
          products: data.data.products?.length ? data.data.products : undefined,
        };
        setMessages(prev => [...prev, assistantMsg]);
        setQuickReplies(data.data.quickReplies || []);
        setUnread(n => n + 1);
      } else {
        throw new Error(data.message || 'No response');
      }
    } catch (e: any) {
      setError('Something went wrong.');
      setRetryFn(() => () => doSend(queryText, imgs, doc, history));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = async () => {
    const queryText = input.trim();
    const hasContent = queryText || selectedImages.length > 0 || selectedDoc;
    if (!hasContent || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: queryText || (selectedDoc ? `📄 ${selectedDoc.name}` : ''),
      timestamp: Date.now(),
      images: imagePreviews.length > 0 ? [...imagePreviews] : undefined,
      docName: selectedDoc?.name,
    };

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setQuickReplies([]);

    const imgs = [...selectedImages];
    const doc  = selectedDoc;
    clearAttachments();

    await doSend(queryText, imgs, doc, history);
  };

  const handleQuickReply = async (qr: { label: string; query: string } | string) => {
    const text = typeof qr === 'string' ? qr : qr.query;
    setQuickReplies([]);

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);

    await doSend(text, [], null, history);
  };

  const clearChat = () => {
    setMessages([]);
    setQuickReplies([]);
    setError(null);
    getGreeting();
  };

  const hasAttachments = selectedImages.length > 0 || selectedDoc;
  const canSend = (input.trim() || hasAttachments) && !isLoading;

  return (
    <>
      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className="fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-red-700 to-red-900 text-white shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        {isOpen ? (
          <CloseIcon />
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-700 rounded-full text-[10px] font-bold flex items-center justify-center shadow">
            {unread}
          </span>
        )}
      </button>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      <div
        className={`
          fixed z-[9998] transition-all duration-300 ease-out
          inset-0 sm:inset-auto sm:bottom-24 sm:right-5
          sm:w-[390px] sm:h-[600px] sm:max-h-[calc(100vh-120px)]
          ${isOpen
            ? 'opacity-100 pointer-events-auto sm:translate-y-0 sm:scale-100'
            : 'opacity-0 pointer-events-none sm:translate-y-4 sm:scale-95'}
        `}
        style={{ transformOrigin: 'bottom right' }}
      >
        <div className="flex flex-col h-full sm:rounded-3xl overflow-hidden shadow-2xl bg-white ring-1 ring-slate-200">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-red-800 to-red-950 text-white px-5 py-4 flex items-center gap-3 flex-shrink-0">
            <BotAvatar />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">DrinksHarbour AI</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" />
                <p className="text-[11px] text-red-200">Online · beverage expert</p>
              </div>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-red-300 hover:text-white"
            >
              <TrashIcon />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-red-300 hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>

          {/* ── Messages ───────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-red-50/30 scroll-smooth">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <BotAvatar />}

                <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {/* Bubble */}
                  <div
                    className={`rounded-2xl overflow-hidden text-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-red-700 to-red-900 text-white rounded-br-md shadow-md'
                        : 'bg-white border border-red-100 text-slate-700 rounded-bl-md shadow-sm'
                    }`}
                  >
                    {/* Image grid */}
                    {msg.images && msg.images.length > 0 && (
                      <div className={`p-2 grid gap-1 ${msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {msg.images.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt=""
                            className={`rounded-xl object-cover ${msg.images!.length === 1 ? 'max-h-48 w-full' : 'h-24 w-full'}`}
                          />
                        ))}
                      </div>
                    )}
                    {/* Doc chip */}
                    {msg.docName && (
                      <div className="flex items-center gap-2 px-3 pt-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                          <DocIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium truncate max-w-[140px] opacity-90">{msg.docName}</span>
                      </div>
                    )}
                    {/* Text */}
                    {msg.content && (
                      <div className="px-3.5 py-2.5">
                        {msg.role === 'assistant'
                          ? <div className="space-y-0.5">{renderMessage(msg.content)}</div>
                          : <p className="leading-relaxed">{msg.content}</p>
                        }
                      </div>
                    )}
                  </div>

                  {/* Product cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x w-full mt-1 scrollbar-none">
                      {msg.products.slice(0, 6).map(p => (
                        <ProductCardItem key={p.id} p={p} />
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className={`text-[10px] text-slate-400 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <BotAvatar />
                <div className="bg-white border border-red-100 px-4 py-3.5 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex gap-1 items-center">
                    {[0, 160, 320].map(d => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms`, animationDuration: '900ms' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !isLoading && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
                  <span>{error}</span>
                  {retryFn && (
                    <button
                      onClick={retryFn}
                      className="underline font-medium hover:text-red-900"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick replies ───────────────────────────────────────────── */}
          {quickReplies.length > 0 && !isLoading && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2.5 bg-white border-t border-red-100 flex-shrink-0 scrollbar-none snap-x">
              {quickReplies.slice(0, 6).map((qr, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickReply(qr)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 active:scale-95 transition-all whitespace-nowrap snap-start font-medium"
                >
                  {typeof qr === 'string' ? qr : qr.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Attachment previews ─────────────────────────────────────── */}
          {hasAttachments && (
            <div className="flex gap-2 px-4 py-2 bg-white border-t border-red-100 flex-shrink-0 flex-wrap items-center">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={src} alt="" className="w-12 h-12 rounded-xl object-cover ring-1 ring-red-100" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-700 text-white rounded-full text-[10px] flex items-center justify-center shadow hover:bg-red-900 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {selectedDoc && (
                <div className="flex items-center gap-1.5 bg-red-50 rounded-xl px-2.5 py-1.5 max-w-[160px]">
                  <DocIcon className="w-4 h-4 text-red-700" />
                  <span className="text-xs text-slate-600 truncate">{selectedDoc.name}</span>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="text-slate-400 hover:text-red-700 flex-shrink-0 ml-0.5 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Input bar ──────────────────────────────────────────────── */}
          <div className="px-4 py-3 bg-white border-t border-red-100 flex-shrink-0">
            <input ref={imageInputRef} type="file" onChange={handleImageSelect} className="hidden" accept="image/*" multiple />
            <input ref={docInputRef}   type="file" onChange={handleDocSelect}   className="hidden" accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls" />

            <div className="flex items-center gap-2 bg-red-50 rounded-2xl px-3 py-1.5 transition-all">
              {/* Attach buttons */}
              <button
                onClick={() => imageInputRef.current?.click()}
                title="Attach photo"
                disabled={selectedImages.length >= 5}
                className="p-1 text-red-400 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-30"
              >
                <ImageIcon />
              </button>
              <button
                onClick={() => docInputRef.current?.click()}
                title="Attach document"
                disabled={!!selectedDoc}
                className="p-1 text-red-400 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-30"
              >
                <DocIcon />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); if (quickReplies.length > 0) setQuickReplies([]); }}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about drinks…"
                className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-red-300 min-w-0 py-1"
                style={{ outline: 'none', boxShadow: 'none' }}
              />

              <button
                onClick={sendMessage}
                disabled={!canSend}
                className="w-8 h-8 rounded-xl bg-red-700 text-white flex items-center justify-center disabled:opacity-30 hover:bg-red-800 active:scale-90 transition-all flex-shrink-0 shadow-sm"
              >
                <SendIcon />
              </button>
            </div>

            <p className="text-center text-[10px] text-red-300 mt-2">
              Powered by DrinksHarbour AI
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
