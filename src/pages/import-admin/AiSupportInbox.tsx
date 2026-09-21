import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, Send, UserRound, CheckCircle2, Bot, Loader2 } from 'lucide-react';
import CONFIG from '@/lib/config';

const AI_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-ai-support`;

type Conversation = {
  id: string;
  wa_id: string;
  customer_id: string | null;
  status: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  updated_at: string;
  customers?: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'ai' | 'human' | 'system';
  body: string;
  created_at: string;
};

export default function AiSupportInbox({ token }: { token: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'admin', action, manager_token: token, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Support request failed');
    return data;
  }, [token]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await call('list_support_conversations');
      setConversations(data.conversations ?? []);
      setSelected(current => {
        if (!current) return current;
        return (data.conversations ?? []).find((x: Conversation) => x.id === current.id) ?? current;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load support conversations');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [call]);

  const loadDetail = useCallback(async (conversation: Conversation) => {
    setDetailLoading(true);
    try {
      const data = await call('get_support_conversation', { conversation_id: conversation.id });
      setSelected(data.conversation);
      setMessages(data.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load conversation');
    } finally {
      setDetailLoading(false);
    }
  }, [call]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(true); }, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const takeOver = async () => {
    if (!selected) return;
    try {
      await call('take_support_conversation', { conversation_id: selected.id });
      await load(true);
      await loadDetail({ ...selected, status: 'human_active' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not take over conversation');
    }
  };

  const returnToAi = async () => {
    if (!selected) return;
    try {
      await call('return_support_to_ai', { conversation_id: selected.id });
      await load(true);
      await loadDetail({ ...selected, status: 'returned_to_ai' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not return conversation to AI');
    }
  };

  const send = async () => {
    const message = draft.trim();
    if (!selected || !message || sending) return;
    setSending(true);
    setError('');
    try {
      await call('send_human_message', { conversation_id: selected.id, message });
      setDraft('');
      await loadDetail(selected);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 min-h-[620px]">
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">AI Support Inbox</p>
            <p className="text-[11px] text-gray-400">WhatsApp human handoffs</p>
          </div>
          <button onClick={() => void load()} className="p-2 rounded-lg hover:bg-gray-50" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="divide-y divide-gray-50 max-h-[570px] overflow-y-auto">
          {conversations.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-gray-400">No conversations waiting for human support.</div>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => void loadDetail(c)}
              className={`w-full text-left p-3 hover:bg-gray-50 ${selected?.id === c.id ? 'bg-orange-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <UserRound className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate">{c.customers?.full_name || 'WhatsApp customer'}</p>
                  <p className="text-[10px] text-gray-400 truncate">{c.customers?.email || c.wa_id}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-orange-600 font-semibold">{c.status.replaceAll('_', ' ')}</span>
                <span className="text-[10px] text-gray-400">{c.last_inbound_at ? new Date(c.last_inbound_at).toLocaleTimeString() : ''}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col min-h-[620px]">
        {selected ? (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{selected.customers?.full_name || 'WhatsApp customer'}</p>
                <p className="text-[11px] text-gray-400 truncate">{selected.customers?.email || selected.wa_id}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {selected.status !== 'human_active' && (
                  <button onClick={() => void takeOver()} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                    Take over
                  </button>
                )}
                {['human_requested','human_assigned','human_active'].includes(selected.status) && (
                  <button onClick={() => void returnToAi()} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold">
                    Return to AI
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-gray-50">
              {detailLoading && (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              )}
              {messages.map(m => (
                <div key={m.id} className={m.direction === 'inbound' ? 'flex justify-start' : 'flex justify-end'}>
                  <div className={m.direction === 'inbound'
                    ? 'max-w-[80%] rounded-2xl rounded-bl-md bg-white border border-gray-100 px-3 py-2'
                    : 'max-w-[80%] rounded-2xl rounded-br-md bg-gray-900 text-white px-3 py-2'
                  }>
                    <div className="flex items-center gap-1.5 mb-1">
                      {m.sender_type === 'ai' ? <Bot className="w-3 h-3" /> : m.sender_type === 'human' ? <CheckCircle2 className="w-3 h-3" /> : null}
                      <span className="text-[9px] opacity-60">{m.sender_type}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p className="text-[9px] opacity-50 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={e => { e.preventDefault(); void send(); }} className="p-3 border-t border-gray-100 flex gap-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={selected.status === 'human_active' ? 'Reply to customer on WhatsApp…' : 'Take over before replying…'}
                disabled={selected.status !== 'human_active' || sending}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-gray-400 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!draft.trim() || selected.status !== 'human_active' || sending}
                className="w-10 h-10 self-end rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-40"
                aria-label="Send reply"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <MessageCircle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">Select a conversation</p>
              <p className="text-xs text-gray-400 mt-1">Human requests from WhatsApp will appear here.</p>
            </div>
          </div>
        )}
      </section>
      {error && <p className="lg:col-span-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
