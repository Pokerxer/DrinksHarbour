'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

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
  wine: '🍷', beer: '🍺', spirit: '🥃', whiskey: '🥃', vodka: '❄️',
  gin: '🌿', rum: '🏴‍☠️', tequila: '🌵', champagne: '🍾', cider: '🍎', default: '🍹'
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
  let listItems: string[] = [];
  let inList = false;
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-5 my-2 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-slate-700">{parseInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };
  
  const parseInline = (text: string): React.ReactNode => {
    let result = text;
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded text-xs font-mono text-rose-600">$1</code>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-emerald-600 hover:text-emerald-700 underline">$1</a>');
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('- ') || line.trim().match(/^[\d]+\.\s/)) {
      if (!inList) { inList = true; }
      listItems.push(line.replace(/^[\s]*[-*\d.]+\s*/, ''));
      continue;
    } else if (inList) { flushList(); }
    
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-bold mt-3 mb-1 text-slate-800">{trimmedLine.replace('### ', '')}</h4>);
    } else if (trimmedLine.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-bold mt-4 mb-2 text-slate-800">{trimmedLine.replace('## ', '')}</h3>);
    } else if (trimmedLine.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-4 mb-2 text-slate-800">{trimmedLine.replace('# ', '')}</h2>);
    } else if (trimmedLine.match(/^[\*\-]\s/)) {
      elements.push(<li key={i} className="text-sm ml-3 text-slate-700">{parseInline(trimmedLine.replace(/^[\*\-]\s/, ''))}</li>);
    } else if (trimmedLine) {
      elements.push(<p key={i} className="text-sm my-1 text-slate-700 leading-relaxed">{parseInline(trimmedLine)}</p>);
    }
  }
  flushList();
  return elements;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
};

