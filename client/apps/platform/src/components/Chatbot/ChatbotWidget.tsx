'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Supports: **bold**, [links](/path), bullet lists, **Section** headers.
function renderInline(text: string, keyPrefix: string) {
  // Split on markdown links first, then bold within each fragment
  const linkParts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return linkParts.map((part, i) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith('/');
      return isInternal ? (
        <Link key={`${keyPrefix}-${i}`} href={href} className="text-red-700 font-medium underline underline-offset-2 hover:text-red-900">
          {label}
        </Link>
      ) : (
        <a key={`${keyPrefix}-${i}`} href={href} target="_blank" rel="noopener noreferrer" className="text-red-700 font-medium underline underline-offset-2 hover:text-red-900">
          {label}
        </a>
      );
    }
    return part.split(/(\*\*[^*]+\*\*)/g).map((frag, j) =>
      frag.startsWith('**') && frag.endsWith('**')
        ? <strong key={`${keyPrefix}-${i}-${j}`}>{frag.slice(2, -2)}</strong>
        : frag
    );
  });
}

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
    const numMatch = line.match(/^(\d+)[.)]\s+(.*)/);
    const content = isBullet ? line.replace(/^[•\-\*]\s/, '') : numMatch ? numMatch[2] : line;

    if (isBullet || numMatch) {
      return (
        <div key={i} className="flex gap-2 my-0.5 ml-1">
          {numMatch ? (
            <span className="text-red-700 font-semibold text-xs mt-0.5 flex-shrink-0">{numMatch[1]}.</span>
          ) : (
            <span className="mt-1.5 w-1 h-1 rounded-full bg-red-700 flex-shrink-0" />
          )}
          <span className="leading-snug">{renderInline(content, `l${i}`)}</span>
        </div>
      );
    }
    return <p key={i} className="leading-snug my-0.5">{renderInline(content, `l${i}`)}</p>;
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
  isSubstitute?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: string[];
  docName?: string;
  products?: ProductCard[];
}

type QuickReply = { label: string; query: string } | string;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const STORAGE_KEY = 'dh-chatbot-session-v1';

const THINKING_PHRASES = [
  'Thinking…',
  'Checking the cellar…',
  'Consulting the sommelier…',
  'Browsing the shelves…',
];

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
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const BotAvatar = () => (
  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-white/20">
    <span className="text-white font-black text-[9px] tracking-tight leading-none">DH</span>
  </div>
);

// ── Welcome capability cards ──────────────────────────────────────────────────
const CAPABILITIES = [
  { icon: '📸', title: 'Snap a bottle', desc: "Send a photo — I'll identify it & check stock", query: null, action: 'image' },
  { icon: '🎉', title: 'Plan an event', desc: 'Quantities & budget for any party size', query: 'Help me plan drinks for an event', action: null },
  { icon: '📄', title: 'Upload a drink list', desc: 'I price your whole list instantly', query: null, action: 'doc' },
  { icon: '🍷', title: 'Get a recommendation', desc: 'Tell me your taste & budget', query: 'Recommend a drink for me', action: null },
];

