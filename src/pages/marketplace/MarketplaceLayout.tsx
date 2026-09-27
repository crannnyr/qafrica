import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, X } from 'lucide-react';
import BottomNav from '@/pages/shop/BottomNav';
import { useCustomerAuthStore } from '@/stores';
import { useForceLightMode } from '@/hooks/useForceLightMode';

type Props = {
  children: ReactNode;
  initialQuery?: string;
  /** Optional row under the search bar (category tabs) */
  subheader?: ReactNode;
};

export default function MarketplaceLayout({ children, initialQuery = '', subheader }: Props) {
  useForceLightMode();
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQuery);
  const { isAuthenticated } = useCustomerAuthStore();
  const meHref = isAuthenticated ? '/customer/wishlist' : `/customer/login?return=${encodeURIComponent('/customer/wishlist')}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/stores?q=${encodeURIComponent(term)}` : '/stores');
  };


  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900" style={{ fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="sticky top-0 z-40 bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2.5">
          <Link to="/stores" aria-label="QAFRICA marketplace home" className="shrink-0 flex items-center gap-1.5">
            <img src="/qafrica-bag-logo.svg" alt="" className="w-7 h-7" />
            <span className="hidden sm:inline font-black tracking-tight text-lg">QAFRICA</span>
          </Link>
          <form onSubmit={submit} role="search" className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              enterKeyHint="search"
              className="w-full h-10 pl-9 pr-9 rounded-full border-2 border-gray-900 bg-white text-[15px] placeholder:text-gray-400 focus:outline-none focus:border-orange-500"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  navigate('/stores');
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
          <Link to={meHref} aria-label="Wishlist" className="shrink-0 p-1.5 rounded-full hover:bg-gray-100">
            <Heart className="w-6 h-6" strokeWidth={1.75} />
          </Link>
        </div>
        {subheader}
      </header>

      <main className="max-w-6xl mx-auto pb-24">{children}</main>

      <BottomNav />
    </div>
  );
}
