'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// Product suggestions link to the shopper-facing product page, which lives in
// the platform app — the admin app has no /product/[slug] route, so a relative
// href here 404s on the admin host.
const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || 'https://www.drinksharbour.com';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
  fileName?: string;
  products?: Product[];
  timestamp: number;
}

interface Product {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  type: string;
  minPrice: number;
  hasDiscount: boolean;
  image?: string;
  // Cart fields
  selectedSize?: string;
  selectedSizeId?: string;
  selectedVendor?: string;
  selectedVendorId?: string;
  selectedSubProductId?: string;
  selectedProductId?: string;
  selectedColor?: string;
  price?: number;
  images?: any[];
  primaryImage?: any;
  priceRange?: any;
  availableAt?: any[];
}

const categoryEmojis: Record<string, string> = {
  wine: '🍷',
  beer: '🍺',
  spirit: '🥃',
  whiskey: '🥃',
  vodka: '❄️',
  gin: '🌿',
  rum: '🏴‍☠️',
  tequila: '🌵',
  champagne: '🍾',
  cider: '🍎',
  default: '🍹',
};

function getProductEmoji(type?: string): string {
  if (!type) return categoryEmojis.default;
  const key = type.toLowerCase().replace(' ', '_');
  return categoryEmojis[key] || categoryEmojis.default;
}

function parseMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentTable: string[] = [];
  let inTable = false;
  let inList = false;
  let listItems: string[] = [];

  const flushTable = () => {
    if (currentTable.length > 0) {
      const rows = currentTable.filter(
        (row) => row.trim() && !row.match(/^\|[\s\-:|]+\|$/)
      );
      if (rows.length > 0) {
        const headers = rows[0]
          .split('|')
          .map((h) => h.trim())
          .filter(Boolean);
        const bodyRows = rows.slice(2);

        elements.push(
          <div
            key={`table-${elements.length}`}
            className="my-3 overflow-x-auto"
          >
            <table className="min-w-full overflow-hidden rounded-xl border border-slate-200 text-xs shadow-sm sm:text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {headers.map((header, i) => (
                    <th
                      key={i}
                      className="border-b px-3 py-2.5 text-left font-semibold text-slate-700"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    {row.split('|').map((cell, j) => {
                      const content = cell.trim();
                      if (j >= headers.length) return null;
                      return (
                        <td key={j} className="px-3 py-2.5 text-slate-600">
                          {parseInline(content)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      currentTable = [];
      inTable = false;
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="my-2 list-disc space-y-1.5 pl-5"
        >
          {listItems.map((item, i) => (
            <li key={i} className="text-xs text-slate-700">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (text: string): React.ReactNode => {
    let result = text;
    result = result.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold">$1</strong>'
    );
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(
      /`(.+?)`/g,
      '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600">$1</code>'
    );
    result = result.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" class="text-emerald-600 hover:text-emerald-700 underline underline-offset-2">$1</a>'
    );
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('|') && line.includes('|')) {
      if (!inTable) {
        flushList();
        inTable = true;
      }
      currentTable.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.trim().startsWith('- ') || line.trim().match(/^[\d]+\.\s/)) {
      if (!inList) {
        inList = true;
      }
      listItems.push(line.replace(/^[\s]*[-*\d.]+\s*/, ''));
      continue;
    } else if (inList) {
      flushList();
    }

    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="mb-2 mt-4 text-xs font-bold text-slate-800">
          {trimmedLine.replace('### ', '')}
        </h4>
      );
    } else if (trimmedLine.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="mb-2 mt-5 text-base font-bold text-slate-800">
          {trimmedLine.replace('## ', '')}
        </h3>
      );
    } else if (trimmedLine.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="mb-2 mt-5 text-lg font-bold text-slate-800">
          {trimmedLine.replace('# ', '')}
        </h2>
      );
    } else if (trimmedLine.match(/^[\*\-]\s/)) {
      elements.push(
        <li key={i} className="ml-4 text-xs text-slate-700">
          {parseInline(trimmedLine.replace(/^[\*\-]\s/, ''))}
        </li>
      );
    } else if (trimmedLine) {
      elements.push(
        <p key={i} className="my-1.5 text-xs leading-relaxed text-slate-700">
          {parseInline(trimmedLine)}
        </p>
      );
    }
  }

  flushTable();
  flushList();

  return elements;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(price);
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ChatbotWidget() {
  const addToCart = null;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessage, setNewMessage] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 96 });
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      getGreeting();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (newMessage && !isLoading) {
      const timer = setTimeout(() => setNewMessage(false), 300);
      return () => clearTimeout(timer);
    }
  }, [newMessage, isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        widgetRef.current &&
        !widgetRef.current.contains(event.target as Node)
      ) {
        const floatingBtn = document.getElementById('chatbot-floating-btn');
        if (floatingBtn && !floatingBtn.contains(event.target as Node)) {
          setIsMinimized(true);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsMinimized(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Listen for toggle event from bottom nav
  useEffect(() => {
    const handleToggleChatbot = () => {
      setIsOpen((prev) => !prev);
      setIsMinimized(false);
    };
    document.addEventListener('toggle-chatbot', handleToggleChatbot);
    return () =>
      document.removeEventListener('toggle-chatbot', handleToggleChatbot);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const newX = window.innerWidth - (e.clientX - rect.width / 2) - 24;
      const newY = window.innerHeight - (e.clientY - rect.height / 2) - 24;
      setPosition({
        x: Math.max(0, Math.min(newX, window.innerWidth - rect.width)),
        y: Math.max(80, Math.min(newY, window.innerHeight - rect.height)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const newX =
        window.innerWidth - (e.touches[0].clientX - rect.width / 2) - 24;
      const newY =
        window.innerHeight - (e.touches[0].clientY - rect.height / 2) - 24;
      setPosition({
        x: Math.max(0, Math.min(newX, window.innerWidth - rect.width)),
        y: Math.max(80, Math.min(newY, window.innerHeight - rect.height)),
      });
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      Array.from(files).forEach((file) => {
        const isImage = file.type.startsWith('image/');
        const currentImageCount = previewImages.length + newPreviews.length;

        if (isImage && currentImageCount < 5) {
          newPreviews.push(URL.createObjectURL(file));
          newFiles.push(file);
        } else if (!isImage && !selectedDoc) {
          setSelectedDoc(file);
          setDocPreview(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        }
      });

      if (newFiles.length > 0) {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
        setPreviewImages((prev) => [...prev, ...newPreviews]);
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    },
    [previewImages.length, selectedDoc]
  );

  const clearSelectedFile = useCallback((index?: number) => {
    if (index !== undefined) {
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
      setPreviewImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      setSelectedFiles([]);
      setPreviewImages([]);
      setSelectedDoc(null);
      setDocPreview(null);
    }
  }, []);

  const getGreeting = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chatbot/greeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setMessages([
          {
            role: 'assistant',
            content: data.data.response,
            products: data.data.products,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
    }
  };

  const sendMessage = async () => {
    if (
      (!input.trim() && selectedFiles.length === 0 && !selectedDoc) ||
      isLoading
    )
      return;

    let userContent = input;
    if (selectedFiles.length > 0) {
      userContent =
        selectedFiles.length > 1
          ? `🖼️ Sent ${selectedFiles.length} images`
          : `🖼️ Sent 1 image`;
    }
    if (selectedDoc) {
      userContent = userContent
        ? `${userContent} + 📄 ${selectedDoc.name}`
        : `📄 ${selectedDoc.name}`;
    }

    const userMessage: Message = {
      role: 'user',
      content: userContent || 'Sent',
      imageUrls: previewImages.length > 0 ? [...previewImages] : undefined,
      fileName: selectedDoc?.name,
      timestamp: Date.now(),
    };

    const conversationHistory = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    const filesToSend = [...selectedFiles];
    const docToSend = selectedDoc;
    clearSelectedFiles();

    try {
      const formData = new FormData();

      filesToSend.forEach((file) => {
        formData.append('images', file);
      });

      if (docToSend) {
        formData.append('file', docToSend);
      }

      if (input.trim()) formData.append('query', input);
      formData.append(
        'conversationHistory',
        JSON.stringify(conversationHistory)
      );

      const res = await fetch(`${API_URL}/api/chatbot/query`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        const responseData = data.data;

        // Handle guest cart add action
        if (
          responseData.action === 'ADD_GUEST_CART' &&
          addToCart &&
          responseData.products?.[0]
        ) {
          const product = responseData.products[0];
          addToCart(
            product,
            product.selectedSize || '',
            product.selectedColor || '',
            product.selectedVendor || '',
            product.selectedVendorId || '',
            responseData.quantity || 1,
            product.selectedSizeId || '',
            product.selectedSubProductId || ''
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: responseData.response,
            products: responseData.products,
            timestamp: Date.now(),
          },
        ]);
        setNewMessage(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, something went wrong. Try again!',
            products: [],
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (queryError) {
      console.error('Query failed:', queryError);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Try again!',
          products: [],
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([]);
    setPreviewImages([]);
    setSelectedDoc(null);
    setDocPreview(null);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickReply = (query: string) => {
    setInput(query);
    setTimeout(() => {
      inputRef.current?.focus();
      sendMessage();
    }, 100);
  };

  const clearChat = () => {
    setMessages([]);
    getGreeting();
  };

  const toggleChat = () => {
    if (isOpen) {
      setIsMinimized(!isMinimized);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const hasContent = selectedFiles.length > 0 || docPreview;

  return (
    <>
      {/* Floating Button */}
      <div
        ref={buttonRef}
        className="fixed z-50 cursor-grab select-none active:cursor-grabbing"
        style={{
          bottom: `${position.y}px`,
          right: `${position.x}px`,
        }}
        id="chatbot-floating-btn"
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      >
        <div
          className={`relative transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`}
        >
          {newMessage && !isOpen && !isDragging && (
            <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-rose-500" />
          )}
          {newMessage && !isOpen && !isDragging && (
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-rose-500" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isDragging) {
                toggleChat();
              }
            }}
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-600 hover:shadow-2xl ${
              isOpen ? 'rotate-90' : 'hover:shadow-2xl'
            }`}
            aria-label={isOpen ? 'Close chat' : 'Open chat'}
          >
            {isOpen ? (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <div className="relative">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                </span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Chat Widget */}
      <div
        ref={widgetRef}
        className={`fixed z-40 w-[95vw] max-w-md transition-all duration-300 ease-out sm:w-full ${
          isOpen
            ? isMinimized
              ? 'pointer-events-none bottom-24 right-6 translate-y-4 scale-95 opacity-0'
              : 'bottom-24 right-6 translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none bottom-24 right-6 translate-y-4 scale-95 opacity-0'
        }`}
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        <div className="flex h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl sm:h-[600px] sm:rounded-3xl">
          {/* Header */}
          <div className="relative flex-shrink-0 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 p-4 text-white sm:p-5">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm sm:h-12 sm:w-12">
                    <svg
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <span className="border-3 absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-emerald-600 bg-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">DrinksHarbour AI</h3>
                  <p className="flex items-center gap-1.5 text-xs text-emerald-100 sm:text-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    Online now
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="rounded-xl p-2 transition-colors hover:bg-white/10"
                  title="Minimize"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                </button>
                <button
                  onClick={clearChat}
                  className="rounded-xl p-2 transition-colors hover:bg-white/10"
                  title="New conversation"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-white p-3 sm:p-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-3 flex sm:mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${
                  idx === 0
                    ? 'animate-in fade-in slide-in-from-bottom-2 duration-300'
                    : ''
                }`}
                style={{
                  animationFillMode: 'both',
                  animationDelay: `${idx * 50}ms`,
                }}
              >
                {msg.role === 'assistant' && (
                  <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 shadow-sm sm:mr-3 sm:h-9 sm:w-9">
                    <span className="text-sm">🍹</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}
                >
                  {/* Multiple Images */}
                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {msg.imageUrls.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={`Upload ${i + 1}`}
                          className="h-32 max-w-[180px] rounded-xl object-cover shadow-md transition-shadow hover:shadow-lg sm:h-40 sm:max-w-[200px]"
                        />
                      ))}
                    </div>
                  )}

                  {/* Document indicator */}
                  {msg.fileName && (
                    <div className="mb-2 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm">
                      <svg
                        className="h-4 w-4 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-slate-600">{msg.fileName}</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm sm:rounded-3xl sm:px-5 sm:py-3.5 ${
                      msg.role === 'user'
                        ? 'rounded-br-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                        : 'rounded-bl-md border border-slate-200/60 bg-white text-slate-800'
                    }`}
                  >
                    <div className="text-xs leading-relaxed sm:text-sm">
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        parseMarkdown(msg.content)
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <p className="mt-2 text-right text-[10px] text-slate-400">
                        {formatTime(msg.timestamp)}
                      </p>
                    )}
                  </div>

                  {/* Products */}
                  {msg.role === 'assistant' &&
                    msg.products &&
                    msg.products.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="ml-1 text-xs font-medium text-slate-500">
                          Suggested for you
                        </p>
                        {msg.products.slice(0, 3).map((product, idx) => (
                          <a
                            key={`${product.id}-${idx}`}
                            href={`${STOREFRONT_URL}/product/${product.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 transition-all duration-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50 sm:rounded-2xl sm:p-3"
                          >
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-14 w-14 rounded-xl object-cover transition-transform duration-200 group-hover:scale-105 sm:h-16 sm:w-16"
                              />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 sm:h-16 sm:w-16">
                                <span className="text-2xl">
                                  {getProductEmoji(product.type)}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-xs font-bold text-emerald-600">
                                {formatPrice(product.minPrice)}
                                {product.hasDiscount && (
                                  <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-500">
                                    Sale!
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-emerald-100">
                              <svg
                                className="h-4 w-4 text-slate-400 transition-colors group-hover:text-emerald-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                </div>
                {msg.role === 'user' && (
                  <div className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md sm:ml-3 sm:h-9 sm:w-9">
                    <span className="text-sm">👤</span>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="animate-in fade-in slide-in-from-bottom-2 mb-4 flex justify-start duration-300">
                <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 sm:mr-3 sm:h-9 sm:w-9">
                  <span className="text-sm">🍹</span>
                </div>
                <div className="rounded-2xl rounded-bl-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length <= 2 && !isLoading && !hasContent && (
            <div className="flex flex-wrap gap-2 px-3 pb-3 sm:px-4">
              {['Wines', 'Beers', 'Spirits', 'Events'].map((label) => (
                <button
                  key={label}
                  onClick={() =>
                    handleQuickReply(`Show me ${label.toLowerCase()}`)
                  }
                  className="rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 text-xs text-emerald-700 transition-all hover:border-emerald-300 hover:from-emerald-100 hover:to-teal-100 hover:shadow-md active:scale-95 sm:px-4 sm:text-sm"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-100 bg-white p-3 sm:p-4">
            {/* Selected files preview */}
            {hasContent && (
              <div className="animate-in fade-in slide-in-from-top-2 mb-3 flex flex-wrap items-center gap-2 duration-200">
                {previewImages.map((preview, idx) => (
                  <div key={idx} className="group relative">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      className="h-14 w-14 rounded-xl border-2 border-emerald-200 object-cover shadow-sm sm:h-16 sm:w-16"
                    />
                    <button
                      onClick={() => clearSelectedFile(idx)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 shadow-md transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
                      {idx + 1}
                    </span>
                  </div>
                ))}
                {docPreview && (
                  <div className="group relative flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                    <svg
                      className="h-5 w-5 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="max-w-[100px] truncate text-xs text-slate-600 sm:max-w-[140px]">
                      {docPreview}
                    </span>
                    <button
                      onClick={() => clearSelectedFile()}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                {hasContent && (
                  <button
                    onClick={() => clearSelectedFile()}
                    className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Attachment buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isLoading || previewImages.length >= 5}
                  className="flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:p-3"
                  title={
                    previewImages.length >= 5 ? 'Max 5 images' : 'Send image'
                  }
                >
                  <svg
                    style={{
                      width: '20px',
                      height: '20px',
                      fill: 'currentColor',
                      display: 'block',
                    }}
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || selectedDoc !== null}
                  className="flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:p-3"
                  title="Upload file"
                >
                  <svg
                    style={{
                      width: '20px',
                      height: '20px',
                      fill: 'currentColor',
                      display: 'block',
                    }}
                    viewBox="0 0 24 24"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  </svg>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                multiple
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.json,.pdf,.doc,.docx,.xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                multiple
              />

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  hasContent
                    ? 'Add a message...'
                    : 'Ask me anything about drinks...'
                }
                className="flex-1 rounded-2xl border-0 bg-slate-50 px-4 py-3 text-xs transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:py-3.5"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && !hasContent) || isLoading}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl active:scale-95 disabled:from-slate-200 disabled:to-slate-300 disabled:shadow-none sm:h-14 sm:w-14"
              >
                {isLoading ? (
                  <svg
                    className="h-5 w-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInFromBottom {
          from {
            transform: translateY(10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideInFromTop {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-in {
          animation:
            fadeIn 0.3s ease-out,
            slideInFromBottom 0.3s ease-out;
        }
        .slide-in-from-top-2 {
          animation-name: slideInFromTop;
        }
      `}</style>
    </>
  );
}
