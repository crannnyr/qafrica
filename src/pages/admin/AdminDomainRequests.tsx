// Admin: review and act on custom-domain requests.
// Every action goes through the admin_domain_request_action RPC, which updates the request and
// the store in one transaction and only allows valid moves (e.g. you can't connect a rejected request).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle, ChevronDown, ChevronUp, Clock, ExternalLink, Globe,
  Loader2, RefreshCw, Search, ShieldCheck, Undo2, X, XCircle,
} from 'lucide-react';
import { supabase } from '@/services';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

interface DomainRequest {
  id: string;
  store_id: string;
  user_id: string;
  domain_name: string;
  domain_type: 'new' | 'existing';
  status: string;
  payment_status: string;
  payment_provider: string | null;
  amount_paid: number | null;
  paid_amount: number | null;
  payment_reference: string | null;
  payment_error: string | null;
  admin_approved: boolean | null;
  approved_at: string | null;
  rejected_at: string | null;
  refunded_at: string | null;
  paid_at: string | null;
  admin_notes: string | null;
  requested_at: string | null;
  created_at: string;
  store: { name: string | null; slug: string | null; custom_domain: string | null; domain_status: string | null } | null;
  owner: { full_name: string | null; email: string | null; phone: string | null } | null;
}

type Action = 'processing' | 'connect' | 'reject' | 'disconnect' | 'mark_refunded' | 'note';
type Filter = 'review' | 'processing' | 'connected' | 'closed' | 'unpaid' | 'all';

const FILTERS: { key: Filter; label: string; match: (r: DomainRequest) => boolean }[] = [
  { key: 'review',     label: 'To review',  match: (r) => r.status === 'pending' },
  { key: 'processing', label: 'In setup',   match: (r) => r.status === 'processing' },
  { key: 'connected',  label: 'Live',       match: (r) => r.status === 'connected' },
  { key: 'closed',     label: 'Closed',     match: (r) => ['rejected', 'disconnected'].includes(r.status) },
  { key: 'unpaid',     label: 'Unpaid',     match: (r) => ['awaiting_payment', 'failed', 'cancelled'].includes(r.status) },
  { key: 'all',        label: 'All',        match: () => true },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: 'Awaiting payment', cls: 'bg-gray-100 text-gray-600' },
  pending:          { label: 'To review',        cls: 'bg-amber-100 text-amber-800' },
  processing:       { label: 'In setup',         cls: 'bg-blue-100 text-blue-700' },
  purchased:        { label: 'Purchased',        cls: 'bg-blue-100 text-blue-700' },
  connected:        { label: 'Live',             cls: 'bg-green-100 text-green-700' },
  rejected:         { label: 'Rejected',         cls: 'bg-red-100 text-red-700' },
  disconnected:     { label: 'Disconnected',     cls: 'bg-gray-200 text-gray-700' },
  failed:           { label: 'Payment failed',   cls: 'bg-gray-100 text-gray-500' },
  cancelled:        { label: 'Cancelled',        cls: 'bg-gray-100 text-gray-500' },
};

const naira = (n: number | null | undefined) => `₦${Number(n ?? 0).toLocaleString('en-NG')}`;
const fmt = (d: string | null | undefined) => d
  ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';
const esc = (s: string | null | undefined) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** How much we trust the payment on this request. */
function paymentTrust(r: DomainRequest): { label: string; cls: string; verified: boolean } {
  if (r.payment_status === 'refunded') return { label: 'Refunded', cls: 'text-gray-500', verified: true };
  if (r.payment_status === 'review') return { label: 'Paid wrong amount, check Flutterwave', cls: 'text-amber-700', verified: false };
  if (r.payment_status !== 'paid') return { label: 'Not paid', cls: 'text-gray-500', verified: false };
  if (r.payment_provider === 'flutterwave') return { label: 'Verified by Flutterwave', cls: 'text-green-700', verified: true };
  return { label: 'Unverified (old Paystack checkout). Check Paystack before connecting', cls: 'text-amber-700', verified: false };
}

