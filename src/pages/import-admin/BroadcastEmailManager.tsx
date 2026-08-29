// src/pages/import-admin/BroadcastEmailManager.tsx
// "Broadcast" tab: admin composes (or picks a template + fine-tunes) a
// subject/body and sends it to EVERY import customer (signup_source =
// 'importation'), not just people with orders in a specific batch. {{name}}
// is replaced per-recipient by the edge function. Sending is irreversible,
// so it always goes through an explicit confirm step showing the audience
// size first.
import { useState, useEffect, useCallback } from 'react';
import { Send, Loader, Users, Mail, AlertTriangle, X, Sparkles } from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface Template {
  id: string;
  label: string;
  subject: string;
  body: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'shipping-cut',
    label: 'Shipping cost cut',
    subject: 'We cut shipping costs down to a fraction of what they used to be 🚚',
    body: `<h2 style="color:#111827;margin:0 0 8px;">Shipping doesn't have to cost more than the item</h2>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Hi {{name}}, there was a time importing just one item from China wasn't really worth it — shipping fees alone could cost more than the item itself.
</p>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Here's what changed: we started grouping orders together — sometimes hundreds, even thousands, in one shipment. That's brought shipping costs down dramatically. Just last month, some customers paid as little as ₦800 each for their share.
</p>
<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
  This month's batch starts moving to consolidation from <strong>3rd August 2026</strong>. If you haven't placed your order yet, now's a good time to get it in before this round closes.
</p>
<a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
  Order now →
</a>`,
  },
  {
    id: 'door-delivery',
    label: 'Door delivery',
    subject: 'Yes, we deliver to your door — anywhere in Nigeria 📦',
    body: `<h2 style="color:#111827;margin:0 0 8px;">We deliver to your door, anywhere in Nigeria</h2>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Hi {{name}}, yes — we deliver to your door, anywhere in Nigeria.
</p>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Once your products land in Nigeria, you get to choose what works for you: come for a direct pick-up in Lagos, or have your items sent to you in any state you're in through one of our trusted logistics partners.
</p>
<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
  Wherever you are in the country, your order will reach you.
</p>
<a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
  Shop now →
</a>`,
  },
  {
    id: 'why-trust-us',
    label: 'Why trust us',
    subject: 'Why trust us? Here\'s the honest answer 🤝',
    body: `<h2 style="color:#111827;margin:0 0 8px;">Why trust us?</h2>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Hi {{name}}, it's a fair question. There's no shortage of scams around importing from China in Nigeria, and it makes sense to be careful about who you trust with your money.
</p>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Here's the honest answer: we've been quietly building this platform for close to a year now — testing, refining, and serving customers without a single complaint. We didn't rush to launch with big promises. We waited until we were sure we had something solid before asking anyone to trust us with their orders.
</p>
<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
  We're not perfect, but we take this seriously, and every order that comes in only makes us better at what we do. If you've been on the fence, we'd genuinely love for you to give us a try.
</p>
<a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
  Browse products →
</a>`,
  },
  {
    id: 'referral',
    label: 'Tell a friend',
    subject: 'Know someone who\'d love this? Tell them about us 💛',
    body: `<h2 style="color:#111827;margin:0 0 8px;">Good things are better shared</h2>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Hi {{name}}, if you've enjoyed shopping with us, chances are someone you know would too — a friend, a sibling, someone in your group chat always asking "where did you get this?"
</p>
<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
  Feel free to share the link below with them. The more people join a batch, the more we can keep shipping costs low for everyone — including you.
</p>
<a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
  Share qafrica.store →
</a>`,
  },
  {
    id: 'payment-flexibility',
    label: 'Payment flexibility',
    subject: 'Pay however works for you — card or bank transfer 💳',
    body: `<h2 style="color:#111827;margin:0 0 8px;">Pay your way</h2>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  Hi {{name}}, not everyone likes paying the same way — so we made sure you don't have to.
</p>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
  You can check out with your card through Paystack for instant confirmation, or send a direct bank transfer if that's what you're more comfortable with. Either way, your order moves forward the same way.
</p>
<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
  Whatever works for you, works for us.
</p>
<a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
  Start an order →
</a>`,
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function BroadcastEmailManager({ token }: { token: string }) {
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody] = useState(TEMPLATES[0].body);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadCount = useCallback(async () => {
    setIsLoadingCount(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-broadcast-audience-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      setAudienceCount(typeof data.count === 'number' ? data.count : 0);
    } catch {
      setAudienceCount(null);
    } finally {
      setIsLoadingCount(false);
    }
  }, [token]);

  useEffect(() => { loadCount(); }, [loadCount]);

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find(t => t.id === id);
    if (!t) return;
    setSelectedTemplateId(id);
    setSubject(t.subject);
    setBody(t.body);
  };

  const send = async () => {
    setIsSending(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-send-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, subject, html: body }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Sent to ${data.sent} of ${data.recipients} import customers${data.failed ? ` (${data.failed} failed)` : ''}`);
      setShowConfirm(false);
    } catch {
      toast.error('Failed to send broadcast — check your connection and try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-gray-400" />
          <p className="font-semibold text-gray-800 text-sm">Audience</p>
        </div>
        <p className="text-[11px] text-gray-400">
          {isLoadingCount ? 'Loading…' : audienceCount === null ? 'Could not load audience size' : (
            <>Every import customer with an email on file — currently <strong className="text-gray-600">{audienceCount.toLocaleString()}</strong> people.</>
          )}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gray-400" />
          <p className="font-semibold text-gray-800 text-sm">Template</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedTemplateId === t.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-gray-400" />
          <p className="font-semibold text-gray-800 text-sm">Fine-tune before sending</p>
        </div>

        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
        />

        <label className="block text-[11px] font-semibold text-gray-400 mb-1">
          Body (HTML — use <code className="bg-gray-50 px-1 rounded">{'{{name}}'}</code> for the customer's name)
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 font-mono leading-relaxed focus:outline-none focus:border-gray-400"
        />

        <div className="mt-3 bg-gray-50 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Preview (plain text)</p>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{stripHtml(body).replace(/\{\{name\}\}/g, 'there')}</p>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!subject.trim() || !body.trim() || audienceCount === 0}
          className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Send to all import customers
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={() => !isSending && setShowConfirm(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-gray-900">Send this broadcast?</h3>
              </div>
              {!isSending && (
                <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              This will email <strong className="text-gray-700">{audienceCount?.toLocaleString() ?? 'all'} customers</strong> right
              away and can't be undone. Double-check the subject and body above before continuing.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isSending}
                className="flex-1 py-2 rounded-xl bg-gray-50 text-gray-600 text-xs font-semibold disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={isSending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-60"
              >
                {isSending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {isSending ? 'Sending…' : 'Yes, send now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
