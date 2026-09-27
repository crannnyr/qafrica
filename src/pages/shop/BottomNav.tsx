// Shopper bottom menu: Shop · Category · Help Pay · Cart · Me
import { Link, NavLink } from 'react-router-dom';
import { Home, LayoutGrid, HandHeart, ShoppingBag, User } from 'lucide-react';
import { useCartStore, useCustomerAuthStore } from '@/stores';

export default function BottomNav() {
  const cartCount = useCartStore((s) => s.getTotalItems());
  const { isAuthenticated } = useCustomerAuthStore();
  const meHref = isAuthenticated ? '/customer/dashboard' : `/customer/login?return=${encodeURIComponent('/customer/dashboard')}`;
  const tab = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] focus-visible:outline-none focus-visible:bg-gray-50';
  const cls = ({ isActive }: { isActive: boolean }) => `${tab} ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'}`;
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-6xl mx-auto flex">
        <NavLink to="/stores" end className={cls}>
          {({ isActive }) => (<><Home className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.6} fill={isActive ? 'currentColor' : 'none'} />Shop</>)}
        </NavLink>
        <NavLink to="/stores/categories" className={cls}>
          {({ isActive }) => (<><LayoutGrid className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.6} />Category</>)}
        </NavLink>
        <NavLink to="/help-pay" className={cls}>
          {({ isActive }) => (<><HandHeart className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.6} />Help Pay</>)}
        </NavLink>
        <Link to="/cart" className={`${tab} text-gray-500`}>
          <span className="relative">
            <ShoppingBag className="w-[22px] h-[22px]" strokeWidth={1.6} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FA6338] text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </span>
          Cart
        </Link>
        <NavLink to={meHref} className={cls}>
          {({ isActive }) => (<><User className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.6} />Me</>)}
        </NavLink>
      </div>
    </nav>
  );
}
