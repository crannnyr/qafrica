import { useState, useEffect, useCallback } from 'react';
import {
  Globe, CheckCircle, XCircle, Clock, ExternalLink,
  Search, RefreshCw, Check, X, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { supabase } from '@/services';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DomainRequest {
  id: string;
  store_id: string;
  user_id: string;
  domain_name: string;
  domain_type: 'new' | 'existing';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  amount_paid: number;
  payment_reference: string;
  admin_approved: boolean;
  approved_at: string | null;
  admin_notes: string | null;
  requested_at: string;
  created_at: string;
  store: { name: string; slug: string; custom_domain: string | null; domain_status: string; owner_id: string } | null;
  owner: { full_name: string; email: string; phone: string } | null;
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'approved' | 'rejected';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// KEY FIX: After any domain change, broadcast to the rest of the app
// so any cached store state (useStoreStore, etc.) refreshes immediately.
async function propagateDomainChange(storeId: string, customDomain: string | null, domainStatus: string) {
  // 1. Notify via Supabase realtime channel so any listening components update
  await supabase.channel('admin-domain-updates').send({
    type: 'broadcast',
    event: 'domain_updated',
    payload: { store_id: storeId, custom_domain: customDomain, domain_status: domainStatus },
  });

  // 2. If a developer webhook is configured for this store, dispatch it
  await supabase.functions.invoke('api-webhook-dispatcher', {
    body: { event: 'store.domain_updated', store_id: storeId, custom_domain: customDomain, domain_status: domainStatus },
  }).catch(() => {}); // non-fatal
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ req }: { req: DomainRequest }) {
  if (req.status === 'rejected')
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Rejected</span>;
  if (req.admin_approved && req.status === 'completed')
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Approved</span>;
  if (req.status === 'processing')
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><RefreshCw className="w-3 h-3 animate-spin" />Processing</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />Pending</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDomainRequests() {
  const { fetchStore, currentStore } = useStoreStore();

  const [requests, setRequests]     = useState<DomainRequest[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes]           = useState<Record<string, string>>({});

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('domain_requests')
      .select(`
        *,
        store:store_id ( name, slug, custom_domain, domain_status, owner_id ),
        owner:user_id  ( full_name, email, phone )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) setRequests(data as DomainRequest[]);
    else toast.error('Failed to load domain requests');
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, []);

  // ── Core action helper ────────────────────────────────────────────────────
  const applyAction = async (
    req: DomainRequest,
    reqUpdate: Record<string, any>,
    storeUpdate: Record<string, any>,
    emailSubject: string,
    emailHtml: string,
    successMsg: string,
  ) => {
    setProcessing(req.id);
    try {
      const { error: reqErr } = await supabase
        .from('domain_requests')
        .update({ ...reqUpdate, admin_notes: notes[req.id] || reqUpdate.admin_notes })
        .eq('id', req.id);
      if (reqErr) throw reqErr;

      const { error: storeErr } = await supabase
        .from('stores')
        .update(storeUpdate)
        .eq('id', req.store_id);
      if (storeErr) throw storeErr;

      // KEY FIX: propagate domain change app-wide
      await propagateDomainChange(
        req.store_id,
        storeUpdate.custom_domain ?? null,
        storeUpdate.domain_status,
      );

      // KEY FIX: if the admin's own store was affected, refresh it in zustand
      if (currentStore?.id === req.store_id) {
        fetchStore(req.store_id);
      }

      // Send email notification to store owner
      if (req.owner?.email) {
        await supabase.functions.invoke('send-email', {
          body: { to: req.owner.email, subject: emailSubject, html: emailHtml },
        }).catch(console.error);
      }

      toast.success(successMsg);
      setExpandedId(null);
      setNotes(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
    setProcessing(null);
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = (req: DomainRequest) => applyAction(
    req,
    { admin_approved: true, status: 'completed', approved_at: new Date().toISOString() },
    { custom_domain: req.domain_name, domain_status: 'connected' },
    `QAFRICA — Your domain ${req.domain_name} is live! 🎉`,
    `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
        <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
      </div>
      <h2 style="color:#111827;">Your domain is live!</h2>
      <p style="color:#6B7280;">Hi ${req.owner?.full_name || 'there'}, your domain
        <strong>${req.domain_name}</strong> has been connected to <strong>${req.store?.name}</strong>.</p>
      <p style="color:#6B7280;margin-top:12px;">Visit: <a href="https://${req.domain_name}" style="color:#F97316;">https://${req.domain_name}</a></p>
      ${notes[req.id] ? `<p style="color:#6B7280;margin-top:8px;"><strong>Note:</strong> ${notes[req.id]}</p>` : ''}
    </div>`,
    `Domain ${req.domain_name} approved ✅`,
  );

  // ── Mark processing ───────────────────────────────────────────────────────
  const handleProcessing = (req: DomainRequest) => applyAction(
    req,
    { status: 'processing', admin_notes: notes[req.id] || 'Domain configuration in progress' },
    { domain_status: 'processing' },
    'QAFRICA — Your domain request is being processed',
    `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
        <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
      </div>
      <h2 style="color:#111827;">Domain being processed</h2>
      <p style="color:#6B7280;">Hi ${req.owner?.full_name || 'there'}, your domain
        <strong>${req.domain_name}</strong> is now being configured. We'll notify you once it's live.</p>
    </div>`,
    'Marked as processing',
  );

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = (req: DomainRequest) => applyAction(
    req,
    { admin_approved: false, status: 'rejected', admin_notes: notes[req.id] || 'Request rejected' },
    { custom_domain: null, domain_status: 'none' },
    'QAFRICA — Domain Request Update',
    `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
        <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
      </div>
      <h2 style="color:#111827;">Domain Request Update</h2>
      <p style="color:#6B7280;">Hi ${req.owner?.full_name || 'there'}, your request for
        <strong>${req.domain_name}</strong> could not be processed.</p>
      <p style="color:#6B7280;margin-top:8px;"><strong>Reason:</strong> ${notes[req.id] || 'Please contact support.'}</p>
      <p style="color:#6B7280;margin-top:8px;">If a payment was made, a refund will be processed within 3–5 business days.</p>
    </div>`,
    'Request rejected',
  );

  // ── Revert ────────────────────────────────────────────────────────────────
  const handleRevert = (req: DomainRequest) => applyAction(
    req,
    { status: 'rejected', admin_notes: notes[req.id] || 'Reverted to default URL by admin' },
    { custom_domain: null, domain_status: 'none' },
    'QAFRICA — Your store has been reverted to its default URL',
    `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
        <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
      </div>
      <h2 style="color:#111827;">Store reverted to default URL</h2>
      <p style="color:#6B7280;">Hi ${req.owner?.full_name || 'there'}, your store
        <strong>${req.store?.name}</strong> is now at
        <a href="https://qqafr.bolt.host/${req.store?.slug}" style="color:#F97316;">qqafr.bolt.host/${req.store?.slug}</a>.</p>
      ${notes[req.id] ? `<p style="color:#6B7280;margin-top:8px;">${notes[req.id]}</p>` : ''}
    </div>`,
    'Store reverted to default URL',
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const counts = {
    all:        requests.length,
    pending:    requests.filter(r => r.status === 'pending' && !r.admin_approved).length,
    processing: requests.filter(r => r.status === 'processing').length,
    approved:   requests.filter(r => r.admin_approved && r.status === 'completed').length,
    rejected:   requests.filter(r => r.status === 'rejected').length,
  };

  const filtered = requests.filter(r => {
    const matchesFilter =
      filter === 'all'        ? true :
      filter === 'approved'   ? (r.admin_approved && r.status === 'completed') :
      filter === 'pending'    ? (r.status === 'pending' && !r.admin_approved) :
                                r.status === filter;

    const q = search.toLowerCase();
    const matchesSearch = !search || (
      r.domain_name.toLowerCase().includes(q) ||
      r.store?.name.toLowerCase().includes(q) ||
      r.owner?.email.toLowerCase().includes(q) ||
      r.owner?.full_name.toLowerCase().includes(q)
    );

    return matchesFilter && matchesSearch;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Domain Requests</h1>
          <p className="text-xs text-gray-400 mt-0.5">Domain changes propagate instantly across the platform</p>
        </div>
        <button onClick={fetchRequests} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending',    value: counts.pending,    color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Processing', value: counts.processing, color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Approved',   value: counts.approved,   color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Rejected',   value: counts.rejected,   color: 'text-red-600',    bg: 'bg-red-50'    },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status pills */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap self-start">
          {(['all', 'pending', 'processing', 'approved', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f} {f !== 'all' && counts[f] > 0 && (
                <span className={`ml-1 font-bold ${
                  f === 'pending' ? 'text-amber-500' :
                  f === 'approved' ? 'text-green-500' : 'text-gray-400'
                }`}>{counts[f]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search domain, store, email…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <Globe className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No domain requests match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => {
            const isExpanded = expandedId === req.id;
            const isProcessing = processing === req.id;
            const isActionable = req.status !== 'completed' && req.status !== 'rejected';
            const canRevert = req.store?.domain_status !== 'none' && req.store?.domain_status != null;

            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* Summary row */}
                <div className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    req.admin_approved ? 'bg-green-100' :
                    req.status === 'rejected' ? 'bg-red-100' :
                    req.status === 'processing' ? 'bg-blue-100' : 'bg-amber-100'
                  }`}>
                    <Globe className={`w-4 h-4 ${
                      req.admin_approved ? 'text-green-600' :
                      req.status === 'rejected' ? 'text-red-600' :
                      req.status === 'processing' ? 'text-blue-600' : 'text-amber-600'
                    }`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{req.domain_name}</span>
                      <StatusBadge req={req} />
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded capitalize">
                        {req.domain_type} domain
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {req.store?.name} · {req.owner?.email} · {fmt(req.requested_at || req.created_at)}
                    </p>
                  </div>

                  {/* Amount + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-gray-900 text-sm">₦{req.amount_paid.toLocaleString()}</span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </div>

                {/* Expanded section */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                    {/* Details grid */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-1.5 text-sm">
                        <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-orange-400" /> Store
                        </p>
                        {[
                          ['Name',           req.store?.name],
                          ['Slug',           req.store?.slug],
                          ['Current Domain', req.store?.custom_domain || 'None'],
                          ['Domain Status',  req.store?.domain_status],
                        ].map(([l, v]) => (
                          <div key={l as string} className="flex justify-between text-xs">
                            <span className="text-gray-400">{l}</span>
                            <span className="font-medium text-gray-800 capitalize">{v || '—'}</span>
                          </div>
                        ))}
                        <a href={`/${req.store?.slug}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-500 hover:underline mt-1">
                          View Store <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-1.5 text-sm">
                        <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-orange-400" /> Owner
                        </p>
                        {[
                          ['Name',      req.owner?.full_name],
                          ['Email',     req.owner?.email],
                          ['Phone',     req.owner?.phone || 'N/A'],
                          ['Payment',   req.payment_reference?.slice(0, 20) + '…'],
                          ['Paid',      `₦${req.amount_paid.toLocaleString()}`],
                        ].map(([l, v]) => (
                          <div key={l as string} className="flex justify-between text-xs">
                            <span className="text-gray-400">{l}</span>
                            <span className="font-medium text-gray-800">{v || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Admin note */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Admin Note (sent to user in email)
                      </label>
                      <textarea
                        value={notes[req.id] ?? (req.admin_notes || '')}
                        onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Optional note for the store owner…"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 resize-none bg-white"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {isActionable && (
                        <>
                          <button onClick={() => handleApprove(req)} disabled={isProcessing}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Approve & Connect
                          </button>
                          <button onClick={() => handleProcessing(req)} disabled={isProcessing}
                            className="flex items-center gap-1.5 px-4 py-2 border border-blue-400 text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                            Mark Processing
                          </button>
                          <button onClick={() => handleReject(req)} disabled={isProcessing}
                            className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}

                      {/* Revert — always available if domain is connected */}
                      {canRevert && (
                        <button onClick={() => handleRevert(req)} disabled={isProcessing}
                          className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors ml-auto">
                          <X className="w-4 h-4" />
                          Revert to Default URL
                        </button>
                      )}
                    </div>

                    {/* Status banners */}
                    {req.status === 'completed' && (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl text-sm">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        Approved on {req.approved_at ? fmt(req.approved_at) : '—'}
                      </div>
                    )}
                    {req.status === 'rejected' && (
                      <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl text-sm">
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                        Rejected — {req.admin_notes || 'no reason given'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
