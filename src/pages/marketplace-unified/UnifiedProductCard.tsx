import { Link } from 'react-router-dom';
import { BadgeCheck, Star } from 'lucide-react';
import { MARKETPLACE_STATE } from '@/lib/navigation';
import { naira, soldLabel } from './useUnifiedMarketplace';
import type { UnifiedMarketplaceProduct } from './types';

export default function UnifiedProductCard({ p, priority = false }: { p: UnifiedMarketplaceProduct; priority?: boolean }) {
  const href = `/stores?source_type=${encodeURIComponent(p.source_type)}&source_id=${encodeURIComponent(p.source_id)}`;
  const sold = soldLabel(p.sold);
  const onSale = p.discount_pct > 0 && p.compare_at_price;

  return (
    <Link to={href} state={MARKETPLACE_STATE} className="group block bg-white rounded-md overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
      <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
        <img src={p.image} alt={p.name} loading={priority ? 'eager' : 'lazy'} decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        {p.is_china_import && <span className="absolute top-0 left-0 bg-gray-900 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-br-md">China Import</span>}
        {!p.is_china_import && onSale && <span className="absolute top-0 left-0 bg-[#FA6338] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-br-md">-{p.discount_pct}%</span>}
      </div>
      <div className="px-2 pt-1.5 pb-2.5">
        <h3 className="text-[13px] leading-snug text-gray-800 truncate">{p.name}</h3>
        {(p.review_count > 0 || sold) && <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">{p.review_count > 0 && p.rating != null && <span className="inline-flex items-center gap-0.5 text-gray-700"><Star className="w-3 h-3 fill-gray-900 text-gray-900" aria-hidden />{Number(p.rating).toFixed(1)} <span className="text-gray-400">({p.review_count})</span></span>}{sold && <span>{sold}</span>}</p>}
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap"><span className={`text-[15px] font-bold tracking-tight ${onSale ? 'text-[#FA6338]' : 'text-gray-900'}`}>{naira(p.price)}</span>{onSale && <s className="text-[11px] text-gray-400">{naira(p.compare_at_price!)}</s>}</div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 truncate"><span className="truncate">{p.store_name}</span>{p.store_verified && <BadgeCheck className="w-3 h-3 text-sky-600 shrink-0" aria-label="Verified marketplace source" />}</p>
      </div>
    </Link>
  );
}