function emailFor(action: Action, r: DomainRequest, note: string): { subject: string; body: string } | null {
  const hi = `<p style="color:#4B5563;">Hi ${esc(r.owner?.full_name) || 'there'},</p>`;
  const noteHtml = note ? `<p style="color:#4B5563;margin-top:8px;">${esc(note).replace(/\n/g, '<br>')}</p>` : '';
  const d = esc(r.domain_name);
  switch (action) {
    case 'processing':
      return { subject: `We're setting up ${r.domain_name}`, body: `${hi}<p style="color:#4B5563;">We've started setting up <strong>${d}</strong> for <strong>${esc(r.store?.name)}</strong>. We'll email you again when it's live.</p>${noteHtml}` };
    case 'connect':
      return { subject: `${r.domain_name} is live`, body: `${hi}<p style="color:#4B5563;"><strong>${d}</strong> is now connected to <strong>${esc(r.store?.name)}</strong>.</p><p style="margin-top:12px;"><a href="https://${d}" style="color:#F97316;">https://${d}</a></p>${noteHtml}<p style="color:#9CA3AF;font-size:12px;margin-top:12px;">It can take up to an hour for the new address to work everywhere.</p>` };
    case 'reject':
      return { subject: `Update on your domain request for ${r.domain_name}`, body: `${hi}<p style="color:#4B5563;">We couldn't set up <strong>${d}</strong>.</p>${noteHtml}${r.payment_status === 'paid' ? '<p style="color:#4B5563;margin-top:8px;">Your payment will be refunded within 3 to 5 working days.</p>' : ''}` };
    case 'disconnect':
      return { subject: `${r.domain_name} has been disconnected`, body: `${hi}<p style="color:#4B5563;"><strong>${d}</strong> is no longer connected to <strong>${esc(r.store?.name)}</strong>. Your store is still open at its QAFRICA link.</p>${noteHtml}` };
    case 'mark_refunded':
      return { subject: `Refund for ${r.domain_name}`, body: `${hi}<p style="color:#4B5563;">We've refunded ${naira(r.paid_amount ?? r.amount_paid)} for <strong>${d}</strong>. It can take a few days to show in your bank.</p>${noteHtml}` };
    default:
      return null;
  }
}

const CONFIRM: Partial<Record<Action, (r: DomainRequest) => string>> = {
  connect: (r) => `Connect ${r.domain_name} to ${r.store?.name ?? 'this store'}?\n\nMake sure the domain is added to Netlify and its DNS points to us first, or the store will show an error on that address.`,
  reject: (r) => `Reject ${r.domain_name}?${r.payment_status === 'paid' ? '\n\nThe owner will be told a refund is coming. Refund them in Flutterwave/Paystack, then press "Mark refunded".' : ''}`,
  disconnect: (r) => `Disconnect ${r.domain_name}? The store goes back to its QAFRICA link.`,
  mark_refunded: (r) => `Confirm you have refunded ${naira(r.paid_amount ?? r.amount_paid)} for ${r.domain_name}?`,
};

