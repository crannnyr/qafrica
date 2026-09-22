import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '@/services';
import CONFIG from '@/lib/config';

const AI_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-ai-support`;
const WHATSAPP_AI_URL = 'https://wa.me/2347015470881?text=Hi%20QAfrica%20AI%2C%20I%20need%20help%20with%20my%20import.';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function ImportAiSupportSheet({
  isAuthenticated,
  onRequireAuth,
}: {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);


  const ask = async () => {
    const message = input.trim();
    if (!message || loading) return;
    if (!isAuthenticated) {
      setOpen(false);
      onRequireAuth();
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Your session has expired. Please sign in again.' }]);
        setLoading(false);
        return;
      }

      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actor: 'customer', message, messages }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'AI support is temporarily unavailable.');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: String(data?.answer || 'I could not find an answer for that yet. Please try another question.').replace(/\*\*(.*?)\*\*/g, '$1'),
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: (error instanceof Error ? error.message : 'AI support is temporarily unavailable.').replace(/\*\*(.*?)\*\*/g, '$1'),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-30 flex flex-col items-end gap-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gray-900 text-white px-4 py-3 shadow-xl hover:bg-gray-800 transition-colors"
            aria-label="Open QAfrica AI support"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-bold">AI Support</span>
          </button>

          <a
            href={WHATSAPP_AI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-green-200 bg-white text-green-700 px-4 py-3 shadow-lg hover:bg-green-50 transition-colors"
            aria-label="Open QAfrica WhatsApp AI"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-bold">WhatsApp AI</span>
          </a>
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />
          <section className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] sm:bottom-6 sm:right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[75vh]">
            <header className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">QAfrica AI Support</p>
                  <p className="text-[10px] text-gray-300">Import orders, products & bills</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-300 hover:text-white" aria-label="Close AI support">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 min-h-[260px] max-h-[50vh] overflow-y-auto p-3 space-y-2 bg-gray-50">
              {messages.length === 0 && (
                <div className="bg-white border border-gray-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-gray-800 mb-1">How can I help?</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Ask about your import orders, tracking, bills, saved addresses, or products.
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-md bg-gray-900 text-white px-3 py-2'
                    : 'max-w-[85%] rounded-2xl rounded-bl-md bg-white border border-gray-100 text-gray-700 px-3 py-2'
                  }>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-3 py-2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={e => { e.preventDefault(); void ask(); }}
              className="flex items-end gap-2 p-3 border-t border-gray-100 bg-white"
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                placeholder={isAuthenticated ? 'Ask about your import…' : 'Sign in to use AI support'}
                rows={1}
                maxLength={4000}
                id="qafrica-ai-support-input"
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-gray-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </>
      )}
    </>
  );
}
