'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCart } from '@/context/CartContext';

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
  default: '🍹'
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
      const rows = currentTable.filter(row => row.trim() && !row.match(/^\|[\s\-:|]+\|$/));
      if (rows.length > 0) {
        const headers = rows[0].split('|').map(h => h.trim()).filter(Boolean);
        const bodyRows = rows.slice(2);
        
        elements.push(
          <div key={`table-${elements.length}`} className="overflow-x-auto my-3">
            <table className="min-w-full text-xs sm:text-sm border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <thead className="bg-slate-100">
                <tr>
                  {headers.map((header, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold text-slate-700 border-b">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {row.split('|').map((cell, j) => {
                      const content = cell.trim();
                      if (j >= headers.length) return null;
                      return <td key={j} className="px-3 py-2.5 text-slate-600">{parseInline(content)}</td>;
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
        <ul key={`list-${elements.length}`} className="list-disc pl-5 my-2 space-y-1.5">
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
    result = result.replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600">$1</code>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-emerald-600 hover:text-emerald-700 underline underline-offset-2">$1</a>');
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('|') && line.includes('|')) {
      if (!inTable) { flushList(); inTable = true; }
      currentTable.push(line);
      continue;
    } else if (inTable) { flushTable(); }
    
    if (line.trim().startsWith('- ') || line.trim().match(/^[\d]+\.\s/)) {
      if (!inList) { inList = true; }
      listItems.push(line.replace(/^[\s]*[-*\d.]+\s*/, ''));
      continue;
    } else if (inList) { flushList(); }
    
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-bold mt-4 mb-2 text-slate-800">{trimmedLine.replace('### ', '')}</h4>);
    } else if (trimmedLine.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-bold mt-5 mb-2 text-slate-800">{trimmedLine.replace('## ', '')}</h3>);
    } else if (trimmedLine.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-5 mb-2 text-slate-800">{trimmedLine.replace('# ', '')}</h2>);
    } else if (trimmedLine.match(/^[\*\-]\s/)) {
      elements.push(<li key={i} className="text-sm ml-4 text-slate-700">{parseInline(trimmedLine.replace(/^[\*\-]\s/, ''))}</li>);
    } else if (trimmedLine) {
      elements.push(<p key={i} className="text-sm my-1.5 text-slate-700 leading-relaxed">{parseInline(trimmedLine)}</p>);
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
    minute: '2-digit' 
  });
};

export default function ChatbotWidget() {
  const { addToCart } = useCart() || {};
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
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
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
      setIsOpen(prev => !prev);
      setIsMinimized(false);
    };
    document.addEventListener('toggle-chatbot', handleToggleChatbot);
    return () => document.removeEventListener('toggle-chatbot', handleToggleChatbot);
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
      const newX = window.innerWidth - (e.touches[0].clientX - rect.width / 2) - 24;
      const newY = window.innerHeight - (e.touches[0].clientY - rect.height / 2) - 24;
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    Array.from(files).forEach(file => {
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
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setPreviewImages(prev => [...prev, ...newPreviews]);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [previewImages.length, selectedDoc]);

  const clearSelectedFile = useCallback((index?: number) => {
    if (index !== undefined) {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setPreviewImages(prev => prev.filter((_, i) => i !== index));
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
        setMessages([{
          role: 'assistant',
          content: data.data.response,
          products: data.data.products,
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && selectedFiles.length === 0 && !selectedDoc) || isLoading) return;

    let userContent = input;
    if (selectedFiles.length > 0) {
      userContent = selectedFiles.length > 1 
        ? `🖼️ Sent ${selectedFiles.length} images`
        : `🖼️ Sent 1 image`;
    }
    if (selectedDoc) {
      userContent = userContent ? `${userContent} + 📄 ${selectedDoc.name}` : `📄 ${selectedDoc.name}`;
    }
        
    const userMessage: Message = { 
      role: 'user', 
      content: userContent || 'Sent',
      imageUrls: previewImages.length > 0 ? [...previewImages] : undefined,
      fileName: selectedDoc?.name,
      timestamp: Date.now()
    };
    
    const conversationHistory = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    const filesToSend = [...selectedFiles];
    const docToSend = selectedDoc;
    clearSelectedFiles();

    try {
      const formData = new FormData();
      
      filesToSend.forEach(file => {
        formData.append('images', file);
      });

      if (docToSend) {
        formData.append('file', docToSend);
      }
      
      if (input.trim()) formData.append('query', input);
      formData.append('conversationHistory', JSON.stringify(conversationHistory));

      const res = await fetch(`${API_URL}/api/chatbot/query`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        const responseData = data.data;
        
        // Handle guest cart add action
        if (responseData.action === 'ADD_GUEST_CART' && addToCart && responseData.products?.[0]) {
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
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: responseData.response,
          products: responseData.products,
          timestamp: Date.now()
        }]);
        setNewMessage(true);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, something went wrong. Try again!',
          products: [],
          timestamp: Date.now()
        }]);
      }
    } catch (queryError) {
      console.error('Query failed:', queryError);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Try again!',
        products: [],
        timestamp: Date.now()
      }]);
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
        className="fixed z-50 cursor-grab active:cursor-grabbing select-none"
        style={{ 
          bottom: `${position.y}px`, 
          right: `${position.x}px`,
        }}
        id="chatbot-floating-btn"
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      >
        <div className={`relative transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`}>
          {newMessage && !isOpen && !isDragging && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full animate-ping" />
          )}
          {newMessage && !isOpen && !isDragging && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isDragging) {
                toggleChat();
              }
            }}
            className={`w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-600 text-white shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl ${
              isOpen ? 'rotate-90' : 'hover:shadow-2xl'
            }`}
            aria-label={isOpen ? "Close chat" : "Open chat"}
          >
            {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                </span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Chat Widget */}
      <div 
        ref={widgetRef}
        className={`fixed z-40 w-[95vw] sm:w-full max-w-md transition-all duration-300 ease-out ${
          isOpen 
            ? isMinimized 
              ? 'opacity-0 translate-y-4 scale-95 pointer-events-none bottom-24 right-6' 
              : 'opacity-100 translate-y-0 scale-100 bottom-24 right-6'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none bottom-24 right-6'
        }`}
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/60 overflow-hidden flex flex-col h-[500px] sm:h-[600px]">
          
          {/* Header */}
          <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white p-4 sm:p-5 flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-3 border-emerald-600 rounded-full flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">DrinksHarbour AI</h3>
                  <p className="text-xs sm:text-sm text-emerald-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    Online now
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  title="Minimize"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button 
                  onClick={clearChat}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  title="New conversation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-slate-50 via-white to-white">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex mb-3 sm:mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${
                  idx === 0 ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''
                }`}
                style={{ animationFillMode: 'both', animationDelay: `${idx * 50}ms` }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0 mr-2 sm:mr-3 shadow-sm">
                    <span className="text-sm">🍹</span>
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                  {/* Multiple Images */}
                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {msg.imageUrls.map((img, i) => (
                        <img 
                          key={i}
                          src={img} 
                          alt={`Upload ${i + 1}`} 
                          className="max-w-[180px] sm:max-w-[200px] h-32 sm:h-40 object-cover rounded-xl shadow-md hover:shadow-lg transition-shadow"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Document indicator */}
                  {msg.fileName && (
                    <div className="mb-2 px-3 py-2 bg-slate-100 rounded-xl inline-flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-slate-600">{msg.fileName}</span>
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`rounded-2xl sm:rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-br-md' 
                      : 'bg-white text-slate-800 rounded-bl-md border border-slate-200/60'
                  }`}>
                    <div className="text-sm sm:text-base leading-relaxed">
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        parseMarkdown(msg.content)
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <p className="text-[10px] text-slate-400 mt-2 text-right">
                        {formatTime(msg.timestamp)}
                      </p>
                    )}
                  </div>
                  
                  {/* Products */}
                  {msg.role === 'assistant' && msg.products && msg.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-500 ml-1">Suggested for you</p>
                      {msg.products.slice(0, 3).map((product) => (
                        <a
                          key={product.id}
                          href={`/product/${product.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2.5 sm:p-3 bg-white rounded-xl sm:rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-200 group"
                        >
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
                              <span className="text-2xl">{getProductEmoji(product.type)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                            <p className="text-sm font-bold text-emerald-600 mt-0.5">
                              {formatPrice(product.minPrice)}
                              {product.hasDiscount && <span className="ml-1.5 text-xs text-rose-500 font-medium px-1.5 py-0.5 bg-rose-50 rounded-full">Sale!</span>}
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 ml-2 sm:ml-3 shadow-md">
                    <span className="text-sm">👤</span>
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0 mr-2 sm:mr-3">
                  <span className="text-sm">🍹</span>
                </div>
                <div className="bg-white rounded-2xl rounded-bl-md border border-slate-200/60 px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length <= 2 && !isLoading && !hasContent && (
            <div className="px-3 sm:px-4 pb-3 flex flex-wrap gap-2">
              {['Wines', 'Beers', 'Spirits', 'Events'].map((label) => (
                <button
                  key={label}
                  onClick={() => handleQuickReply(`Show me ${label.toLowerCase()}`)}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 rounded-full hover:from-emerald-100 hover:to-teal-100 transition-all border border-emerald-200 hover:border-emerald-300 hover:shadow-md active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
            {/* Selected files preview */}
            {hasContent && (
              <div className="mb-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-200 items-center">
                {previewImages.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img 
                      src={preview} 
                      alt={`Preview ${idx + 1}`} 
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-emerald-200 shadow-sm"
                    />
                    <button 
                      onClick={() => clearSelectedFile(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-rose-600"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <span className="absolute -bottom-1 -left-1 w-4 h-4 bg-emerald-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </div>
                ))}
                {docPreview && (
                  <div className="relative group flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-slate-600 max-w-[100px] sm:max-w-[140px] truncate">{docPreview}</span>
                    <button 
                      onClick={() => clearSelectedFile()}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {hasContent && (
                  <button 
                    onClick={() => clearSelectedFile()}
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 text-xs rounded-full hover:bg-rose-100 transition-colors font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
            
            <div className="flex gap-2 items-center">
              {/* Attachment buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isLoading || previewImages.length >= 5}
                  className="p-2.5 sm:p-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  title={previewImages.length >= 5 ? "Max 5 images" : "Send image"}
                >
                  <svg style={{ width: '20px', height: '20px', fill: 'currentColor', display: 'block' }} viewBox="0 0 24 24">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || selectedDoc !== null}
                  className="p-2.5 sm:p-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  title="Upload file"
                >
                  <svg style={{ width: '20px', height: '20px', fill: 'currentColor', display: 'block' }} viewBox="0 0 24 24">
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
                placeholder={hasContent ? "Add a message..." : "Ask me anything about drinks..."}
                className="flex-1 px-4 py-3 sm:py-3.5 bg-slate-50 border-0 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && !hasContent) || isLoading}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center disabled:from-slate-200 disabled:to-slate-300 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:shadow-none"
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInFromBottom {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInFromTop {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-in {
          animation: fadeIn 0.3s ease-out, slideInFromBottom 0.3s ease-out;
        }
        .slide-in-from-top-2 {
          animation-name: slideInFromTop;
        }
      `}</style>
    </>
  );
}
