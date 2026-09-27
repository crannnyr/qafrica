// /help-pay            public board of carts people want help paying for
// /help-pay/leaderboard Cart Clearers top 50 (+ my stats and social links)
// /help-pay/claim?ref=  guest payer claims their clear after creating an account
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, HandHeart, MapPin, Instagram, Twitter, Music2, ChevronRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import BottomNav from '../BottomNav';
import { Field, InfoButton, PageHeader } from '../ui';
import { naira } from '../format';

type FeedCart = { code: string; first_name: string; city: string | null; state: string | null; note: string | null; amount: number; preview_images: string[] | null; item_count: number; published_at: string; expires_at: string };
const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'ending', label: 'Ending soon' },
] as const;
const CAPS = [null, 5000, 20000, 50000] as const;
const PAGE = 20;

export function HelpPayPage() {
  useForceLightMode();
  const [sort, setSort] = useState<(typeof SORTS)[number]['id']>('newest');
  const [cap, setCap] = useState<number | null>(null);
  const [items, setItems] = useState<FeedCart[]>([]);
  const [state, setState] = useState<'loading' | 'idle' | 'done' | 'error'>('loading');
  const offset = useRef(0);
  const req = useRef(0);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const sentinel = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (reset: boolean) => {
    const id = ++req.current;
    if (reset) offset.current = 0;
    const { data, error } = await supabase.rpc('help_pay_feed', { p_sort: sort, p_max_amount: cap, p_limit: PAGE, p_offset: offset.current });
    if (id !== req.current) return;
    if (error) return setState('error');
    const rows = (data as FeedCart[]) ?? [];
    offset.current += rows.length;
    setItems((prev) => (reset ? rows : [...prev, ...rows]));
    setState(rows.length < PAGE ? 'done' : 'idle');
  }, [sort, cap]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      setItems([]);
      setState('loading');
      void fetchPage(true);
    });
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting && stateRef.current === 'idle') {
        stateRef.current = 'loading';
        setState('loading');
        void fetchPage(false);
      }
    }, { rootMargin: '500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [fetchPage]);

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-24">
      <PageHeader
        title={<span className="inline-flex items-center gap-1.5"><HandHeart className="w-4 h-4" aria-hidden />Help Pay</span>}
        back={false}
        right={<InfoButton title="How Help Pay works"><p>People post carts they'd love help with. Pick one and pay through QAFRICA, and the order is delivered to them.</p><p>Every clear counts toward the Cart Clearers board once the order is delivered. Never send money outside QAFRICA.</p></InfoButton>}
      />
      <div className="max-w-2xl mx-auto">
        <Link to="/help-pay/leaderboard" className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-gray-900 text-white px-4 py-3">
          <Crown className="w-6 h-6 text-[#FFC53D]" aria-hidden />
          <div className="flex-1">
            <p className="text-[14px] font-bold">Cart Clearers</p>
            <p className="text-[11px] text-white/70">See who's cleared the most carts. Top 50.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70" aria-hidden />
        </Link>

        <div className="px-3 pt-3 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Sort">
          {SORTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}
              className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-semibold ${sort === s.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>{s.label}</button>
          ))}
          <span className="w-px bg-gray-200 mx-1" aria-hidden />
          {CAPS.map((c) => (
            <button key={String(c)} type="button" aria-pressed={cap === c} onClick={() => setCap(c)}
              className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-semibold ${cap === c ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>{c ? `Under ${naira(c)}` : 'Any price'}</button>
          ))}
        </div>

        <ul className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((c) => (
            <li key={c.code}>
              <Link to={`/pay/${c.code}`} className="block bg-white rounded-xl p-3 hover:shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold truncate">{c.first_name}'s cart</p>
                  <p className="text-[15px] font-bold">{naira(c.amount)}</p>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500"><MapPin className="w-3 h-3" aria-hidden />{[c.city, c.state].filter(Boolean).join(', ')} · {c.item_count} item{c.item_count === 1 ? '' : 's'}</p>
                {c.note && <p className="mt-2 text-[12.5px] text-gray-700 line-clamp-2">“{c.note}”</p>}
                <div className="mt-2 flex items-center gap-1.5">
                  {(c.preview_images ?? []).slice(0, 4).map((src, i) => <img key={i} src={src} alt="" loading="lazy" className="w-12 h-12 rounded-md object-cover bg-gray-100" />)}
                  <span className="ml-auto h-8 px-3 rounded-lg bg-[#FA6338] text-white text-[12px] font-semibold inline-flex items-center">Help pay</span>
                </div>
              </Link>
            </li>
          ))}
          {state === 'loading' && Array.from({ length: 4 }).map((_, i) => <li key={`s${i}`} className="h-36 bg-white rounded-xl animate-pulse" />)}
        </ul>
        <div ref={sentinel} className="h-1" aria-hidden />

        {state === 'done' && items.length === 0 && (
          <div className="mx-3 bg-white rounded-xl px-6 py-12 text-center">
            <HandHeart className="w-10 h-10 mx-auto text-gray-300" aria-hidden />
            <p className="mt-3 text-[14px] font-semibold">No carts here yet</p>
            <p className="mt-1 text-[12px] text-gray-500">{cap ? 'Try a higher price limit.' : 'Be the first: post your cart and let someone help.'}</p>
          </div>
        )}
        {state === 'error' && <p className="text-center text-[13px] text-gray-600 py-6">Couldn't load carts. Pull to refresh or try again.</p>}

        <div className="mx-3 mt-2 rounded-xl bg-white p-4">
          <p className="text-[13px] font-semibold">Want help with your cart?</p>
          <p className="mt-1 text-[12px] text-gray-500">In your cart, tap “Ask someone to pay”, then post the link on Help Pay from “Pay-for-me links” in your account.</p>
          <Link to="/cart" className="mt-3 inline-flex h-9 px-4 items-center rounded-lg border border-gray-900 text-[12px] font-semibold">Go to cart</Link>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

type Row = { rank: number; display_name: string; instagram: string | null; tiktok: string | null; x_handle: string | null; carts_cleared: number; is_me: boolean };
type Stats = { counted: number; paid: number; profile: { display_name: string; instagram: string | null; tiktok: string | null; x_handle: string | null; show_on_board: boolean } | null };

export function LeaderboardPage() {
  useForceLightMode();
  const { isAuthenticated } = useCustomerAuthStore();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    supabase.rpc('cart_clearers_leaderboard').then(({ data }) => setRows((data as Row[]) ?? []));
    if (isAuthenticated) supabase.rpc('my_cart_clearer_stats').then(({ data }) => setStats(data as Stats));
  }, [isAuthenticated]);
  useEffect(() => {
    let alive = true;
    supabase.rpc('cart_clearers_leaderboard').then(({ data }) => alive && setRows((data as Row[]) ?? []));
    if (isAuthenticated) supabase.rpc('my_cart_clearer_stats').then(({ data }) => alive && setStats(data as Stats));
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null);

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-24">
      <PageHeader title={<span className="inline-flex items-center gap-1.5"><Crown className="w-4 h-4 text-[#D4A017]" aria-hidden />Cart Clearers</span>} back="/help-pay"
        right={<InfoButton title="How ranking works"><p>You get one point for each cart you clear for someone else, once their order is delivered.</p><p>Clearing your own cart doesn't count, and paying for the same person more than once counts once. Only the top 50 are shown.</p></InfoButton>} />
      <div className="max-w-2xl mx-auto p-3 space-y-2">
        {isAuthenticated && stats && (
          <section className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-gray-500">Your carts cleared</p>
                <p className="text-[22px] font-bold leading-tight">{stats.counted}</p>
                {stats.paid > stats.counted && <p className="text-[11px] text-gray-500">+{stats.paid - stats.counted} counting once delivered</p>}
              </div>
              {stats.paid > 0 ? (
                <button type="button" onClick={() => setEditing((e) => !e)} className="h-9 px-3 rounded-lg border border-gray-900 text-[12px] font-semibold">{stats.profile ? 'Edit profile' : 'Add your socials'}</button>
              ) : (
                <Link to="/help-pay" className="h-9 px-3 rounded-lg bg-gray-900 text-white text-[12px] font-semibold inline-flex items-center">Clear a cart</Link>
              )}
            </div>
            {editing && <ProfileForm initial={stats.profile} onSaved={() => { setEditing(false); load(); }} />}
          </section>
        )}
        {!isAuthenticated && (
          <Link to={`/customer/login?return=${encodeURIComponent('/help-pay/leaderboard')}`} className="block bg-white rounded-xl p-4 text-[12px] text-gray-600">
            <span className="font-semibold text-gray-900">Sign in</span> to see your rank and add your social links after clearing a cart.
          </Link>
        )}

        <section className="bg-white rounded-xl overflow-hidden" aria-label="Top 50">
          {!rows && <div className="h-40 animate-pulse" />}
          {rows && rows.length === 0 && (
            <div className="px-6 py-12 text-center">
              <Crown className="w-10 h-10 mx-auto text-gray-300" aria-hidden />
              <p className="mt-3 text-[14px] font-semibold">No Cart Clearers yet</p>
              <p className="mt-1 text-[12px] text-gray-500">Clear someone's cart on Help Pay to take the top spot.</p>
              <Link to="/help-pay" className="mt-4 inline-flex h-9 px-4 items-center rounded-lg bg-gray-900 text-white text-[12px] font-semibold">Browse carts</Link>
            </div>
          )}
          <ol>
            {(rows ?? []).map((r) => (
              <li key={r.rank} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${r.is_me ? 'bg-[#FFF6EE]' : ''}`}>
                <span className="w-7 text-center text-[14px] font-bold text-gray-500">{medal(r.rank) ?? r.rank}</span>
                <span className="w-9 h-9 rounded-full bg-gray-900 text-white text-[13px] font-bold flex items-center justify-center shrink-0" aria-hidden>{r.display_name.charAt(0).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{r.display_name}{r.is_me && <span className="ml-1.5 text-[11px] text-[#E8590C]">You</span>}</p>
                  <div className="flex items-center gap-2 text-gray-500">
                    {r.instagram && <a href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${r.display_name} on Instagram`} className="hover:text-gray-900"><Instagram className="w-3.5 h-3.5" /></a>}
                    {r.tiktok && <a href={`https://www.tiktok.com/@${r.tiktok}`} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${r.display_name} on TikTok`} className="hover:text-gray-900"><Music2 className="w-3.5 h-3.5" /></a>}
                    {r.x_handle && <a href={`https://x.com/${r.x_handle}`} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${r.display_name} on X`} className="hover:text-gray-900"><Twitter className="w-3.5 h-3.5" /></a>}
                    <span className="text-[11px]">Cart Clearer</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold leading-none">{r.carts_cleared}</p>
                  <p className="text-[10px] text-gray-500">cleared</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <BottomNav />
    </div>
  );
}

function ProfileForm({ initial, onSaved }: { initial: Stats['profile']; onSaved: () => void }) {
  const { customer } = useCustomerAuthStore();
  const [name, setName] = useState(initial?.display_name ?? customer?.full_name?.split(' ')[0] ?? '');
  const [ig, setIg] = useState(initial?.instagram ?? '');
  const [tt, setTt] = useState(initial?.tiktok ?? '');
  const [x, setX] = useState(initial?.x_handle ?? '');
  const [show, setShow] = useState(initial?.show_on_board ?? true);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc('save_cart_clearer_profile', { p_display_name: name, p_instagram: ig, p_tiktok: tt, p_x: x, p_show: show });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Profile saved');
    onSaved();
  };
  return (
    <form onSubmit={save} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <Field id="dn" label="Name on the board" value={name} onChange={setName} />
      <div className="grid grid-cols-3 gap-2">
        <Field id="ig" label="Instagram" optional value={ig} onChange={setIg} placeholder="@handle" />
        <Field id="tt" label="TikTok" optional value={tt} onChange={setTt} placeholder="@handle" />
        <Field id="xx" label="X" optional value={x} onChange={setX} placeholder="@handle" />
      </div>
      <label className="flex items-center gap-2 text-[12px] text-gray-700">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="w-4 h-4 accent-gray-900" /> Show me on the public board
      </label>
      <p className="flex items-start gap-1.5 text-[11px] text-gray-500"><ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />Only your board name and handles are public. Never your email, phone or what you bought.</p>
      <button type="submit" disabled={busy} className="h-10 px-5 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}

export function ClaimClearPage() {
  useForceLightMode();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ref = params.get('ref') ?? '';
  const { isAuthenticated } = useCustomerAuthStore();
  const [msg, setMsg] = useState('Adding this clear to your account…');
  useEffect(() => {
    if (!isAuthenticated || !ref) return;
    let alive = true;
    supabase.rpc('claim_cart_clear', { p_reference: ref }).then(({ data, error }) => {
      if (!alive) return;
      if (error) return setMsg(error.message);
      if (data?.claimed === false) return setMsg('This clear already belongs to another account.');
      toast.success('Clear added to your account');
      navigate('/help-pay/leaderboard', { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [isAuthenticated, ref, navigate]);
  if (!isAuthenticated) return <Navigate to={`/customer/signup?return=${encodeURIComponent(`/help-pay/claim?ref=${ref}`)}`} replace />;
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <Crown className="w-10 h-10 text-[#D4A017]" aria-hidden />
      <p className="mt-3 text-[14px]">{msg}</p>
      <Link to="/help-pay/leaderboard" className="mt-5 text-[13px] underline">Go to Cart Clearers</Link>
    </div>
  );
}
