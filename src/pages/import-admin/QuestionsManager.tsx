// src/pages/import-admin/QuestionsManager.tsx
// Admin inbox for "Ask about this product" questions. 3 canned reply
// templates (editable before sending) or a fully custom reply — either way
// sending emails the customer via the china-import edge function.
import { useState, useEffect, useCallback } from 'react';
import { Loader, MessageCircleQuestion, CheckCircle2, Send } from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface ProductQuestion {
  id: string;
  product_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  question: string;
  status: 'open' | 'answered';
  admin_reply: string | null;
  reply_template: string | null;
  created_at: string;
  china_import_products: { name: string; image_url: string } | null;
}

const TEMPLATES = [
  {
    key: 'in_stock',
    label: 'In stock',
    text: (product: string) =>
      `Yes, ${product} is currently in stock and ready to ship as soon as you place your order.`,
  },
  {
    key: 'eta',
    label: 'Shipping ETA',
    text: () =>
      `This item ships within our standard timelines — Flight 20–30 days, or Sea 60–90 days. We'll notify you the moment it's ready for the next step.`,
  },
  {
    key: 'customize',
    label: 'Can customize',
    text: () =>
      `Yes, we can accommodate custom requests like a specific colour or size — just place your order and let us know your preference, and we'll take it from there.`,
  },
];

export default function QuestionsManager({ token }: { token: string }) {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [filter, setFilter] = useState<'open' | 'answered' | ''>('open');
  const [isLoading, setIsLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, status: filter || undefined }),
      });
      const data = await res.json();
      setQuestions(data.questions ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  const applyTemplate = (q: ProductQuestion, templateKey: string) => {
    const t = TEMPLATES.find(t => t.key === templateKey);
    if (!t) return;
    setReplyDrafts(prev => ({ ...prev, [q.id]: t.text(q.china_import_products?.name ?? 'this product') }));
  };

  const sendReply = async (q: ProductQuestion, templateKey?: string) => {
    const reply = replyDrafts[q.id];
    if (!reply || !reply.trim()) return;
    setSendingId(q.id);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-reply-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, question_id: q.id, reply, template: templateKey ?? null }),
      });
      if (!res.ok) throw new Error();
      await load();
    } finally {
      setSendingId(null);
    }
  };

  const openCount = questions.filter(q => q.status === 'open').length;

  return (
    <div className="space-y-4">
      <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
        {([{ key: 'open' as const, label: 'Open' }, { key: 'answered' as const, label: 'Answered' }, { key: '' as const, label: 'All' }]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              filter === f.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {f.label}{f.key === 'open' && openCount > 0 ? ` (${openCount})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <MessageCircleQuestion className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-300">
            {filter === 'open' ? 'No open questions right now.' : 'No questions yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start gap-3 mb-3">
                {q.china_import_products?.image_url && (
                  <img src={q.china_import_products.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-1">{q.china_import_products?.name ?? 'Unknown product'}</p>
                  <p className="text-[11px] text-gray-400">{q.customer_name ?? 'Customer'} · {new Date(q.created_at).toLocaleDateString()}</p>
                </div>
                {q.status === 'answered' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Answered
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3">{q.question}</p>

              {q.status === 'answered' ? (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Reply sent</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{q.admin_reply}</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => applyTemplate(q, t.key)}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 text-gray-600 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={replyDrafts[q.id] ?? ''}
                    onChange={e => setReplyDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Write a reply, or tap a template above to start…"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none resize-none mb-2"
                  />
                  <button
                    onClick={() => sendReply(q, undefined)}
                    disabled={sendingId === q.id || !(replyDrafts[q.id] ?? '').trim()}
                    className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {sendingId === q.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send reply
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
