// src/pages/dashboard/Layout/ProfileDropdown.tsx

import { Link } from 'react-router-dom';
import { Settings, Crown, Wallet, LogOut } from 'lucide-react';

interface Store {
  logo_url?: string;
}

interface User {
  full_name?: string;
  email?: string;
}

interface Props {
  user: User | null;
  currentStore: Store | null;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const PROFILE_LINKS = [
  { to: '/dashboard/settings',     Icon: Settings, label: 'Settings'     },
  { to: '/dashboard/subscription', Icon: Crown,    label: 'Subscription' },
  { to: '/dashboard/wallet',       Icon: Wallet,   label: 'Wallet'       },
];

export default function ProfileDropdown({
  user,
  currentStore,
  isOpen,
  onToggle,
  onLogout,
}: Props) {
  return (
    <div className="relative">
      {/* Avatar button */}
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center
          focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2
          transition-opacity hover:opacity-90"
      >
        {currentStore?.logo_url ? (
          <img
            src={currentStore.logo_url}
            alt="Store logo"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-orange-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onToggle}
          />
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            {/* User info */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                {user?.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>

            {/* Links */}
            <div className="py-1">
              {PROFILE_LINKS.map(({ to, Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={onToggle}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  {label}
                </Link>
              ))}

              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

              <button
                onClick={() => { onToggle(); onLogout(); }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}