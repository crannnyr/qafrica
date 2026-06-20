// src/pages/dashboard/Layout/SidebarUserFooter.tsx

import { LogOut, Shield } from 'lucide-react';

interface Store {
  logo_url?: string;
}

interface User {
  full_name?: string;
  email?: string;
  role?: string;
}

interface Props {
  user: User | null;
  currentStore: Store | null;
  isSidebarOpen: boolean;
  isStaff: boolean;
  onLogout: () => void;
}

export default function SidebarUserFooter({
  user,
  currentStore,
  isSidebarOpen,
  isStaff,
  onLogout,
}: Props) {
  const Avatar = () => (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700">
      {currentStore?.logo_url ? (
        <img
          src={currentStore.logo_url}
          alt="Store logo"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs font-bold text-gray-500 dark:text-gray-300">
          {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
        </span>
      )}
    </div>
  );

  return (
    <div className={`px-2 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 ${
      !isSidebarOpen ? 'lg:px-2' : ''
    }`}>
      {/* Expanded: name + email */}
      {isSidebarOpen && (
        <div className="flex items-center gap-3 px-2 mb-2">
          <Avatar />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {user?.full_name}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      )}

      {/* Staff badge */}
      {isStaff && isSidebarOpen && (
        <div className="flex items-center gap-1.5 px-2 mb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 rounded-full">
            <Shield className="w-3 h-3 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-medium text-violet-700 dark:text-violet-400">
              Staff Account
            </span>
          </div>
        </div>
      )}

      {/* Collapsed: avatar only */}
      {!isSidebarOpen && (
        <div className="hidden lg:flex justify-center mb-2">
          <Avatar />
        </div>
      )}

      {/* Logout */}
      <button
        onClick={onLogout}
        className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600
          hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors
          ${!isSidebarOpen ? 'lg:justify-center lg:px-2' : ''}`}
        title={!isSidebarOpen ? 'Logout' : undefined}
      >
        <LogOut className="w-4 h-4 flex-shrink-0" />
        {isSidebarOpen && <span>Logout</span>}
      </button>
    </div>
  );
}