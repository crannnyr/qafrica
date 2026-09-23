import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, CheckCircle2, Loader, MessageCircle, RefreshCw, Send, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

const AI_URL = CONFIG.SUPABASE_URL + '/functions/v1/import-ai-support';

type Customer = { id?: string; full_name?: string | null; email?: string | null; phone?: string | null };
type Conversation = {
  id: string; wa_id: string; customer_id: string | null;
  status: 'ai' | 'human_requested' | 'human_assigned' | 'human_active';
  last_inbound_at: string | null; last_outbound_at: string | null;
  created_at: string; updated_at: string; customers?: Customer | Customer[] | null;
};
type Message = {
  id: string; direction: 'inbound' | 'outbound'; sender_type: 'customer' | 'ai' | 'human';
  body: string; whatsapp_message_id?: string | null; created_at: string;
};

function customerOf(c: Conversation): Customer | null {
  if (!c.customers) return null;
  return Array.isArray(c.customers) ? (c.customers[0] || null) : c.customers;
}

async function supportRequest(token: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'admin', manager_token: token, action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Support request failed');
  return data;
}

let alertAudioContext: AudioContext | null = null;

function getAlertAudioContext() {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!alertAudioContext || alertAudioContext.state === 'closed') alertAudioContext = new AudioCtx();
  return alertAudioContext;
}

