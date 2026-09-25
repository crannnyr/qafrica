// Small account pages. Wishlist / addresses / settings reuse the existing, working components.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Copy, Check, HandHeart, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import WishlistTab from '@/pages/customer/CustomerDashboard/WishlistTab';
import AddressesTab from '@/pages/customer/CustomerDashboard/AddressesTab';
import ProfileTab from '@/pages/customer/CustomerDashboard/ProfileTab';
import { InfoButton, PageHeader } from '../ui';
import { naira } from '../format';
import { shareUrl } from '../checkoutApi';

function Shell({ title, path, children }: { title: string; path: string; children: ReactNode }) {
  useForceLightMode();
  const { isAuthenticated } = useCustomerAuthStore();
  if (!isAuthenticated) return <Navigate to={`/customer/login?return=${encodeURIComponent(path)}`} replace />;
  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-10">
      <PageHeader title={title} back="/customer/dashboard" />
      <div className="max-w-2xl mx-auto p-3">{children}</div>
    </div>
  );
}

export const WishlistPage = () => <Shell title="Wishlist" path="/customer/wishlist"><div className="bg-white rounded-xl p-3"><WishlistTab /></div></Shell>;
export const AddressesPage = () => <Shell title="Addresses" path="/customer/addresses"><div className="bg-white rounded-xl p-3"><AddressesTab /></div></Shell>;
export const ProfilePage = () => <Shell title="Account settings" path="/customer/profile"><div className="bg-white rounded-xl p-3"><ProfileTab /></div></Shell>;

type MyLink = { code: string; status: string; is_public: boolean; amount: number | null; note: string | null; created_at: string; expires_at: string; preview_images: string[] | null };

export function MyLinksPage() {
  const [links, setLinks] = useState<MyLink[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase.rpc('my_shared_carts').then(({ data }) => setLinks((data as MyLink[]) ?? []));
  }, []);
  useEffect(() => {
    let alive = true;
    supabase.rpc('my_shared_carts').then(({ data }) => alive && setLinks((data as MyLink[]) ?? []));
    return () => {
      alive = false;
    };
  }, []);

  const togglePublic = async (l: MyLink) => {
    const { error } = await supabase.rpc('set_help_pay_public', { p_code: l.code, p_public: !l.is_public });
    if (error) return toast.error(error.message);
    toast.success(l.is_public ? 'Removed from Help Pay' : 'Posted on Help Pay');
    load();
  };
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <Shell title="Pay-for-me links" path="/customer/links">
      <p className="px-1 pb-2 text-[12px] text-gray-500 flex items-center gap-1">
        Links you've created. Post one on Help Pay so anyone can clear it.
        <InfoButton title="Help Pay">
          <p>Help Pay is a public board where people browse carts and choose one to pay for.</p>
          <p>Only your first name, city, items, total and note are shown. You can have up to 3 carts posted at a time.</p>
        </InfoButton>
      </p>
      {!links && <div className="h-24 bg-white rounded-xl animate-pulse" />}
      {links && links.length === 0 && (
        <div className="bg-white rounded-xl px-6 py-12 text-center">
          <Link2 className="w-9 h-9 mx-auto text-gray-300" aria-hidden />
          <p className="mt-3 text-[14px] font-semibold">No links yet</p>
          <p className="mt-1 text-[12px] text-gray-500">In your cart, tap "Ask someone to pay" to create one.</p>
          <Link to="/cart" className="mt-4 inline-flex h-9 px-4 items-center rounded-lg bg-gray-900 text-white text-[12px] font-semibold">Go to cart</Link>
        </div>
      )}
      <ul className="space-y-2">
        {(links ?? []).map((l) => (
          <li key={l.code} className="bg-white rounded-xl p-3">
            <div className="flex gap-2">
              {(l.preview_images ?? []).slice(0, 3).map((src, i) => <img key={i} src={src} alt="" className="w-12 h-12 rounded-md object-cover bg-gray-100" />)}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[14px] font-bold">{naira(l.amount)}</p>
                <p className={`text-[11px] ${l.status === 'paid' ? 'text-[#1A7F37] font-semibold' : 'text-gray-500'}`}>
                  {l.status === 'paid' ? 'Paid 🎉' : l.status === 'active' ? `Expires ${new Date(l.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` : 'Expired'}
                </p>
              </div>
            </div>
            {l.note && <p className="mt-2 text-[12px] text-gray-600 line-clamp-2">“{l.note}”</p>}
            {l.status === 'active' && (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => copy(l.code)} className="h-9 flex-1 rounded-lg border border-gray-300 text-[12px] font-semibold inline-flex items-center justify-center gap-1.5">
                  {copied === l.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied === l.code ? 'Copied' : 'Copy link'}
                </button>
                <button type="button" onClick={() => togglePublic(l)} className={`h-9 flex-1 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 ${l.is_public ? 'border border-gray-900' : 'bg-gray-900 text-white'}`}>
                  <HandHeart className="w-4 h-4" />{l.is_public ? 'Remove from Help Pay' : 'Post on Help Pay'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
