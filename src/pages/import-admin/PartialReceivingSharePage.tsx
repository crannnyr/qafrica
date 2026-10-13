import { useEffect, useState } from 'react';
import { AlertCircle, PackageCheck } from 'lucide-react';
import CONFIG from '@/lib/config';

type SharedItem = {
  order_code?: string;
  product_name: string;
  image_url: string | null;
  variant_options: Record<string, unknown> | null;
  ordered_quantity: number;
  received_quantity: number;
  remaining_quantity: number;
};

type SharedList = {
  order_code: string;
  created_at: string;
  items: SharedItem[];
};

function variantLabel(options: Record<string, unknown> | null) {
  if (!options) return '';
  return Object.entries(options)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export default function PartialReceivingSharePage() {
  const token = window.location.pathname.split('/').filter(Boolean).at(-1) ?? '';
  const [list, setList] = useState<SharedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${CONFIG.SUPABASE_URL}/functions/v1/partial-receiving-share?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'This shared list could not be found.');
        return data as SharedList;
      })
      .then(data => { if (active) setList(data); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load this list.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-2xl bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2 text-orange-600">
            <PackageCheck className="h-6 w-6" />
            <span className="text-sm font-bold uppercase tracking-wide">QAfrica · Fulfillment</span>
          </div>
          <h1 className="mt-3 text-2xl font-black text-gray-900 sm:text-3xl">Items still awaiting receipt</h1>
          <p className="mt-2 text-sm text-gray-500">This public list contains only the outstanding quantities from a partially received order.</p>
          {list && <p className="mt-3 text-xs font-semibold text-gray-500">Order {list.order_code} · Created {new Date(list.created_at).toLocaleDateString()}</p>}
        </header>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500">Loading shared list…</div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-white p-6 text-sm text-red-700"><AlertCircle className="h-5 w-5 flex-shrink-0" />{error}</div>
        ) : !list?.items.length ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-600">There are no outstanding items in this list.</div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
              <span className="text-sm font-semibold text-orange-900">Outstanding product lines</span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-orange-700">{list.items.length}</span>
            </div>
            <div className="space-y-3">
              {list.items.map((item, index) => (
                <article key={`${item.product_name}-${index}`} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                  {item.image_url ? <img src={item.image_url} alt={item.product_name} loading="lazy" className="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100 object-cover sm:h-24 sm:w-24" /> : <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100 sm:h-24 sm:w-24" />}
                  <div className="min-w-0 flex-1">
                    {item.order_code && <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-orange-600">Order {item.order_code}</p>}<h2 className="text-sm font-bold text-gray-900 sm:text-base">{item.product_name}</h2>
                    {variantLabel(item.variant_options) && <p className="mt-1 text-xs text-gray-500">{variantLabel(item.variant_options)}</p>}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-gray-400">Ordered</p><p className="mt-1 font-bold text-gray-800">{item.ordered_quantity}</p></div>
                      <div><p className="text-gray-400">Received</p><p className="mt-1 font-bold text-emerald-700">{item.received_quantity}</p></div>
                      <div><p className="text-gray-400">Still needed</p><p className="mt-1 font-black text-orange-700">{item.remaining_quantity}</p></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-gray-400">Shared using a private link. Customer contact and delivery details are not shown.</p>
          </>
        )}
      </div>
    </main>
  );
}
