import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Heart, Home, LayoutGrid, ShoppingBag, User, X } from 'lucide-react';
import { useCartStore, useCustomerAuthStore } from '@/stores';
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
  const cartCount = useCartStore((s) => s.getTotalItems());
  const { isAuthenticated } = useCustomerAuthStore();
  const meHref = isAuthenticated ? '/customer/dashboard' : `/customer/login?return=${encodeURIComponent('/stores')}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/stores?q=${encodeURIComponent(term)}` : '/stores');
  };

  const tab = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] focus-visible:outline-none focus-visible:bg-gray-50';

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

      <nav
        aria-label="Marketplace"
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-6xl mx-auto flex">
          <NavLink to="/stores" end className={({ isActive }) => `${tab} ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
            {({ isActive }) => (
              <>
                <Home className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} fill={isActive ? 'currentColor' : 'none'} />
                Shop
              </>
            )}
          </NavLink>
          <NavLink to="/stores/categories" className={({ isActive }) => `${tab} ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
            {({ isActive }) => (
              <>
                <LayoutGrid className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} />
                Category
              </>
            )}
          </NavLink>
          <Link to="/cart" className={`${tab} text-gray-500`}>
            <span className="relative">
              <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FA6338] text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            Cart
          </Link>
          <Link to={meHref} className={`${tab} text-gray-500`}>
            <User className="w-6 h-6" strokeWidth={1.75} />
            Me
          </Link>
        </div>
      </nav>
    </div>
  );
}