export default function AdminDomainRequests() {
  const { fetchStore, currentStore } = useStoreStore();
  const [requests, setRequests] = useState<DomainRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('review');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadRows = useCallback(async (): Promise<DomainRequest[] | null> => {
    const { data, error } = await supabase
      .from('domain_requests')
      .select(`*, store:store_id ( name, slug, custom_domain, domain_status ), owner:user_id ( full_name, email, phone )`)
      .order('created_at', { ascending: false });
    if (error) { toast.error(`Couldn't load domain requests: ${error.message}`); return null; }
    return (data ?? []) as DomainRequest[];
  }, []);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const rows = await loadRows();
    if (rows) setRequests(rows);
    setIsLoading(false);
  }, [loadRows]);

  useEffect(() => {
    let alive = true;
    loadRows().then((rows) => { if (!alive) return; if (rows) setRequests(rows); setIsLoading(false); });
    return () => { alive = false; };
  }, [loadRows]);

  const run = async (r: DomainRequest, action: Action) => {
    const ask = CONFIRM[action];
    if (ask && !window.confirm(ask(r))) return;
    const note = (notes[r.id] ?? r.admin_notes ?? '').trim();
    setBusy(`${r.id}:${action}`);
    const { error } = await supabase.rpc('admin_domain_request_action', { p_request_id: r.id, p_action: action, p_note: note || null });
    if (error) {
      toast.error(error.message);
      setBusy(null);
      return;
    }
    const mail = emailFor(action, r, note);
    if (mail && r.owner?.email) {
      const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;"><div style="background:#F97316;border-radius:12px;padding:10px 16px;margin-bottom:20px;display:inline-block;"><span style="color:#fff;font-size:18px;font-weight:800;">QAFRICA</span></div>${mail.body}</div>`;
      const { error: mailErr } = await supabase.functions.invoke('send-email', { body: { to: r.owner.email, subject: mail.subject, html } });
      if (mailErr) toast.warning('Saved, but the email to the owner did not send.');
    }
    toast.success({
      processing: 'Moved to setup', connect: `${r.domain_name} is live`, reject: 'Request rejected',
      disconnect: 'Domain disconnected', mark_refunded: 'Marked as refunded', note: 'Note saved',
    }[action]);
    if (currentStore?.id === r.store_id) void fetchStore(r.store_id);
    setNotes((prev) => { const n = { ...prev }; delete n[r.id]; return n; });
    setBusy(null);
    await fetchRequests();
  };

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, requests.filter(f.match).length])) as Record<Filter, number>,
    [requests],
  );

  const q = search.trim().toLowerCase();
  const visible = requests.filter((r) => {
    if (!FILTERS.find((f) => f.key === filter)!.match(r)) return false;
    if (!q) return true;
    return [r.domain_name, r.store?.name, r.store?.slug, r.owner?.email, r.owner?.full_name, r.payment_reference]
      .some((v) => (v ?? '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Domain requests</h1>
          <p className="text-xs text-gray-500 mt-0.5">{counts.review} to review · {counts.processing} in setup · {counts.connected} live</p>
        </div>
        <button onClick={fetchRequests} aria-label="Refresh" className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto self-start max-w-full">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f.label}{f.key !== 'all' && counts[f.key] > 0 && <span className="ml-1 font-bold text-orange-600">{counts[f.key]}</span>}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search domain, store, email, reference"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <Globe className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{filter === 'review' && !q ? 'Nothing waiting for review.' : 'No requests match.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const open = expandedId === r.id;
            const st = STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' };
            const trust = paymentTrust(r);
            const isBusy = busy?.startsWith(r.id) ?? false;
            const note = notes[r.id] ?? r.admin_notes ?? '';
            const btn = (action: Action, label: string, icon: React.ReactNode, cls: string) => (
              <button onClick={() => run(r, action)} disabled={isBusy}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors ${cls}`}>
                {busy === `${r.id}:${action}` ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}{label}
              </button>
            );

            return (
              <li key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button type="button" onClick={() => setExpandedId(open ? null : r.id)} aria-expanded={open}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm break-all">{r.domain_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      <span className="text-[11px] text-gray-500">{r.domain_type === 'new' ? 'Buy new' : 'Connect existing'}</span>
                      {r.payment_status === 'paid' && !trust.verified && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Payment not verified" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{r.store?.name ?? 'Unknown store'} · {r.owner?.email ?? 'no email'} · {fmt(r.requested_at ?? r.created_at)}</p>
                  </div>
                  <span className="font-bold text-gray-900 text-sm shrink-0">{naira(r.amount_paid)}</span>
                  {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                    <div className={`flex items-start gap-2 text-sm ${trust.cls}`}>
                      {trust.verified ? <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                      <span>{trust.label}{r.payment_error ? ` (${r.payment_error})` : ''}</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <Details title="Store" rows={[
                        ['Name', r.store?.name], ['Link', r.store?.slug ? `/${r.store.slug}` : null],
                        ['Domain on store', r.store?.custom_domain], ['Store domain status', r.store?.domain_status],
                      ]} link={r.store?.slug ? `/${r.store.slug}` : undefined} />
                      <Details title="Payment" rows={[
                        ['Owner', r.owner?.full_name], ['Email', r.owner?.email], ['Phone', r.owner?.phone],
                        ['Provider', r.payment_provider], ['Reference', r.payment_reference],
                        ['Price', naira(r.amount_paid)], ['Received', r.paid_amount != null ? naira(r.paid_amount) : null],
                        ['Paid at', r.paid_at ? fmt(r.paid_at) : null],
                      ]} />
                    </div>

                    {r.domain_type === 'existing' && ['pending', 'processing'].includes(r.status) && (
                      <p className="text-xs text-gray-600 bg-white border border-gray-200 rounded-xl p-3">
                        Owner already has this domain. Add it in Netlify, then put the DNS records the owner must add in the note below and press <strong>Start setup</strong> so they get them by email.
                      </p>
                    )}

                    <div>
                      <label htmlFor={`note-${r.id}`} className="block text-xs font-medium text-gray-600 mb-1.5">Note to the owner (shown on their Domain page and in the email)</label>
                      <textarea id={`note-${r.id}`} value={note} rows={3}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="e.g. Add an A record @ → 75.2.60.5 and a CNAME www → your-site.netlify.app"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 resize-y bg-white" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {r.status === 'pending' && btn('processing', 'Start setup', <Clock className="w-4 h-4" />, 'border border-blue-300 text-blue-700 hover:bg-blue-50')}
                      {['pending', 'processing'].includes(r.status) && btn('connect', 'Connect domain', <Check className="w-4 h-4" />, 'bg-green-600 hover:bg-green-700 text-white')}
                      {['awaiting_payment', 'pending', 'processing'].includes(r.status) && btn('reject', 'Reject', <X className="w-4 h-4" />, 'border border-red-300 text-red-600 hover:bg-red-50')}
                      {r.status === 'connected' && btn('disconnect', 'Disconnect', <Undo2 className="w-4 h-4" />, 'border border-gray-300 text-gray-700 hover:bg-gray-100')}
                      {['rejected', 'disconnected', 'failed', 'cancelled'].includes(r.status) && ['paid', 'review'].includes(r.payment_status) &&
                        btn('mark_refunded', 'Mark refunded', <CheckCircle className="w-4 h-4" />, 'border border-gray-300 text-gray-700 hover:bg-gray-100')}
                      {note !== (r.admin_notes ?? '') && btn('note', 'Save note only', <Check className="w-4 h-4" />, 'text-gray-600 hover:bg-gray-100 ml-auto')}
                    </div>

                    {r.status === 'connected' && <Banner tone="green" text={`Live since ${fmt(r.approved_at)}`} />}
                    {r.status === 'rejected' && <Banner tone="red" text={`Rejected ${fmt(r.rejected_at)}${r.payment_status === 'refunded' ? ` · refunded ${fmt(r.refunded_at)}` : r.payment_status === 'paid' ? ' · refund still owed' : ''}`} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Details({ title, rows, link }: { title: string; rows: [string, string | null | undefined][]; link?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 text-xs space-y-1.5">
      <p className="font-semibold text-gray-700 text-sm mb-2">{title}</p>
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">{l}</span>
          <span className="font-medium text-gray-800 text-right break-all">{v || '—'}</span>
        </div>
      ))}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-600 hover:underline pt-1">
          View store <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function Banner({ tone, text }: { tone: 'green' | 'red'; text: string }) {
  const cls = tone === 'green' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200';
  const Icon = tone === 'green' ? CheckCircle : XCircle;
  return <div className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl text-sm ${cls}`}><Icon className="w-4 h-4 shrink-0" />{text}</div>;
}
