import { useState } from 'react';
import { Check, Loader2, Tag, X } from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-promotions`;

export type ChinaImportPromotionQuote = {
  promotion_id: string | null;
  code: string | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_amount_ngn: number;
  message: string;
  pending_order?: {
    id: string;
    code: string;
    subtotal_ngn: number;
    total_ngn: number;
    promotion_id: string | null;
    promotion_code: string | null;
    promotion_discount_ngn: number;
  } | null;
};

interface Props {
  customerId: string;
  orderSubtotalNgn: number;
  value: string;
  onChange: (value: string) => void;
  onApplied: (quote: ChinaImportPromotionQuote | null) => void;
}

export default function ChinaImportPromoCode({ customerId, orderSubtotalNgn, value, onChange, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<ChinaImportPromotionQuote | null>(null);
  const [message, setMessage] = useState('');

  const apply = async () => {
    const code = value.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${EDGE_URL}?action=validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, code, order_subtotal_ngn: orderSubtotalNgn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not validate promo code');
      const next = data.promotion
  ? ({ ...(data.promotion as ChinaImportPromotionQuote), pending_order: data.pending_order ?? null } as ChinaImportPromotionQuote)
  : null;
      setQuote(next);
      setMessage(next?.message ?? 'This promo code is not valid.');
      onApplied(next?.promotion_id ? next : null);
    } catch (e: any) {
      setQuote(null); onApplied(null); setMessage(e?.message ?? 'Could not validate promo code.');
    } finally {
      setLoading(false);
    }
  };

  const remove = () => {
    setQuote(null); setMessage(''); onApplied(null); onChange('');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><Tag className="w-4 h-4 text-orange-500" />Promo code</div>
      {quote?.promotion_id ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span className="text-sm font-bold text-emerald-800 truncate">{quote.code}</span><span className="text-xs text-emerald-700">saved ₦{quote.discount_amount_ngn.toLocaleString()}</span></div>
          <button onClick={remove} className="p-1 text-emerald-700" aria-label="Remove promo"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input value={value} onChange={e => onChange(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') apply(); }} placeholder="Enter promo code" className="min-w-0 flex-1 border rounded-lg px-3 py-2.5 text-sm uppercase" />
          <button disabled={loading || !value.trim()} onClick={apply} className="px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />}Apply</button>
        </div>
      )}
      {message && !quote?.promotion_id && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
