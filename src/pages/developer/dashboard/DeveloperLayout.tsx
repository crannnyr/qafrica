// src/pages/developer/dashboard/DeveloperLayout.tsx
import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Key, Package, Download, ShoppingBag,
  ClipboardList, Webhook, Wallet, CreditCard, Settings,
  BookOpen, LogOut, Menu, X, ChevronRight, Zap,
  AlertTriangle, Bell, ExternalLink,
} from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { toast } from 'sonner';

// ── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/developer/dashboard',              icon: LayoutDashboard },
  { label: 'API Keys',     path: '/developer/dashboard/api-keys',     icon: Key },
  { label: 'Catalog',      path: '/developer/dashboard/catalog',      icon: Package },
  { label: 'My Imports',   path: '/developer/dashboard/imports',      icon: Download },
  { label: 'My Products',  path: '/developer/dashboard/products',     icon: ShoppingBag },
  { label: 'Orders',       path: '/developer/dashboard/orders',       icon: ClipboardList },
  { label: 'Webhooks',     path: '/developer/dashboard/webhooks',     icon: Webhook },
  { label: 'Wallet',       path: '/developer/dashboard/wallet',       icon: Wallet },
  { label: 'Subscription', path: '/developer/dashboard/subscription', icon: CreditCard },
  { label: 'Docs',         path: '/developer/dashboard/docs',         icon: BookOpen },
  { label: 'Settings',     path: '/developer/dashboard/settings',     icon: Settings },
];

// ── Plan badge colours ────────────────────────────────────────
const PLAN_STYLES: Record<string, string> = {
  free:       'bg-gray-100 text-gray-600',
  starter:    'bg-orange-100 text-orange-700',
  growth:     'bg-blue-100 text-blue-700',
  scale:      'bg-purple-100 text-purple-700',
  enterprise: 'bg-gray-900 text-white',
};

export default function DeveloperLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { developer, isAuthenticated, isLoading, fetchProfile, logout } = useDeveloperAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/developer/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // ── Onboarding guard ─────────────────────────────────────────
  useEffect(() => {
    if (developer && !developer.onboarding_completed) {
      navigate('/developer/onboarding', { replace: true });
    }
  }, [developer, navigate]);

  // ── Fetch profile on mount ────────────────────────────────────
  useEffect(() => {
    fetchProfile();
  }, []);

  // ── Close sidebar on route change ────────────────────────────
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/developer/login', { replace: true });
    } catch {
      toast.error('Logout failed. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Trial warning ─────────────────────────────────────────────
  const daysLeft = developer?.plan_expires_at
    ? Math.ceil((new Date(developer.plan_expires_at).getTime() - Date.now()) / 86_400_000)
    : null;
  const showTrialWarning = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading developer portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !developer) return null;

  const planLabel = developer.plan.charAt(0).toUpperCase() + developer.plan.slice(1);
  const planStyle = PLAN_STYLES[developer.plan] ?? PLAN_STYLES.free;
  const displayName = developer.account_type === 'company'
    ? developer.company_name ?? developer.full_name
    : developer.full_name;

  // ── Sidebar content (shared between mobile + desktop) ────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">QAFRICA</p>
            <p className="text-xs text-gray-500 leading-tight">Developer Portal</p>
          </div>
        </div>
      </div>

      {/* Developer info */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-orange-600">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{developer.platform_name}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planStyle}`}>
            {planLabel}
          </span>
          {!developer.paystack_connected && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Paystack
            </span>
          )}
        </div>
      </div>

      {/* Trial expiry warning */}
      {showTrialWarning && (
        <div className="mx-3 mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="text-xs font-medium text-orange-800">
            {daysLeft === 0
              ? 'Your trial expires today!'
              : `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
          </p>
          <button
            onClick={() => navigate('/developer/dashboard/subscription')}
            className="text-xs text-orange-600 font-semibold mt-1 hover:underline"
          >
            Upgrade now →
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/developer/dashboard'
            ? location.pathname === '/developer/dashboard'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: navActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
              end={item.path === '/developer/dashboard'}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {item.label}
              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/70" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom: external links + logout */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-1">
        <a
          href="https://qafrica.store"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150"
        >
          <ExternalLink className="w-4 h-4 text-gray-400" />
          QAFRICA Store
        </a>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 z-50 lg:hidden flex flex-col"
            >
              {/* Close button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          {/* Page breadcrumb (desktop) */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-900">
              {NAV_ITEMS.find((n) =>
                n.path === '/developer/dashboard'
                  ? location.pathname === '/developer/dashboard'
                  : location.pathname.startsWith(n.path)
              )?.label ?? 'Dashboard'}
            </span>
          </div>

          {/* Right side: plan chip + paystack warning */}
          <div className="flex items-center gap-3">
            {!developer.paystack_connected && (
              <button
                onClick={() => navigate('/developer/onboarding')}
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full hover:bg-yellow-100 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Connect Paystack
              </button>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planStyle}`}>
              {planLabel}
            </span>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}