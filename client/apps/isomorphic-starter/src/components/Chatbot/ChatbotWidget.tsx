'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const getGreeting = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chatbot/greeting`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) {
        setMessages([{ role: 'assistant', content: data.data.greeting || data.data.response, timestamp: Date.now() }]);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (isOpen && messages.length === 0) getGreeting(); }, [isOpen]);

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
      }
    });
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setPreviewImages(prev => [...prev, ...newPreviews]);
    }
  };

  const clearFiles = (index?: number) => {
    if (index !== undefined) {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setPreviewImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedFiles([]);
      setPreviewImages([]);
      setSelectedDoc(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if ((!input.trim() && selectedFiles.length === 0 && !selectedDoc) || isLoading) return;
    let userContent = input;
    if (selectedFiles.length > 0) userContent = `🖼️ Sent ${selectedFiles.length} image(s)`;
    if (selectedDoc) userContent += ` + 📄 ${selectedDoc.name}`;
    
    const conversationHistory = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    const userMsg: Message = { role: 'user', content: userContent, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    
    const filesToSend = [...selectedFiles];
    const docToSend = selectedDoc;
    clearFiles();
    
    try {
      const formData = new FormData();
      filesToSend.forEach(file => formData.append('images', file));
      if (docToSend) formData.append('file', docToSend);
      if (input.trim()) formData.append('query', input);
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
      
      const res = await fetch(`${API_URL}/api/chatbot/query`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.data.response, timestamp: Date.now() }]);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          )}
        </svg>
      </button>

      {/* Chat Panel */}
      <div className={`fixed inset-0 z-[9998] bg-white transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col h-full max-w-lg mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-bold">AI</div>
              <div>
                <h3 className="font-bold">DrinksHarbour</h3>
                <p className="text-xs text-slate-400">AI Assistant</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200'}`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* File Previews */}
          {selectedFiles.length > 0 && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {previewImages.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover border" />
                  <button onClick={() => clearFiles(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
              <input type="file" ref={imageInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.doc,.docx,.txt,.csv" />
              <button onClick={() => imageInputRef.current?.click()} className="p-2 text-slate-400 hover:text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about drinks..."
                className="flex-1 px-4 py-2 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() && selectedFiles.length === 0 && !selectedDoc || isLoading}
                className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50 hover:bg-emerald-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
