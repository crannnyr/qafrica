// src/pages/dashboard/Layout/DashboardHeader.tsx

import { Link } from 'react-router-dom';
import { Menu, ChevronLeft, Store, ChevronDown } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import ProfileDropdown from './ProfileDropdown';
import type { StockAlert } from '@/types';

interface Store_ {
  id?: string;
  name?: string;
  logo_url?: string;
  slug?: string;
  custom_domain?: string;
  domain_status?: string;
}

interface User {
  full_name?: string;
  email?: string;
}

interface Props {
  user: User | null;
  currentStore: Store_ | null;
  stores: Store_[];
  currentLabel: string;
  isSidebarOpen: boolean;
  stockAlerts: StockAlert[];
  showNotifications: boolean;
  showProfileMenu: boolean;
  storeUrl: string;
  onToggleSidebar: () => void;
  onOpenMobileMenu: () => void;
  onToggleNotifications: () => void;
  onToggleProfileMenu: () => void;
  onMarkAlertRead: (id: string) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
  onStoreSwitch: (storeId: string) => void;
}

export default function DashboardHeader({
  user,
  currentStore,
  stores,
  currentLabel,
  isSidebarOpen,
  stockAlerts,
  showNotifications,
  showProfileMenu,
  storeUrl,
  onToggleSidebar,
  onOpenMobileMenu,
  onToggleNotifications,
  onToggleProfileMenu,
  onMarkAlertRead,
  onMarkAllRead,
  onLogout,
  onStoreSwitch,
}: Props) {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-30">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">

        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-white" />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {isSidebarOpen
              ? <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              : <Menu className="w-4 h-4 text-gray-600 dark:text-white" />
            }
          </button>

          <h1 className="text-base font-semibold text-gray-900 dark:text-white hidden sm:block">
            {currentLabel}
          </h1>

          {/* Store switcher — only visible when user has more than 1 store */}
          {stores.length > 1 && (
            <div className="relative hidden sm:flex items-center">
              <Store className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={currentStore?.id ?? ''}
                onChange={(e) => onStoreSwitch(e.target.value)}
                className="pl-7 pr-7 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg appearance-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.slug ?? s.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: notifications + profile + view store */}
        <div className="flex items-center gap-2">
          <NotificationDropdown
            stockAlerts={stockAlerts}
            isOpen={showNotifications}
            onToggle={onToggleNotifications}
            onMarkRead={onMarkAlertRead}
            onMarkAllRead={onMarkAllRead}
          />

          <ProfileDropdown
            user={user}
            currentStore={currentStore}
            isOpen={showProfileMenu}
            onToggle={onToggleProfileMenu}
            onLogout={onLogout}
          />

          {/* View Store */}
          {currentStore && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Store className="w-4 h-4" />
              View Store
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
