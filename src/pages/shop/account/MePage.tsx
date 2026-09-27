// /customer/dashboard  "Me": profile, order shortcuts, services, recommendations.
import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle2, AlertTriangle, Search, Link2, HandHeart, Crown, Heart, MapPin, Headphones, ShieldCheck, LogOut, ChevronRight, Settings } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores';
import CONFIG from '@/lib/config';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import BottomNav from '../BottomNav';
import { EscrowExplainer, InfoButton } from '../ui';
import { bucketOf, useMyOrders } from './data';
import ProductCard, { ProductCardSkeleton } from '@/pages/marketplace/ProductCard';
import { useMarketFeed } from '@/pages/marketplace/useMarketplace';

export default function MePage() {
  useForceLightMode();
  const navigate = useNavigate();
  const { customer, isAuthenticated, logout } = useCustomerAuthStore();
  const { orders } = useMyOrders();
  if (!isAuthenticated || !customer) return <Navigate to={`/customer/login?return=${encodeURIComponent('/customer/dashboard')}`} replace />;

  const count = (b: string) => (orders ?? []).filter((o) => bucketOf(o) === b).length;
  const shortcuts = [
    { id: 'to_ship', label: 'To ship', icon: Package, info: 'Paid orders the seller is preparing.' },
    { id: 'on_the_way', label: 'On the way', icon: Truck, info: 'The seller has sent these. Confirm when you receive them.' },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle2, info: 'Received orders. You can still report a problem until payment is released.' },
    { id: 'problems', label: 'Problems', icon: AlertTriangle, info: 'Orders where you reported a problem. QAFRICA is reviewing them.' },
  ];
  const services = [
    { to: '/track-order', label: 'Track order', icon: Search },
    { to: '/customer/links', label: 'Pay-for-me links', icon: Link2 },
    { to: '/help-pay', label: 'Help Pay', icon: HandHeart },
    { to: '/help-pay/leaderboard', label: 'Cart Clearers', icon: Crown },
    { to: '/customer/wishlist', label: 'Wishlist', icon: Heart },
    { to: '/customer/addresses', label: 'Addresses', icon: MapPin },
    { to: `mailto:${CONFIG.PLATFORM_EMAIL}`, label: 'Customer service', icon: Headphones, external: true },
    { to: '/customer/profile', label: 'Account settings', icon: Settings },
  ];
  const initial = (customer.full_name || customer.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-24">
      <header className="bg-white px-4 pt-5 pb-4" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-gray-900 text-white text-[18px] font-bold flex items-center justify-center shrink-0" aria-hidden>{initial}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold truncate">{customer.full_name || 'My account'}</p>
            <p className="text-[12px] text-gray-500 truncate">{customer.email}</p>
          </div>
          <button type="button" onClick={async () => { await logout(); navigate('/stores'); }} aria-label="Sign out" className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto space-y-2 mt-2">
        <section className="bg-white px-4 py-3" aria-labelledby="h-orders">
          <div className="flex items-center justify-between">
            <h2 id="h-orders" className="text-[14px] font-semibold">My orders</h2>
            <Link to="/customer/orders" className="text-[12px] text-gray-500 inline-flex items-center">View all<ChevronRight className="w-4 h-4" aria-hidden /></Link>
          </div>
          <ul className="mt-3 grid grid-cols-4">
            {shortcuts.map((s) => {
              const n = count(s.id);
              return (
                <li key={s.id}>
                  <Link to={`/customer/orders?tab=${s.id}`} className="flex flex-col items-center gap-1.5 py-1" aria-label={`${s.label}: ${n}`}>
                    <span className="relative">
                      <s.icon className="w-6 h-6" strokeWidth={1.6} aria-hidden />
                      {n > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FA6338] text-white text-[10px] font-bold flex items-center justify-center">{n}</span>}
                    </span>
                    <span className="text-[11.5px] text-gray-700">{s.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1A7F37]" aria-hidden /> Your payments are held until you receive your orders.
            <InfoButton title="Buyer protection"><EscrowExplainer /></InfoButton>
          </p>
        </section>

        <section className="bg-white px-4 py-3" aria-label="Services">
          <ul className="grid grid-cols-4 gap-y-4">
            {services.map((s) => {
              const inner = (<><s.icon className="w-6 h-6" strokeWidth={1.6} aria-hidden /><span className="text-[11px] text-center text-gray-700 leading-tight">{s.label}</span></>);
              return (
                <li key={s.label}>
                  {s.external ? (
                    <a href={s.to} className="flex flex-col items-center gap-1.5 px-1">{inner}</a>
                  ) : (
                    <Link to={s.to} className="flex flex-col items-center gap-1.5 px-1">{inner}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <Recommendations />
      </div>
      <BottomNav />
    </div>
  );
}

function Recommendations() {
  const feed = useMarketFeed({ tab: 'for_you', niche: null, category: null, search: null });
  const sentinel = useRef<HTMLDivElement>(null);
  const { loadMore } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && loadMore(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);
  return (
    <section aria-labelledby="h-recs" className="pt-2">
      <h2 id="h-recs" className="px-4 pb-2 text-[14px] font-semibold text-center">You might like</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-1.5">
        {feed.items.map((p) => <li key={p.id}><ProductCard p={p} /></li>)}
        {feed.status === 'loading' && Array.from({ length: 4 }).map((_, i) => <li key={`s${i}`}><ProductCardSkeleton /></li>)}
      </ul>
      <div ref={sentinel} className="h-1" aria-hidden />
    </section>
  );
}