function unlockAlertSound() {
  try {
    const ctx = getAlertAudioContext();
    if (!ctx) return false;
    void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

function playAlertSound() {
  try {
    const ctx = getAlertAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
    osc.connect(gain); osc.start(now); osc.stop(now + 0.22);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.27);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    gain2.connect(ctx.destination);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine'; osc2.frequency.setValueAtTime(1175, now + 0.25);
    osc2.connect(gain2); osc2.start(now + 0.25); osc2.stop(now + 0.48);
    return true;
  } catch {
    return false;
  }
}

export function AiSupportAlertMonitor({ token, enabled = true }: { token: string; enabled?: boolean }) {
  const previous = useRef<Map<string, Conversation['status']>>(new Map());
  const initialised = useRef(false);

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;

    const check = async () => {
      try {
        const data = await supportRequest(token, 'list_support_conversations');
        if (cancelled) return;
        const rows: Conversation[] = data.conversations || [];
        const next = new Map<string, Conversation['status']>();
        let alertConversation: Conversation | null = null;

        for (const conversation of rows) {
          next.set(conversation.id, conversation.status);
          const oldStatus = previous.current.get(conversation.id);
          if (initialised.current && conversation.status === 'human_requested' && oldStatus !== 'human_requested') {
            alertConversation = conversation;
          }
        }

        if (initialised.current && alertConversation) {
          const customer = customerOf(alertConversation);
          const name = customer?.full_name || customer?.email || ('+' + alertConversation.wa_id);
          const played = playAlertSound();

          toast.info('New human support request', {
            description: name + ' is waiting for a support agent on WhatsApp.',
            duration: 8000,
            action: {
              label: 'Open',
              onClick: () => window.dispatchEvent(new CustomEvent('qafrica-open-ai-support')),
            },
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('QAfrica AI Support', {
                body: name + ' is waiting for a human support agent on WhatsApp.',
                tag: 'qafrica-human-' + alertConversation.id,
              });
            } catch { /* browser notification unavailable */ }
          }

          if (!played) window.dispatchEvent(new CustomEvent('qafrica-ai-sound-blocked'));
        }

        previous.current = next;
        initialised.current = true;
      } catch {
        // Polling failures must not interrupt the admin screen.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [enabled, token]);

  return null;
}

export default function AiSupportInbox({ token }: { token: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const soundEnabled = true;
  const [browserNotifications, setBrowserNotifications] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await supportRequest(token, 'list_support_conversations');
      const rows: Conversation[] = data.conversations || [];
      setConversations(rows);
      setSelected(current => current ? (rows.find(x => x.id === current.id) || current) : (rows[0] || null));
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : 'Could not load AI support');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token]);

  const openConversation = useCallback(async (conversation: Conversation) => {
    setSelected(conversation);
    setDetailLoading(true);
    try {
      const data = await supportRequest(token, 'get_support_conversation', { conversation_id: conversation.id });
      setSelected(data.conversation || conversation);
      setMessages(data.messages || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load conversation');
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const handler = () => {
      const waiting = conversations.find(c => c.status === 'human_requested');
      if (waiting) void openConversation(waiting);
    };
    window.addEventListener('qafrica-open-ai-support', handler);
    return () => window.removeEventListener('qafrica-open-ai-support', handler);
  }, [conversations, openConversation]);

  useEffect(() => {
    const unlock = () => { void unlockAlertSound(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const enableBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setBrowserNotifications(granted);
    if (granted) toast.success('Browser notifications are on');
    else toast.error('Browser notifications were not enabled.');
  };

  const takeOver = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const data = await supportRequest(token, 'take_support_conversation', { conversation_id: selected.id });
      setSelected(prev => prev ? { ...prev, status: data.conversation?.status || 'human_active' } : prev);
      await load(true);
      toast.success('You took over this WhatsApp conversation');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not take over');
    } finally { setActing(false); }
  };

  const returnToAi = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await supportRequest(token, 'return_support_to_ai', { conversation_id: selected.id });
      setConversations(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
      setMessages([]);
      toast.success('Conversation returned to AI');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not return to AI');
    } finally { setActing(false); }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const data = await supportRequest(token, 'send_human_message', {
        conversation_id: selected.id,
        message: reply.trim(),
      });
      setMessages(prev => [...prev, data.message]);
      setReply('');
      setSelected(prev => prev ? { ...prev, status: 'human_active' } : prev);
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send message');
    } finally { setSending(false); }
  };

  const waitingCount = conversations.filter(c => c.status === 'human_requested').length;
  const aiCount = conversations.filter(c => c.status === 'ai').length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-gray-900" />
              <p className="font-bold text-gray-900 text-sm">WhatsApp AI Support</p>
              {aiCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-700 px-2 py-0.5 text-[10px] font-bold">
                  <MessageCircle className="w-3 h-3" /> {aiCount} AI
                </span>
              )}
              {waitingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-[10px] font-bold">
                  <BellRing className="w-3 h-3" /> {waitingCount} waiting
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Human requests, live WhatsApp conversations and AI handoff.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold" title="Support sound alerts stay enabled automatically">
              <Volume2 className="w-3.5 h-3.5" />
              Sound on
            </span>
            <button onClick={() => void enableBrowserNotifications()} disabled={browserNotifications} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold disabled:opacity-60">
              {browserNotifications ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              {browserNotifications ? 'Notifications on' : 'Enable notifications'}
            </button>
            <button onClick={() => void load()} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 flex justify-center"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <MessageCircle className="w-8 h-8 mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-700">No human support requests</p>
          <p className="text-xs text-gray-400 mt-1">When a customer asks for a human, the conversation will appear here and trigger an alert.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">All active chats</p>
              <span className="text-[10px] text-gray-400">{conversations.length}</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[620px] overflow-y-auto">
              {conversations.map(c => {
                const customer = customerOf(c);
                const waiting = c.status === 'human_requested';
                return (
                  <button key={c.id} onClick={() => void openConversation(c)} className={"w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors " + (selected?.id === c.id ? 'bg-gray-50' : '')}>
                    <div className="flex items-start gap-2">
                      <div className={"w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 " + (waiting ? 'bg-red-100 text-red-600' : c.status === 'ai' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600')}>
                        {waiting ? <BellRing className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{customer?.full_name || customer?.email || ('+' + c.wa_id)}</p>
                          {waiting ? <span className="text-[9px] font-bold text-red-600">WAITING</span> : c.status === 'ai' ? <span className="text-[9px] font-bold text-orange-600">AI</span> : <span className="text-[9px] font-bold text-gray-500">HUMAN</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{customer?.email || ('+' + c.wa_id)}</p>
                        <p className="text-[9px] text-gray-300 mt-1">{new Date(c.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden min-h-[500px]">
            {!selected ? (
              <div className="h-full flex items-center justify-center p-8 text-sm text-gray-400">Select a conversation.</div>
            ) : detailLoading ? (
              <div className="h-full flex items-center justify-center p-8"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{customerOf(selected)?.full_name || 'WhatsApp customer'}</p>
                    <p className="text-[10px] text-gray-400">+{selected.wa_id}{customerOf(selected)?.email ? ' · ' + customerOf(selected)?.email : ''} · {selected.status === 'ai' ? 'AI handling' : selected.status === 'human_requested' ? 'Waiting for human' : 'Human support'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void takeOver()} disabled={acting || selected.status === 'human_active'} className="px-2.5 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold disabled:opacity-40">
                      {selected.status === 'human_active' ? 'Human active' : selected.status === 'ai' ? 'Take over' : 'Take over'}
                    </button>
                    {selected.status !== 'ai' && (
                      <button onClick={() => void returnToAi()} disabled={acting} className="px-2.5 py-2 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold disabled:opacity-40">Return to AI</button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-2 max-h-[520px] overflow-y-auto">
                  {messages.map(m => (
                    <div key={m.id} className={"flex " + (m.direction === 'inbound' ? 'justify-start' : 'justify-end')}>
                      <div className={"max-w-[82%] rounded-2xl px-3 py-2 " + (m.direction === 'inbound' ? 'bg-gray-100 text-gray-800' : m.sender_type === 'human' ? 'bg-gray-900 text-white' : 'bg-orange-50 text-gray-800')}>
                        <p className="text-[11px] whitespace-pre-wrap break-words">{m.body}</p>
                        <p className="text-[9px] opacity-50 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 p-3 flex gap-2">
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                    placeholder="Reply to customer on WhatsApp…"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
                    disabled={sending || selected.status !== 'human_active'}
                  />
                  <button onClick={() => void sendReply()} disabled={sending || !reply.trim() || selected.status !== 'human_active'} className="px-3 rounded-xl bg-gray-900 text-white disabled:opacity-30">
                    {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