export default function ChatbotWidget() {
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, showToast]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) getGreeting();
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/') && previewImages.length + newPreviews.length < 5) {
        newPreviews.push(URL.createObjectURL(file));
        newFiles.push(file);
      } else if (!selectedDoc) {
        setSelectedDoc(file);
        setDocPreview(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      }
    });
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setPreviewImages(prev => [...prev, ...newPreviews]);
    }
  };

  const clearSelectedFile = (index?: number) => {
    if (index !== undefined) {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setPreviewImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedFiles([]);
      setPreviewImages([]);
      setSelectedDoc(null);
      setDocPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const getGreeting = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chatbot/greeting`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) {
        setMessages([{ role: 'assistant', content: data.data.greeting || data.data.response, products: data.data.products || [], timestamp: Date.now() }]);
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && selectedFiles.length === 0 && !selectedDoc) || isLoading) return;
    let userContent = input;
    if (selectedFiles.length > 0) userContent = selectedFiles.length > 1 ? `🖼️ Sent ${selectedFiles.length} images` : `🖼️ Sent 1 image`;
    if (selectedDoc) userContent = userContent ? `${userContent} + 📄 ${selectedDoc.name}` : `📄 ${selectedDoc.name}`;
    const userMessage: Message = { role: 'user', content: userContent || 'Sent', imageUrls: previewImages.length > 0 ? [...previewImages] : undefined, fileName: selectedDoc?.name, timestamp: Date.now() };
    const conversationHistory = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    const filesToSend = [...selectedFiles];
    const docToSend = selectedDoc;
    clearSelectedFile();
    try {
      const formData = new FormData();
      filesToSend.forEach(file => formData.append('images', file));
      if (docToSend) formData.append('file', docToSend);
      if (input.trim()) formData.append('query', input);
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
      const res = await fetch(`${API_URL}/api/chatbot/query`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        const responseData = data.data;
        setMessages(prev => [...prev, { role: 'assistant', content: responseData.response, products: responseData.products, timestamp: Date.now() }]);
        setNewMessage(true);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again!', products: [], timestamp: Date.now() }]);
      }
    } catch (queryError) {
      console.error('Query failed:', queryError);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again!', products: [], timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleQuickReply = (query: string) => {
    setInput(query);
    setTimeout(() => { inputRef.current?.focus(); sendMessage(); }, 100);
  };

  const clearChat = () => { setMessages([]); getGreeting(); };
  const toggleChat = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsMinimized(!isMinimized);
    }
  };
  const hasContent = selectedFiles.length > 0 || docPreview;

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50" id="chatbot-floating-btn">
        <button 
          onClick={toggleChat} 
          className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-xl flex items-center justify-center transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/40 ${isOpen && !isMinimized ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} 
          aria-label={isOpen ? "Close chat" : "Open chat"}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {newMessage && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full animate-pulse" />}
            </div>
          )}
        </button>
      </div>

      {/* Chat Widget */}
      <div 
        ref={widgetRef} 
        className={`fixed z-40 w-[92vw] sm:w-[400px] md:w-[420px] transition-all duration-400 ease-out ${isOpen && !isMinimized ? 'opacity-100 translate-y-0 scale-100 bottom-24 right-4 sm:right-6' : 'opacity-0 translate-y-8 scale-95 pointer-events-none bottom-24 right-4 sm:right-6'}`}
        style={{ maxHeight: 'calc(100vh - 140px)' }}
      >
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col h-[85vh] sm:h-[600px] max-h-[580px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">DrinksHarbour</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                    AI Assistant
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button onClick={clearChat} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-all" title="New chat">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button onClick={() => setIsMinimized(true)} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-all" title="Minimize">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-slate-50 to-white space-y-3 sm:space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 sm:gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-[10px] sm:text-xs font-bold">AI</span>
                  </div>
                )}
                <div className={`max-w-[78%] sm:max-w-[82%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Product Cards */}
                  {msg.role === 'assistant' && msg.products && msg.products.length > 1 && (() => {
                    const discussedProducts = msg.products.filter(p => p.name && msg.content.toLowerCase().includes(p.name.toLowerCase()));
                    return discussedProducts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 w-full">
                        {discussedProducts.slice(0, 4).map((product) => (
                          <a key={product.id} href={`/product/${product.slug}`} target="_blank" rel="noopener noreferrer" className="block bg-white rounded-lg sm:rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group">
                            <div className="aspect-square bg-slate-100 relative overflow-hidden">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center"><span className="text-xl sm:text-2xl">{getProductEmoji(product.type)}</span></div>
                              )}
                              {product.hasDiscount && <span className="absolute top-1 left-1 px-1 py-0.5 bg-rose-500 text-white text-[8px] sm:text-[9px] font-bold rounded">SALE</span>}
                            </div>
                            <div className="p-1.5 sm:p-2">
                              <p className="text-[10px] sm:text-xs font-medium text-slate-800 line-clamp-2 leading-tight">{product.name}</p>
                              <p className="text-xs sm:text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.minPrice)}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {/* Message Bubble */}
                  <div className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'}`}>
                    <div className="text-[13px] sm:text-sm leading-relaxed">{msg.role === 'user' ? <p className="whitespace-pre-wrap">{msg.content}</p> : parseMarkdown(msg.content)}</div>
                    {msg.role === 'assistant' && <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">{formatTime(msg.timestamp)}</p>}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-[10px] sm:text-xs font-bold">ME</span>
                  </div>
                )}
              </div>
            ))}
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-2 sm:gap-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm"><span className="text-white text-[10px] sm:text-xs font-bold">AI</span></div>
                <div className="bg-white rounded-xl sm:rounded-2xl rounded-tl-sm border border-slate-200 px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length <= 2 && !isLoading && !hasContent && (
            <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex flex-wrap gap-1.5 sm:gap-2">
              {['Wines', 'Beers', 'Spirits', 'Events'].map((label) => (
                <button key={label} onClick={() => handleQuickReply(`Show me ${label.toLowerCase()}`)} className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium bg-slate-100 text-slate-600 rounded-full hover:bg-emerald-500 hover:text-white transition-all">
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-2 sm:p-3 bg-white border-t border-slate-100 flex-shrink-0">
            {hasContent && (
              <div className="mb-1.5 sm:mb-2 flex flex-wrap gap-1.5 sm:gap-2 items-center">
                {previewImages.map((preview, idx) => (
                  <div key={idx} className="relative group flex-shrink-0">
                    <img src={preview} alt={`Preview ${idx + 1}`} className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover border border-slate-200" />
                    <button onClick={() => clearSelectedFile(idx)} className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px]">✕</button>
                  </div>
                ))}
                {docPreview && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="text-[10px] sm:text-xs text-slate-600 max-w-[60px] sm:max-w-[80px] truncate">{docPreview}</span>
                  </div>
                )}
                <button onClick={() => clearSelectedFile()} className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-rose-50 text-rose-600 text-[10px] sm:text-xs rounded-full hover:bg-rose-100 transition-colors font-medium">Clear</button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".txt,.csv,.json,.pdf,.doc,.docx,.xlsx,.xls" onChange={handleFileSelect} className="hidden" multiple />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" multiple />
            <div className="flex gap-1.5 sm:gap-2 items-center">
              <div className="flex gap-0.5">
                <button onClick={() => imageInputRef.current?.click()} disabled={isLoading || previewImages.length >= 5} className="p-1.5 sm:p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-40" title="Send image">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || selectedDoc !== null} className="p-1.5 sm:p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-40" title="Upload file">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
              </div>
              <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder="Ask about drinks..." className="flex-1 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all placeholder:text-slate-400" disabled={isLoading} />
              <button onClick={sendMessage} disabled={(!input.trim() && !hasContent) || isLoading} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:from-slate-200 disabled:to-slate-300 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0">
                {isLoading ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 z-50">
          <div className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {toast.type === 'success' ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            <span className="font-medium text-xs sm:text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
