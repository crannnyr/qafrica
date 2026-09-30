import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, Search, X } from 'lucide-react';
import CONFIG from '@/lib/config';

const AI_URL = CONFIG.SUPABASE_URL + '/functions/v1/import-ai-support';

type Customer = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

type Conversation = {
  id: string;
  wa_id: string;
  customer_id: string | null;
  status: 'ai' | 'returned_to_ai' | 'human_requested' | 'human_assigned' | 'human_active' | 'resolved';
  updated_at: string;
  customers?: Customer | Customer[] | null;
};

type Message = {
  body: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'ai' | 'human';
  created_at: string;
};

type SearchResult = {
  conversation: Conversation;
  messages: Message[];
  matchedMessage?: Message;
};

async function request(token: string, action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'admin', manager_token: token, action, ...extra }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Support search failed');
  return data;
}

function customerOf(conversation: Conversation): Customer | null {
  if (!conversation.customers) return null;
  return Array.isArray(conversation.customers) ? conversation.customers[0] || null : conversation.customers;
}

function normalize(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function keywords(query: string) {
  return normalize(query).split(/\s+/).map(x => x.trim()).filter(Boolean);
}

function statusLabel(status: Conversation['status']) {
  if (status === 'resolved') return 'Resolved';
  if (status === 'human_requested' || status === 'human_assigned' || status === 'human_active') return 'Human';
  return 'AI';
}

function statusClass(status: Conversation['status']) {
  if (status === 'resolved') return 'bg-gray-100 text-gray-600';
  if (status === 'human_requested' || status === 'human_assigned' || status === 'human_active') return 'bg-blue-50 text-blue-700';
  return 'bg-orange-50 text-orange-700';
}

export default function AiSupportConversationSearch({ token }: { token: string }) {
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [details, setDetails] = useState<Record<string, Message[]>>({});
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, Message[]>>({});
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void request(token, 'list_support_conversations').then(data => {
      if (!cancelled) setConversations((data.conversations || []) as Conversation[]);
    }).catch(() => {
      if (!cancelled) setError('Could not load support conversations for search.');
    });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const terms = keywords(query);
    if (!terms.length) {
      setSearching(false);
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const run = async () => {
        const currentRequest = ++requestId.current;
        setSearching(true);
        setError(null);
        try {
          const rows: Conversation[] = conversations.length
            ? conversations
            : ((await request(token, 'list_support_conversations')).conversations || []) as Conversation[];
          if (!conversations.length) setConversations(rows);

          const uncached = rows.filter(row => !cacheRef.current[row.id]);
          for (let i = 0; i < uncached.length; i += 10) {
            const batch = uncached.slice(i, i + 10);
            const results = await Promise.all(batch.map(async conversation => {
              try {
                const data = await request(token, 'get_support_conversation', { conversation_id: conversation.id });
                return [conversation.id, (data.messages || []) as Message[]] as const;
              } catch {
                return [conversation.id, [] as Message[]] as const;
              }
            }));
            for (const [id, messages] of results) cacheRef.current[id] = messages;
            if (currentRequest !== requestId.current) return;
          }

          const nextDetails: Record<string, Message[]> = {};
          for (const row of rows) nextDetails[row.id] = cacheRef.current[row.id] || [];
          if (currentRequest === requestId.current) setDetails(nextDetails);
        } catch (err) {
          if (currentRequest === requestId.current) setError(err instanceof Error ? err.message : 'Could not search support conversations');
        } finally {
          if (currentRequest === requestId.current) setSearching(false);
        }
      };
      void run();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, token, conversations.length]);

  const results = useMemo<SearchResult[]>(() => {
    const terms = keywords(query);
    if (!terms.length) return [];

    return conversations.map(conversation => {
      const customer = customerOf(conversation);
      const messages = details[conversation.id] || cacheRef.current[conversation.id] || [];
      const messageText = messages.map(message => message.body).join(' ');
      const combined = normalize([
        conversation.id,
        conversation.wa_id,
        conversation.customer_id,
        customer?.full_name,
        customer?.email,
        customer?.phone,
        conversation.status,
        messageText,
      ].join(' '));
      const matchedMessage = messages.find(message => {
        const text = normalize(message.body);
        return terms.some(term => text.includes(term));
      });
      return terms.every(term => combined.includes(term))
        ? { conversation, messages, matchedMessage }
        : null;
    }).filter(Boolean) as SearchResult[];
  }, [query, conversations, details]);

  const openResult = (result: SearchResult) => {
    window.dispatchEvent(new CustomEvent('qafrica-open-ai-support', {
      detail: { conversationId: result.conversation.id },
    }));
  };

  return (
    <div className="relative z-30 bg-white rounded-2xl border border-gray-100 p-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="w-full h-10 pl-9 pr-20 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          placeholder="Search name, phone, order, WhatsApp ID, or message keywords..."
          aria-label="Search support conversations"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searching && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
          {query && (
            <button type="button" onClick={() => setQuery('')} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Clear search">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {query.trim() && (
        <div className="mt-2 text-[10px] text-gray-400">
          Searches all keywords across customer details and WhatsApp messages.
          {searching && <span className="ml-2 text-orange-500">Searching…</span>}
        </div>
      )}

      {query.trim() && (
        <div className="mt-2 rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm max-h-80 overflow-y-auto">
          {error ? (
            <div className="px-4 py-5 text-xs text-red-600">{error}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              {searching ? 'Searching support messages…' : 'No support conversation matched those keywords.'}
            </div>
          ) : (
            results.slice(0, 30).map(result => {
              const customer = customerOf(result.conversation);
              const title = customer?.full_name || customer?.phone || ('+' + result.conversation.wa_id);
              const message = result.matchedMessage?.body || result.messages[result.messages.length - 1]?.body || 'No message preview';
              return (
                <button
                  key={result.conversation.id}
                  type="button"
                  onClick={() => openResult(result)}
                  className="w-full text-left px-3 py-2.5 border-b last:border-b-0 border-gray-100 hover:bg-orange-50/50 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    {customer?.avatar_url ? (
                      <img src={customer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-gray-100" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 truncate">{title}</span>
                        <span className={'px-1.5 py-0.5 rounded-full text-[9px] font-bold ' + statusClass(result.conversation.status)}>{statusLabel(result.conversation.status)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{message}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">{result.conversation.wa_id}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
          {results.length > 30 && <div className="px-3 py-2 text-[10px] text-gray-400 text-center">Showing the first 30 matches.</div>}
        </div>
      )}
    </div>
  );
}