// ── Product card component ────────────────────────────────────────────────────
function ProductCardItem({ p }: { p: ProductCard }) {
  return (
    <Link
      href={`/product/${p.slug}`}
      className="flex-shrink-0 w-28 rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group snap-start"
    >
      <div className="h-20 bg-slate-50 overflow-hidden relative">
        {p.image ? (
          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🍷</div>
        )}
        {p.isSubstitute && (
          <span className="absolute top-1 left-1 text-[8px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded-full font-semibold shadow-sm">
            CLOSE
          </span>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[11px] font-semibold text-slate-700 truncate leading-tight">{p.name}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[11px] font-bold text-red-700">₦{p.minPrice.toLocaleString()}</p>
          {p.hasDiscount && (
            <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded-full font-medium">SALE</span>
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
  const [loadingStatus, setLoadingStatus] = useState(THINKING_PHRASES[0]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews]   = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc]       = useState<File | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [retryFn, setRetryFn]   = useState<(() => void) | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [unread, setUnread]     = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const docInputRef    = useRef<HTMLInputElement>(null);
  const restoredRef    = useRef(false);
  const dragCounter    = useRef(0);

  // ── Focus helper: works on iOS (requires a tiny delay after async ops) ──────
  const refocusInput = useCallback((delay = 0) => {
    if (delay) {
      setTimeout(() => inputRef.current?.focus(), delay);
    } else {
      inputRef.current?.focus();
    }
  }, []);

  // ── Session persistence: restore on mount, save on change ──────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.messages) && saved.messages.length > 0) {
          setMessages(saved.messages);
          setQuickReplies(saved.quickReplies || []);
          restoredRef.current = true;
        }
      }
    } catch { /* corrupt storage — start fresh */ }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      // Blob preview URLs don't survive reloads — persist messages without them
      const persistable = messages.map(({ images, ...m }) => m);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: persistable, quickReplies }));
    } catch { /* storage full/unavailable — non-fatal */ }
  }, [messages, quickReplies]);

  // ── Visual Viewport: keeps panel above keyboard on mobile ───────────────────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // ── Listen for toggle event dispatched by MobileBottomNav ───────────────────
  useEffect(() => {
    const handler = () => setIsOpen(o => !o);
    document.addEventListener('toggle-chatbot', handler);
    return () => document.removeEventListener('toggle-chatbot', handler);
  }, []);

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

  // Rotate the thinking phrase while loading (unless a contextual one is set)
  useEffect(() => {
    if (!isLoading) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % THINKING_PHRASES.length;
      setLoadingStatus(prev =>
        THINKING_PHRASES.includes(prev) ? THINKING_PHRASES[i] : prev
      );
    }, 2200);
    return () => clearInterval(id);
  }, [isLoading]);

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
    if (isOpen && messages.length === 0 && !restoredRef.current) {
      getGreeting();
      refocusInput(350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Attachment helpers ───────────────────────────────────────────────────────
  const addImages = useCallback((files: File[]) => {
    setSelectedImages(prev => {
      const toAdd = files.filter(f => f.type.startsWith('image/')).slice(0, 5 - prev.length);
      if (toAdd.length === 0) return prev;
      setImagePreviews(pp => [...pp, ...toAdd.map(f => URL.createObjectURL(f))]);
      return [...prev, ...toAdd];
    });
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(e.target.files || []));
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

  // ── Paste images straight into the chat ─────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      e.preventDefault();
      addImages(files);
    }
  };

  // ── Drag & drop onto the panel ───────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer?.types.includes('Files')) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    const images = files.filter(f => f.type.startsWith('image/'));
    const docs = files.filter(f => !f.type.startsWith('image/'));
    if (images.length > 0) addImages(images);
    if (docs.length > 0 && !selectedDoc) setSelectedDoc(docs[0]);
  };

  const doSend = useCallback(async (queryText: string, imgs: File[], doc: File | null, history: { role: string; content: string }[]) => {
    setError(null);
    setRetryFn(null);
    setIsLoading(true);
    setLoadingStatus(
      imgs.length > 0 ? 'Identifying your drink… 📸'
      : doc ? 'Reading your list… 📄'
      : THINKING_PHRASES[0]
    );
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
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setQuickReplies([]);

    const imgs = [...selectedImages];
    const doc  = selectedDoc;
    clearAttachments();

    // Keep keyboard open on mobile by re-focusing before the async call
    refocusInput();
    await doSend(queryText, imgs, doc, history);
    refocusInput(100);
  };

  const handleQuickReply = async (qr: QuickReply) => {
    const text = typeof qr === 'string' ? qr : qr.query;
    setQuickReplies([]);

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);

    refocusInput();
    await doSend(text, [], null, history);
    refocusInput(100);
  };

  const handleCapability = (cap: typeof CAPABILITIES[number]) => {
    if (cap.action === 'image') { imageInputRef.current?.click(); return; }
    if (cap.action === 'doc')   { docInputRef.current?.click(); return; }
    if (cap.query) handleQuickReply(cap.query);
  };

  const clearChat = () => {
    setMessages([]);
    setQuickReplies([]);
    setError(null);
    restoredRef.current = false;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    getGreeting();
  };

  // ── Scroll-to-bottom affordance ──────────────────────────────────────────────
  const handleMessagesScroll = () => {
    const el = messagesBoxRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-grow textarea up to ~4 lines
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (quickReplies.length > 0) setQuickReplies([]);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  };

  const hasAttachments = selectedImages.length > 0 || selectedDoc;
  const canSend = (input.trim() || hasAttachments) && !isLoading;
  const showWelcome = messages.length <= 1 && !isLoading;

  return (
    <>
      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className={`fixed bottom-5 right-5 z-[9999] w-12 h-12 rounded-full bg-gradient-to-br from-red-700 to-red-900 text-white shadow-2xl items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95 hidden sm:flex`}
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
          left-0 right-0 top-0 sm:inset-auto sm:bottom-24 sm:right-5
          sm:w-[340px] sm:h-[540px] sm:max-h-[calc(100vh-120px)]
          ${isOpen
            ? 'opacity-100 pointer-events-auto sm:translate-y-0 sm:scale-100'
            : 'opacity-0 pointer-events-none sm:translate-y-4 sm:scale-95'}
        `}
        style={{
          transformOrigin: 'bottom right',
          // On mobile: track visual viewport so panel shrinks above keyboard
          height: viewportHeight && typeof window !== 'undefined' && window.innerWidth < 640
            ? `${viewportHeight}px`
            : undefined,
        }}
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col h-full sm:rounded-3xl overflow-hidden shadow-2xl bg-white ring-1 ring-slate-200 relative">

          {/* ── Drag & drop overlay ─────────────────────────────────────── */}
          {isDragging && (
            <div className="absolute inset-0 z-20 bg-red-900/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white pointer-events-none">
              <span className="text-4xl">📸</span>
              <p className="font-semibold text-sm">Drop your photo or drink list here</p>
            </div>
          )}

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-red-800 to-red-950 text-white px-4 py-3 flex items-center gap-2.5 flex-shrink-0">
            <BotAvatar />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs leading-tight">DrinksHarbour AI</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[10px] text-red-200">Online · beverage expert</p>
              </div>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              aria-label="Clear chat"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-red-300 hover:text-white"
            >
              <TrashIcon />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-red-300 hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>

          {/* ── Messages ───────────────────────────────────────────────── */}
          <div
            ref={messagesBoxRef}
            onScroll={handleMessagesScroll}
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50/40 scroll-smooth"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <BotAvatar />}

                <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {/* Bubble */}
                  <div
                    className={`rounded-2xl overflow-hidden text-[11px] leading-snug ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-red-700 to-red-900 text-white rounded-br-sm shadow-md'
                        : 'bg-white border border-slate-100 text-slate-700 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {/* Image grid */}
                    {msg.images && msg.images.length > 0 && (
                      <div className={`p-2 grid gap-1 ${msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {msg.images.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt="Product image from chatbot"
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
                      <div className="px-3 py-2">
                        {msg.role === 'assistant'
                          ? <div className="space-y-0.5">{renderMessage(msg.content)}</div>
                          : <p className="leading-snug whitespace-pre-wrap">{msg.content}</p>
                        }
                      </div>
                    )}
                  </div>

                  {/* Product cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x w-full mt-1 scrollbar-none">
                      {msg.products.slice(0, 6).map((p, idx) => (
                        <ProductCardItem key={`${p.id}-${idx}`} p={p} />
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className={`text-[9px] text-slate-400 px-0.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {/* Welcome capability cards */}
            {showWelcome && messages.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {CAPABILITIES.map((cap) => (
                  <button
                    key={cap.title}
                    onClick={() => handleCapability(cap)}
                    className="text-left bg-white border border-red-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-red-200 active:scale-[0.98] transition-all"
                  >
                    <span className="text-xl">{cap.icon}</span>
                    <p className="text-[11px] font-semibold text-slate-800 mt-1.5 leading-tight">{cap.title}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{cap.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <BotAvatar />
                <div className="bg-white border border-red-100 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1 items-center">
                      {[0, 160, 320].map(d => (
                        <span
                          key={d}
                          className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms`, animationDuration: '900ms' }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">{loadingStatus}</span>
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

          {/* ── Scroll-to-bottom button ─────────────────────────────────── */}
          {showScrollDown && (
            <button
              onClick={scrollToBottom}
              aria-label="Scroll to latest message"
              className="absolute bottom-32 right-4 z-10 w-8 h-8 rounded-full bg-white text-red-700 shadow-lg ring-1 ring-red-100 flex items-center justify-center hover:bg-red-50 active:scale-90 transition-all"
            >
              <ChevronDownIcon />
            </button>
          )}

          {/* ── Quick replies ───────────────────────────────────────────── */}
          {quickReplies.length > 0 && !isLoading && (
            <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-white border-t border-slate-100 flex-shrink-0 scrollbar-none snap-x">
              {quickReplies.slice(0, 6).map((qr, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickReply(qr)}
                  className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 active:scale-95 transition-all whitespace-nowrap snap-start font-medium"
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
                  <img src={src} alt="Chat attachment preview" className="w-12 h-12 rounded-xl object-cover ring-1 ring-red-100" />
                  <button
                    onClick={() => removeImage(i)}
                    aria-label="Remove image"
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
                    aria-label="Remove document"
                    className="text-slate-400 hover:text-red-700 flex-shrink-0 ml-0.5 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Input bar ──────────────────────────────────────────────── */}
          <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex-shrink-0">
            <input ref={imageInputRef} type="file" onChange={handleImageSelect} className="hidden" accept="image/*" multiple aria-label="Upload photos" />
            <input ref={docInputRef}   type="file" onChange={handleDocSelect}   className="hidden" accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls" aria-label="Upload document" />

            <div className="flex items-end gap-1.5 bg-slate-50 rounded-2xl px-2.5 py-1.5 transition-all">
              {/* Attach buttons */}
              <button
                onClick={() => imageInputRef.current?.click()}
                title="Attach photo"
                aria-label="Attach photo"
                disabled={selectedImages.length >= 5}
                className="p-1 mb-1 text-red-400 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-30"
              >
                <ImageIcon />
              </button>
              <button
                onClick={() => docInputRef.current?.click()}
                title="Attach document"
                aria-label="Attach document"
                disabled={!!selectedDoc}
                className="p-1 mb-1 text-red-400 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-30"
              >
                <DocIcon />
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                value={input}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about drinks, or snap a bottle…"
                className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder:text-red-300 min-w-0 py-1.5 resize-none max-h-[110px] leading-snug"
                style={{ outline: 'none', boxShadow: 'none', fontSize: '16px' }}
              />

              <button
                onClick={sendMessage}
                disabled={!canSend}
                aria-label="Send message"
                className="w-8 h-8 mb-0.5 rounded-xl bg-red-700 text-white flex items-center justify-center disabled:opacity-30 hover:bg-red-800 active:scale-90 transition-all flex-shrink-0 shadow-sm"
              >
                <SendIcon />
              </button>
            </div>

            <p className="text-center text-[10px] text-red-300 mt-2">
              Powered by DrinksHarbour AI · I can read photos & drink lists
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
