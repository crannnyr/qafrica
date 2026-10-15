// /customer/dashboard  "Me": profile, order shortcuts, services, recommendations.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle2, AlertTriangle, Search, Link2, HandHeart, Crown, Heart, MapPin, Headphones, ShieldCheck, LogOut, ChevronRight, Settings, Store, ExternalLink, X } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores';
import { supabase } from '@/services';
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
  const [marketplaceProfile, setMarketplaceProfile] = useState<{ full_name: string | null; phone: string | null; avatar_url: string | null } | null>(null);
  const [showSellerModal, setShowSellerModal] = useState(false);
  const { orders } = useMyOrders();

  useEffect(() => {
    if (!customer?.id) return;
    let active = true;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!active || !user) return;
      const { data, error } = await supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle();
      if (!active || error) return;
      setMarketplaceProfile({
        full_name: data?.full_name || user.user_metadata?.full_name || customer.full_name || null,
        phone: data?.phone || user.user_metadata?.phone || customer.phone || null,
        avatar_url: data?.avatar_url || null,
      });
    })();
    return () => { active = false; };
  }, [customer?.id, customer?.full_name, customer?.phone]);
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
  const displayName = marketplaceProfile?.full_name?.trim() || customer.full_name || '';
  const displayPhone = marketplaceProfile?.phone?.trim() || '';
  const displayAvatar = marketplaceProfile?.avatar_url || customer.avatar_url || '';
  const initial = (displayName || customer.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-24">
      <header className="bg-white px-4 pt-5 pb-4" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/customer/profile" aria-label="Open account settings" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <span className="w-12 h-12 rounded-full overflow-hidden bg-gray-900 text-white text-[18px] font-bold flex items-center justify-center shrink-0" aria-hidden>{displayAvatar ? <img src={displayAvatar} alt="" className="h-full w-full object-cover" /> : initial}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold truncate">{displayName || 'My account'}</p>
              <p className="text-[12px] text-gray-500 truncate">{customer.email || ''}</p>
            </div>
          </Link>
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

        <section className="px-4 pt-1" aria-label="Seller signup">
          <button type="button" onClick={() => setShowSellerModal(true)} className="group flex w-full items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left transition hover:bg-orange-100">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white"><Store className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-orange-900">Become a Seller</span>
              <span className="block text-xs text-orange-700">Get your own store and start dropshipping</span>
            </span>
            <ExternalLink className="h-4 w-4 text-orange-700" />
          </button>
        </section>

        {showSellerModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="seller-onboarding-title">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 bg-orange-500 p-5 text-white">
                <div>
                  <h2 id="seller-onboarding-title" className="text-lg font-bold">Your store starts here</h2>
                  <p className="mt-1 text-sm text-white/90">Become a seller or dropship products.</p>
                </div>
                <button type="button" onClick={() => setShowSellerModal(false)} aria-label="Close seller details" className="rounded-lg p-1 hover:bg-white/15"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <p className="text-2xl font-black text-gray-900">₦5,000 <span className="text-sm font-semibold text-gray-500">/ 3 months</span></p>
                  <p className="mt-1 text-sm text-gray-700">One subscription includes your personal online store, training on selling, marketplace features and dropshipping access.</p>
                </div>
                <p className="text-sm leading-relaxed text-gray-600">You will get your own store. After signing up, open the <strong className="text-gray-900">Marketplace</strong> section in the sidebar and complete the verification steps to activate your seller access.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowSellerModal(false)} className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Maybe later</button>
                  <a href="https://qafrica.store" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-orange-500 px-3 text-sm font-bold text-white hover:bg-orange-600" onClick={() => setShowSellerModal(false)}>Route me, I'm ready</a>
                </div>
              </div>
            </div>
          </div>
        )}

        <Recommendations />
      </div>
      <BottomNav />
    </div>
  );
}

const RECOMMENDATION_SHUFFLE_INTERVAL_MS = 30 * 60 * 1000;
const RECOMMENDATION_SHUFFLE_STORAGE_KEY = 'qafrica:account-recommendations-shuffle:v1';

type ShuffleSnapshot = { shuffledAt: number; ids: string[] };

function shuffleProducts<T extends { id: string }>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function readShuffleSnapshot(): ShuffleSnapshot | null {
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_SHUFFLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShuffleSnapshot;
    return Number.isFinite(parsed.shuffledAt) && Array.isArray(parsed.ids) ? parsed : null;
  } catch {
    return null;
  }
}

function saveShuffleSnapshot(snapshot: ShuffleSnapshot) {
  try {
    window.localStorage.setItem(RECOMMENDATION_SHUFFLE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Recommendations still work when browser storage is unavailable.
  }
}

function Recommendations() {
  const feed = useMarketFeed({ tab: 'for_you', niche: null, category: null, search: null });
  const sentinel = useRef<HTMLDivElement>(null);
  const { loadMore } = feed;
  const [shuffleSnapshot, setShuffleSnapshot] = useState<ShuffleSnapshot | null>(() => readShuffleSnapshot());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && loadMore(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!feed.items.length) return;
    const current = readShuffleSnapshot();
    const expired = !current || now - current.shuffledAt >= RECOMMENDATION_SHUFFLE_INTERVAL_MS;
    if (expired) {
      const next = { shuffledAt: now, ids: shuffleProducts(feed.items).map((item) => item.id) };
      saveShuffleSnapshot(next);
      setShuffleSnapshot(next);
      return;
    }

    const availableIds = new Set(feed.items.map((item) => item.id));
    const retainedIds = current.ids.filter((id) => availableIds.has(id));
    const missingItems = feed.items.filter((item) => !retainedIds.includes(item.id)).map((item) => item.id);
    if (missingItems.length) {
      const next = { ...current, ids: [...retainedIds, ...missingItems] };
      saveShuffleSnapshot(next);
      setShuffleSnapshot(next);
    } else if (!shuffleSnapshot || shuffleSnapshot.shuffledAt !== current.shuffledAt || shuffleSnapshot.ids.join('|') !== current.ids.join('|')) {
      setShuffleSnapshot(current);
    }
  }, [feed.items, now, shuffleSnapshot]);

  const orderedItems = useMemo(() => {
    if (!shuffleSnapshot || !feed.items.length) return feed.items;
    const rank = new Map(shuffleSnapshot.ids.map((id, index) => [id, index]));
    return [...feed.items].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [feed.items, shuffleSnapshot]);

  return (
    <section aria-labelledby="h-recs" className="pt-2">
      <h2 id="h-recs" className="px-4 pb-2 text-[14px] font-semibold text-left">You might like</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-1.5">
        {orderedItems.map((p) => <li key={p.id}><ProductCard p={p} /></li>)}
        {feed.status === 'loading' && Array.from({ length: 4 }).map((_, i) => <li key={`s${i}`}><ProductCardSkeleton /></li>)}
      </ul>
      <div ref={sentinel} className="h-1" aria-hidden />
    </section>
  );
}
