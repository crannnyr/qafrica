import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, MapPin, Heart, User, ShoppingCart, Store } from 'lucide-react';
import { useCustomerAuthStore, useCartStore } from '@/stores';
import OrdersTab from './OrdersTab';
import AddressesTab from './AddressesTab';
import WishlistTab from './WishlistTab';
import ProfileTab from './ProfileTab';

type Tab = 'orders' | 'addresses' | 'wishlist' | 'profile';

const TABS = [
  { key: 'orders',    label: 'Orders',    icon: Package },
  { key: 'addresses', label: 'Addresses', icon: MapPin   },
  { key: 'wishlist',  label: 'Wishlist',  icon: Heart    },
  { key: 'profile',   label: 'Profile',   icon: User     },
] as const;

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  orders:    { title: 'Orders',    subtitle: 'Track and manage your purchases' },
  addresses: { title: 'Addresses', subtitle: 'Manage delivery locations' },
  wishlist:  { title: 'Wishlist',  subtitle: "Items you've saved for later" },
  profile:   { title: 'Profile',   subtitle: 'Update your personal information' },
};

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const { getItemCount } = useCartStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate('/customer/login?return=/customer/dashboard');
  }, [isAuthenticated, navigate]);

  if (!customer) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/stores" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">Q</span>
            </div>
            <span className="font-bold text-gray-900 tracking-tight">QAFRICA</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/stores"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Store className="w-4 h-4" />
            </Link>
            <Link to="/cart"
              className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ShoppingCart className="w-4 h-4" />
              {getItemCount() > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {getItemCount()}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 lg:pb-6">
        <div className="grid lg:grid-cols-4 gap-5">

          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-20">
              {/* User info */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200 flex-shrink-0">
                  {customer.avatar_url ? (
                    <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-orange-600">
                      {customer.full_name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="font-semibold text-gray-900 text-sm truncate">{customer.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{customer.email}</p>
                </div>
              </div>
              {/* Nav */}
              <nav className="space-y-0.5">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm font-medium ${
                      activeTab === key
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-3">
            {/* Mobile: user greeting */}
            <div className="lg:hidden flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200 flex-shrink-0 ring-2 ring-orange-200">
                {customer.avatar_url ? (
                  <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-orange-600">
                    {customer.full_name?.charAt(0) ?? '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Hey, {customer.full_name?.split(' ')[0]} 👋</p>
                <p className="text-xs text-gray-400">{customer.email}</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="bg-white rounded-xl border border-gray-100 p-5 lg:p-6">
                <div className="mb-5">
                  <h1 className="text-base font-bold text-gray-900">{TAB_META[activeTab].title}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">{TAB_META[activeTab].subtitle}</p>
                </div>
                {activeTab === 'orders'    && <OrdersTab />}
                {activeTab === 'addresses' && <AddressesTab />}
                {activeTab === 'wishlist'  && <WishlistTab />}
                {activeTab === 'profile'   && <ProfileTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-5">
        <div className="bg-white/90 backdrop-blur-xl border border-gray-200/80 rounded-2xl shadow-xl shadow-black/10 px-2 py-2">
          <div className="flex items-center justify-around">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all">
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-orange-500 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={`relative w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span className={`relative text-[10px] font-medium transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}