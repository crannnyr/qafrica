// /admin/issues  Orders where the customer reported a problem. Payment stays frozen until resolved here.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';

type IssueOrder = {
  id: string;
  order_number: string;
  total: number;
  refund_amount: number | null;
  status: string;
  payment_provider: string | null;
  issue_description: string | null;
  issue_reported_at: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  stores: { name: string; slug: string } | null;
  order_items: { product_name: string; quantity: number; total_price: number }[];
};

const naira = (n: number | null | undefined) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;

export default function AdminIssues() {
  const [rows, setRows] = useState<IssueOrder[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<'release' | 'refund'>('refund');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [bank, setBank] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, total, refund_amount, status, payment_provider, issue_description, issue_reported_at, customer_name, customer_email, customer_phone, created_at, stores(name, slug), order_items(product_name, quantity, total_price)')
      .eq('buyer_reported_issue', true)
      .order('issue_reported_at', { ascending: true });
    setRows((data as unknown as IssueOrder[]) ?? []);
  }, []);
  useEffect(() => {
    let alive = true;
    supabase
      .from('orders')
      .select('id, order_number, total, refund_amount, status, payment_provider, issue_description, issue_reported_at, customer_name, customer_email, customer_phone, created_at, stores(name, slug), order_items(product_name, quantity, total_price)')
      .eq('buyer_reported_issue', true)
      .order('issue_reported_at', { ascending: true })
      .then(({ data }) => alive && setRows((data as unknown as IssueOrder[]) ?? []));
    return () => {
      alive = false;
    };
  }, []);

  const start = (o: IssueOrder) => {
    setOpen(o.id);
    setMode('refund');
    setAmount(String(Number(o.total) - Number(o.refund_amount ?? 0)));
    setAccount('');
    setBank('');
    setNote('');
  };

  const submit = async (o: IssueOrder) => {
    if (!note.trim()) return toast.error('Add a short note explaining the decision');
    if (mode === 'release') {
      if (!window.confirm(`Release ${naira(o.total)} to ${o.stores?.name}? The customer will not be refunded.`)) return;
      setBusy(true);
      const { error } = await supabase.rpc('admin_resolve_issue_release', { p_order_id: o.id, p_note: note });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success('Released to the seller');
    } else {
      const amt = Number(amount);
      if (!window.confirm(`Send ${naira(amt)} to account ${account} (bank code ${bank})? This moves real money and can't be undone.`)) return;
      setBusy(true);
      const { data, error } = await supabase.functions.invoke('admin-refund', { body: { order_id: o.id, amount: amt, account_number: account, bank_code: bank, note } });
      setBusy(false);
      if (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = await (error as any)?.context?.json?.().catch(() => null);
        return toast.error(body?.error ?? error.message);
      }
      toast.success(`Refunded ${naira(amt)}${data?.ledger?.platform_cost ? ` (payment fee cost to QAFRICA: ${naira(data.ledger.platform_cost)})` : ''}`);
    }
    setOpen(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reported problems</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customer payments are frozen until you release them to the seller or refund the customer. Oldest first.</p>
        </div>
        <button type="button" onClick={() => void load()} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {!rows && <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}
      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" aria-hidden />
          <p className="mt-2 font-semibold text-gray-900 dark:text-white">No open problems</p>
        </div>
      )}

      {(rows ?? []).map((o) => (
        <div key={o.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">#{o.order_number} · {o.stores?.name} · {naira(o.total)}</p>
              <p className="text-xs text-gray-500">Reported {o.issue_reported_at ? new Date(o.issue_reported_at).toLocaleString('en-NG') : ''} · status {o.status} · paid via {o.payment_provider ?? 'paystack'}</p>
            </div>
            {open !== o.id && (
              <button type="button" onClick={() => start(o)} className="h-9 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">Resolve</button>
            )}
          </div>
          <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /><span>“{o.issue_description}”</span>
          </div>
          <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <p className="font-medium">Customer</p>
              <p>{o.customer_name}</p>
              <p>{o.customer_email}</p>
              <p>{o.customer_phone}</p>
            </div>
            <div>
              <p className="font-medium">Items</p>
              {o.order_items.map((i, k) => <p key={k}>{i.product_name} × {i.quantity} · {naira(i.total_price)}</p>)}
            </div>
          </div>

          {open === o.id && (
            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                <button type="button" onClick={() => setMode('refund')} className={`px-3 py-1.5 rounded-md text-sm ${mode === 'refund' ? 'bg-gray-900 text-white' : ''}`}><RotateCcw className="w-4 h-4 inline mr-1" />Refund customer</button>
                <button type="button" onClick={() => setMode('release')} className={`px-3 py-1.5 rounded-md text-sm ${mode === 'release' ? 'bg-gray-900 text-white' : ''}`}><CheckCircle2 className="w-4 h-4 inline mr-1" />Release to seller</button>
              </div>
              {mode === 'refund' && (
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-sm">Amount (₦)
                    <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900" />
                  </label>
                  <label className="text-sm">Customer account number
                    <input value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900" />
                  </label>
                  <label className="text-sm">Bank code
                    <input value={bank} onChange={(e) => setBank(e.target.value.trim())} placeholder="e.g. 058" className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900" />
                  </label>
                  <p className="sm:col-span-3 text-xs text-gray-500">Get the customer's account details by email or phone. Partial refunds come out of the seller's held payment; QAFRICA's commission is kept. Nomba's fee isn't returned by Nomba and is recorded as a QAFRICA cost on full refunds.</p>
                </div>
              )}
              <label className="block text-sm">Note (visible to admins)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900" placeholder="What did you find? e.g. seller sent photo proof of delivery" />
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => submit(o)} className={`h-10 px-5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${mode === 'refund' ? 'bg-red-600' : 'bg-green-600'}`}>
                  {busy ? 'Working…' : mode === 'refund' ? 'Send refund' : 'Release payment'}
                </button>
                <button type="button" onClick={() => setOpen(null)} className="h-10 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
