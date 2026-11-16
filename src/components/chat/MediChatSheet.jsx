import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  WifiOff, 
  ExternalLink,
  Pill,
  Calendar,
  Clock,
  Camera,
  Heart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMedicine } from '../../context/MedicineContext';
import { apiFetch } from '../../config/apiConfig';
import { sendQueryToMedi, getOfflineFaqResponse } from '../../services/clientChatService';

const QUICK_CHIPS = [
  "When's my next dose?",
  "How do I scan a prescription?",
  "Explain my medicines",
  "Who made this app?"
];

const OFFLINE_FAQS = [
  {
    q: "When's my next dose?",
    a: "Check your Dashboard tab to see your next due doses. Reminders fire locally on your phone even when offline!"
  },
  {
    q: "How do I scan a prescription?",
    a: "Tap the Camera icon or go to Scanner (/scanner) to scan prescription papers or medicine strips. Offline OCR works without internet."
  },
  {
    q: "Who made this app?",
    a: "MedRemind was designed and built by Team Sanjeevani: Aryan Singhania, Tanishq Ghosh, and Naman Thard from The Newtown School, Kolkata."
  },
  {
    q: "How do I log a dose as taken?",
    a: "On your Dashboard or Schedule screen, tap the green 'Take' button next to any scheduled dose."
  }
];

export default function MediChatSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'medi',
      text: "Hi there! I'm Medi, your personal medication assistant. How can I help you manage your health today?"
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { medicines, getTodayMetrics } = useMedicine();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const reply = await sendQueryToMedi({
        message: text,
        history: messages,
        user,
        medicines
      });
      setMessages(prev => [...prev, { id: `medi-${Date.now()}`, sender: 'medi', text: reply }]);
    } catch (err) {
      console.warn('[Medi] Error generating response:', err);
      const fallback = getOfflineFaqResponse(text);
      setMessages(prev => [...prev, { id: `medi-${Date.now()}`, sender: 'medi', text: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNav = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  // Helper to detect action pills in Medi messages
  const renderMessageContent = (text) => {
    const lower = text.toLowerCase();
    const actions = [];

    if (lower.includes('medicines') || lower.includes('add medicine')) {
      actions.push({ label: 'Open Medicines', path: '/medicines', icon: Pill });
    }
    if (lower.includes('scan') || lower.includes('scanner') || lower.includes('prescription')) {
      actions.push({ label: 'Scan Prescription', path: '/scanner', icon: Camera });
    }
    if (lower.includes('schedule') || lower.includes('time slot')) {
      actions.push({ label: 'View Schedule', path: '/schedule', icon: Calendar });
    }
    if (lower.includes('history') || lower.includes('compliance') || lower.includes('report') || lower.includes('chart')) {
      actions.push({ label: 'View History', path: '/history', icon: Clock });
    }
    if (lower.includes('profile') || lower.includes('allerg') || lower.includes('emergency')) {
      actions.push({ label: 'Open Profile', path: '/profile', icon: Heart });
    }

    return (
      <div>
        <p className="whitespace-pre-line text-sm text-gray-800 leading-relaxed">{text}</p>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-teal-100">
            {actions.map((act, idx) => {
              const Icon = act.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleNav(act.path)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 text-xs font-semibold rounded-full border border-teal-200 shadow-sm transition-colors active:scale-95"
                >
                  <Icon className="w-3 h-3 text-teal-600" />
                  {act.label}
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 sm:absolute sm:bottom-20 sm:right-4 z-40 flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-3.5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 border-2 border-white/80"
          aria-label="Open Medi Chatbot"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
          </div>
          <span className="text-xs font-bold tracking-wide pr-0.5">Medi</span>
        </button>
      )}

      {/* Slide-over / Modal Chat Sheet */}
      {isOpen && (
        <div className="fixed inset-0 sm:absolute sm:inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md mx-auto h-[82vh] max-h-[640px] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t border-gray-100">
            {/* Header */}
            <div className="px-4 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-xs">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm tracking-wide">Medi</h3>
                    <span className="px-1.5 py-0.2 bg-teal-800/60 rounded-full text-[10px] font-semibold text-teal-100 border border-teal-400/30">
                      AI Companion
                    </span>
                  </div>
                  <p className="text-[11px] text-teal-100/90 leading-tight">
                    {isOnline ? "Always here to help you" : "Offline mode — local answers ready"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white active:scale-90"
                aria-label="Close Medi Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offline status indicator banner */}
            {!isOnline && (
              <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2 text-amber-800 text-xs">
                <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>You are offline. Showing cached answers and local guidance.</span>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAFBFB]">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs text-sm ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-br-xs'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-xs'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed">{msg.text}</p>
                    ) : (
                      renderMessageContent(msg.text)
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Chips */}
            <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
              {QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  disabled={loading}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-700 border border-gray-200 transition-colors disabled:opacity-50 shrink-0"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-white border-t border-gray-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask Medi anything about your meds..."
                className="flex-1 bg-gray-100 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="p-2.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
