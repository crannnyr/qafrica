import { useState } from 'react';
import { Loader, Search, X, CheckCircle2 } from 'lucide-react';
import CONFIG from '@/lib/config';
import ManagementOrdersLegacy, { OrderDetails } from './ManagementOrdersLegacy';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

export default function ManagementOrders() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const token = sessionStorage.getItem('import_manager_token') || '';

  const searchOrder = async () => {
    const code = query.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError('');
    setFound(null);
    try {
      if (!token) throw new Error('Management session expired');
      const res = await fetch(`${EDGE_URL}?action=load-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.order) throw new Error(data.error ?? 'Order not found');
      setFound(data.order);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Order not found';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => { setQuery(''); setFound(null); setError(''); };
  const batchLabel = found?.staged_at
    ? `Batch — ${new Date(found.staged_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
    : 'Active — not yet assigned to a batch';

  return (
    <div className="w-full space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') void searchOrder(); }}
            placeholder="Search any order by order code…"
            className="flex-1 min-w-0 px-1 py-2 text-sm outline-none font-mono uppercase"
            aria-label="Search batch orders by order code"
          />
          {query && <button onClick={clearSearch} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Clear search"><X className="w-4 h-4 text-gray-400" /></button>}
          <button onClick={() => void searchOrder()} disabled={loading || !query.trim()} className="px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
            {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
      </div>

      {found && (
        <div className="bg-white rounded-2xl border border-orange-100 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order found</p>
              <button onClick={() => setDetails(found)} className="mt-0.5 text-sm font-black text-orange-600 font-mono hover:underline">{found.code}</button>
              <p className="text-xs text-gray-700 mt-1">{found.customer_name} · {found.customer_whatsapp || 'No WhatsApp'}</p>
              <p className="text-[11px] text-gray-400 mt-1">Created {new Date(found.created_at).toLocaleString('en-NG')}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> {batchLabel}</p>
            </div>
            <button onClick={() => setDetails(found)} className="shrink-0 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">View details</button>
          </div>
        </div>
      )}

      <ManagementOrdersLegacy />

      {details && <OrderDetails
        token={token}
        order={details}
        onClose={() => setDetails(null)}
        onReload={async () => { setDetails(null); }}
        onOpenClient={() => toast.info('Open this order from the batch list to view client details.')}
      />}
    </div>
  );
}
