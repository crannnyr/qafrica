// src/pages/dashboard/Layout/Sidebar.tsx

import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, X } from 'lucide-react';
import NavGroup from './NavGroup';
import SidebarStoreCard from './SidebarStoreCard';
import SidebarSubscriptionCard from './SidebarSubscriptionCard';
import SidebarUserFooter from './SidebarUserFooter';
import type { NavItem, MarketplaceBrand } from './constants';

interface Store_ {
  name: string;
  slug: string;
  custom_domain?: string;
  domain_status?: string;
  logo_url?: string;
}

interface User {
  full_name?: string;
  email?: string;
  role?: string;
}

interface DomainRequest {
  admin_approved: boolean;
  status: string;
  domain_name: string;
}

interface Props {
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  visibleItems: NavItem[];
  currentStore: Store_ | null;
  user: User | null;
  isStaff: boolean;
  subscription: { tier: string; daysLeft: number } | null;
  domainRequest: DomainRequest | null;
  isActive: (path: string) => boolean;
  getStoreUrl: () => string;
  getStoreDisplayUrl: () => string;
  isDomainPending: () => boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  onComingSoon: (brand: MarketplaceBrand) => void;
}

export default function Sidebar({
  isSidebarOpen,
  isMobileMenuOpen,
  visibleItems,
  currentStore,
  user,
  isStaff,
  subscription,
  domainRequest,
  isActive,
  getStoreUrl,
  getStoreDisplayUrl,
  isDomainPending,
  onCloseMobile,
  onLogout,
  onComingSoon,
}: Props) {
  return (
    <aside
      className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        flex flex-col h-screen transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarOpen ? 'w-[260px]' : 'w-0 lg:w-[68px]'}`}
    >
      {/* ── Logo ── */}
      <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0 ${
        !isSidebarOpen ? 'lg:justify-center' : ''
      }`}>
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 ${!isSidebarOpen ? 'lg:hidden' : ''}`}
        >
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <span className="text-base font-bold text-gray-900 dark:text-white leading-none">
              QAFRICA
            </span>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Seller Dashboard
            </p>
          </div>
        </Link>

        {/* Collapsed logo */}
        {!isSidebarOpen && (
          <div className="hidden lg:flex items-center justify-center">
            <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {/* Mobile close */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* ── Store card ── */}
      {currentStore && isSidebarOpen && (
        <SidebarStoreCard
          currentStore={currentStore}
          storeUrl={getStoreUrl()}
          storeDisplayUrl={getStoreDisplayUrl()}
          isDomainPending={isDomainPending()}
          domainRequest={domainRequest}
        />
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto min-h-0">
        {visibleItems.map((item) => (
          <NavGroup
            key={item.path}
            item={item}
            isActive={isActive}
            isSidebarOpen={isSidebarOpen}
            onNavigate={onCloseMobile}
            onComingSoon={onComingSoon}
          />
        ))}
      </nav>

      {/* ── Subscription card ── */}
      <SidebarSubscriptionCard
        isSidebarOpen={isSidebarOpen}
        subscription={subscription}
      />

      {/* ── User footer ── */}
      <SidebarUserFooter
        user={user}
        currentStore={currentStore}
        isSidebarOpen={isSidebarOpen}
        isStaff={isStaff}
        onLogout={onLogout}
      />
    </aside>
  );
}