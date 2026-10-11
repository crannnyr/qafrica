import { useEffect, useState } from 'react';
import { ArrowLeft, History, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

type SaleHistory = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  total: number;
  payment_method: string | null;
  created_at: string;
};

const money = (value: number) => `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default function POSHistoryPage() {
  const navigate = useNavigate();
  const { currentStore } = useStoreStore();
  const [sales, setSales] = useState<SaleHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    if (!currentStore?.id) { setSales([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_number,customer_name,total,payment_method,created_at')
      .eq('store_id', currentStore.id)
      .eq('is_manual_sale', true)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast.error('Could not load POS sale history');
    else setSales((data || []) as SaleHistory[]);
    setLoading(false);
  };

  useEffect(() => { void loadHistory(); }, [currentStore?.id]);

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Store tools / Point of Sale</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight"><History className="h-7 w-7" />Sales history</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review recent in-store sales for the selected store.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadHistory()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button onClick={() => navigate('/dashboard/pos')}><ArrowLeft className="mr-2 h-4 w-4" />Back to POS</Button>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 sm:p-5">
          <h2 className="font-semibold">Recent sales</h2>
          <p className="mt-1 text-sm text-muted-foreground">Showing the latest {sales.length} POS sale{sales.length === 1 ? '' : 's'} (up to 100).</p>
        </div>
        {loading ? <div className="space-y-3 p-5"><div className="h-8 animate-pulse rounded bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /></div>
          : sales.length === 0 ? <div className="p-8 text-center"><History className="mx-auto h-9 w-9 text-muted-foreground/50" /><p className="mt-3 font-medium">No POS sales yet</p><p className="mt-1 text-sm text-muted-foreground">Completed in-store sales will appear here.</p><Button className="mt-4" onClick={() => navigate('/dashboard/pos')}>Record a sale</Button></div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Receipt / Order</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Payment method</th><th className="px-4 py-3 font-medium">Date and time</th><th className="px-4 py-3 text-right font-medium">Total</th></tr></thead>
            <tbody>{sales.map((sale) => <tr key={sale.id} className="border-t"><td className="px-4 py-3 font-medium">{sale.order_number || sale.id.slice(0, 8)}</td><td className="px-4 py-3">{sale.customer_name || 'Walk-in customer'}</td><td className="px-4 py-3 capitalize">{sale.payment_method || '—'}</td><td className="px-4 py-3">{new Date(sale.created_at).toLocaleString()}</td><td className="px-4 py-3 text-right font-semibold">{money(Number(sale.total) || 0)}</td></tr>)}</tbody>
          </table></div>}
      </section>
    </div>
  );
}
