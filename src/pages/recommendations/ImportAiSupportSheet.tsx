import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Headset, Send, X } from 'lucide-react';
import { supabase } from '@/services';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import { AvatarImage } from '@/lib/presetAvatars';
import { fallbackAvatarColor, initialsFrom } from '@/lib/avatarFallback';

const AI_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-ai-support`;
const WHATSAPP_URL = 'https://wa.me/2347015470881?text=Hi%20QAfrica%20support%2C%20I%20need%20help%20with%20my%20import%20order.';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function WhatsAppMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 2a9.8 9.8 0 0 0-8.43 14.8L2.4 22l5.36-1.1A9.8 9.8 0 1 0 12 2Zm0 17.9a8.1 8.1 0 0 1-4.14-1.14l-.3-.18-3.18.65.67-3.1-.2-.32A8.12 8.12 0 1 1 12 19.9Zm4.45-6.09c-.24-.12-1.44-.7-1.67-.78-.22-.08-.39-.12-.56.12-.16.24-.64.79-.79.95-.14.16-.29.18-.53.06-.24-.12-1.03-.38-1.97-1.22-.73-.65-1.22-1.45-1.36-1.7-.14-.24-.01-.37.1-.49.1-.1.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.55-.43h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.67 2.55 4.05 3.58.57.25 1.01.4 1.36.51.57.18 1.09.16 1.5.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"/>
    </svg>
  );
}

export function WhatsAppFloatingButton() {
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
      aria-label="Chat with QAfrica on WhatsApp"
      className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-30 w-12 h-12 rounded-full bg-emerald-500 text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform">
      <WhatsAppMark />
    </a>
  );
}

export default function ImportAiSupportSheet({ isAuthenticated, onRequireAuth, showTrigger = true, open: controlledOpen, onOpenChange }: {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [humanStatus, setHumanStatus] = useState<'ai' | 'human_requested' | 'human_assigned' | 'human_active' | 'returned_to_ai' | null>(null);
  const { customer } = useCustomerAuthStore();
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const storageKey = customerId ? `qafrica_support_chat_${customerId}` : null;
  const customerAvatarUrl = customer?.avatar_url ?? null;
  const customerInitials = initialsFrom(customer?.full_name);
  const customerAvatarBg = fallbackAvatarColor(customer?.id ?? customerId ?? 'support');
  const INACTIVITY_MS = 30 * 60 * 1000;

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const updateViewport = () => {
      setViewport({
        height: Math.round(visualViewport.height),
        top: Math.max(0, Math.round(visualViewport.offsetTop)),
      });
    };

    updateViewport();
    visualViewport.addEventListener('resize', updateViewport);
    visualViewport.addEventListener('scroll', updateViewport);

    return () => {
      visualViewport.removeEventListener('resize', updateViewport);
      visualViewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(AI_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor: 'customer', channel: 'website', action: 'get_state' }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        if (data.conversation_id) setConversationId(data.conversation_id);
        if (data.status) setHumanStatus(data.status);
      } catch {
        // Server state is optional until the first real support message.
      }
    })();
    return () => { cancelled = true; };
  }, [open, isAuthenticated]);


  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const id = session?.user?.id ?? null;
      setCustomerId(id);
      if (!id) return;
      try {
        const raw = localStorage.getItem(`qafrica_support_chat_${id}`);
        if (!raw) return;
        const saved = JSON.parse(raw) as { messages?: ChatMessage[]; lastActivityAt?: number };
        if (!saved.lastActivityAt || Date.now() - saved.lastActivityAt >= INACTIVITY_MS) {
          localStorage.removeItem(`qafrica_support_chat_${id}`);
          return;
        }
        if (Array.isArray(saved.messages)) setMessages(saved.messages);
      } catch {
        localStorage.removeItem(`qafrica_support_chat_${id}`);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!storageKey || !messages.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ messages, lastActivityAt: Date.now() }));
    } catch {
      // Ignore storage failures; chat still works for the current page session.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (!storageKey || !messages.length) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) as { lastActivityAt?: number } : null;
      const lastActivityAt = saved?.lastActivityAt ?? Date.now();
      const remaining = Math.max(0, INACTIVITY_MS - (Date.now() - lastActivityAt));
      timer = setTimeout(() => {
        setMessages([]);
        setOpen(false);
        localStorage.removeItem(storageKey);
      }, remaining);
    } catch {
      // Ignore storage failures.
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [messages, storageKey]);

  const touchChat = () => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem(storageKey, JSON.stringify({
        messages,
        lastActivityAt: Date.now(),
        ...saved,
      }));
    } catch {
      // Ignore storage failures.
    }
  };

  const ask = async () => {
    const message = input.trim();
    if (!message || loading) return;
    if (!isAuthenticated) { setOpen(false); onRequireAuth(); return; }
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    touchChat();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: 'customer',
          channel: 'website',
          conversation_id: conversationId,
          message,
          messages,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Support is temporarily unavailable.');
      if (data.conversation_id) setConversationId(data.conversation_id);
      if (data.status) setHumanStatus(data.status);
      if (data.human_active) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Your conversation is currently with a QAfrica Support agent. Your next messages will be delivered to the agent here.' }]);
      } else if (data.answer) {
        setMessages(prev => [...prev, { role: 'assistant', content: String(data.answer).replace(/\\*\\*(.*?)\\*\\*/g, '$1') }]);
      }
      touchChat();
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: (error instanceof Error ? error.message : 'Support is temporarily unavailable.').replace(/\\*\\*(.*?)\\*\\*/g, '$1') }]);
      touchChat();
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open || !conversationId) return;
    const channel = supabase
      .channel(`qafrica-website-support-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'import_ai_whatsapp_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { id?: string; sender_type?: string; body?: string; direction?: string };
          if (row.sender_type !== 'human' || !row.body) return;
          setMessages(prev => [...prev, { role: 'assistant', content: row.body || '' }]);
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, conversationId]);

  useEffect(() => {
    if (!open || !conversationId) return;
    const channel = supabase
      .channel(`qafrica-website-support-status-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'import_ai_whatsapp_conversations', filter: `id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { status?: typeof humanStatus };
          if (row.status) setHumanStatus(row.status);
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, conversationId]);



  return (
    <>
      {showTrigger && !open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 lg:bottom-6 lg:right-20 z-30 flex items-center gap-2 rounded-full bg-gray-900 text-white px-4 py-3 shadow-xl hover:bg-gray-800 transition-colors"
          aria-label="Open QAfrica support">
          <Headset className="w-4 h-4" /><span className="text-xs font-bold">Support</span>
        </button>
      )}
      {open && (
        <>
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 z-50 bg-white flex flex-col overflow-hidden sm:left-auto sm:w-[420px] sm:shadow-2xl"
            style={{
              top: viewport ? String(viewport.top) + 'px' : '0px',
              height: viewport ? String(viewport.height) + 'px' : '100dvh',
              overscrollBehavior: 'none',
            }}
          >
            <header className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center"><Headset className="w-4 h-4" /></div>
                <div><p className="text-sm font-bold">QAfrica Support</p><p className="text-[10px] text-gray-300">Import orders, products & bills</p></div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-300 hover:text-white" aria-label="Close support"><X className="w-4 h-4" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.length === 0 && <div className="bg-white border border-gray-100 rounded-xl p-3"><p className="text-xs font-bold text-gray-800 mb-1">How can I help?</p><p className="text-[11px] leading-relaxed text-gray-500">Ask about your import orders, tracking, bills, saved addresses, or products.</p></div>}
              {messages.map((m, i) => {
                const isCustomer = m.role === 'user';
                return (
                  <div key={i} className={isCustomer ? 'flex justify-end items-end gap-2' : 'flex justify-start items-end gap-2'}>
                    {!isCustomer && (
                      <div className="w-7 h-7 shrink-0 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-sm overflow-hidden" aria-hidden="true">
                        <Headset className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className={isCustomer ? 'max-w-[78%] rounded-2xl rounded-br-md bg-gray-900 text-white px-3 py-2' : 'max-w-[78%] rounded-2xl rounded-bl-md bg-white border border-gray-100 text-gray-700 px-3 py-2'}>
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                    {isCustomer && (
                      <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-white shadow-sm" style={{ backgroundColor: customerAvatarUrl ? undefined : customerAvatarBg }} aria-label="Your profile picture">
                        {customerAvatarUrl ? (
                          <AvatarImage avatarUrl={customerAvatarUrl} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-[10px] font-bold">{customerInitials}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-sm overflow-hidden" aria-hidden="true">
                    <Headset className="w-3.5 h-3.5" />
                  </div>
                  <div className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl rounded-bl-md px-3 py-2.5 shadow-sm animate-pulse" aria-label="QAfrica Support is typing">
                    <div className="relative flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {(humanStatus === 'human_requested' || humanStatus === 'human_assigned') && (
              <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-800">
                Your request has been sent to a QAfrica Support agent. You can keep messaging here.
              </div>
            )}
            {humanStatus === 'human_active' && (
              <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 text-[11px] text-emerald-800">
                You are chatting with a QAfrica Support agent.
              </div>
            )}
                        <form onSubmit={e => { e.preventDefault(); void ask(); }} className="flex items-end gap-2 p-3 border-t border-gray-100 bg-white">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder={isAuthenticated ? 'Ask about your import…' : 'Sign in to contact support'} rows={1} maxLength={4000} className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-xs outline-none focus:border-gray-400" />
              <button type="submit" disabled={!input.trim() || loading} className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-40" aria-label="Send message"><SendIcon /></button>
            </form>
          </motion.div>
        </>
      )}
    </>
  );
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m4 12 16-8-8 16-2.5-5.5L4 12Z"/></svg>;
}
