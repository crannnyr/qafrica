import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Store, Package, ShoppingCart,
  CreditCard, Crown, LogOut, Menu, X, Shield, Globe,
  ChevronLeft, User, Bell, FileText, Truck, ShoppingBag,
  Mail, AlertTriangle, Wallet,
} from 'lucide-react';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',         path: '/admin' },
  { icon: Users,           label: 'Users',             path: '/admin/users' },
  { icon: Store,           label: 'Stores',            path: '/admin/stores' },
  { icon: Package,         label: 'Products',          path: '/admin/products' },
  { icon: ShoppingCart,    label: 'Orders',            path: '/admin/orders' },
  { icon: CreditCard,      label: 'Withdrawals',       path: '/admin/withdrawals' },
  { icon: AlertTriangle,   label: 'Failures',          path: '/admin/failures' },
  { icon: Crown,           label: 'Subscriptions',     path: '/admin/subscriptions' },
  { icon: Globe,           label: 'Domain Requests',   path: '/admin/domain-requests', badge: true },
  { icon: Mail,            label: 'Email Controls',    path: '/admin/email-controls' },
  { icon: Bell,            label: 'Notifications',     path: '/admin/notifications' },
  { icon: FileText,        label: 'Legal Docs',        path: '/admin/legal' },
  { icon: Truck,           label: 'Shipbubble',        path: '/admin/shipbubble' },
  { icon: ShoppingBag,     label: 'Jumia',             path: '/admin/jumia' },
{ icon: ShoppingBag, label: 'Jumia Settings', path: '/admin/jumia-settings' },
  { icon: Wallet,          label: 'Jumia Payouts',     path: '/admin/jumia-withdrawals' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();

  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/admin'
      ? location.pathname === '/admin'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const activeLabel = NAV.find(n => isActive(n.path))?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
        bg-gray-900 text-white flex flex-col h-screen
        transition-all duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${collapsed ? 'w-0 lg:w-[68px]' : 'w-[260px]'}
      `}>

        {/* Logo */}
        <div className={`
          px-4 py-4 border-b border-gray-800 flex items-center flex-shrink-0
          ${collapsed ? 'lg:justify-center' : 'justify-between'}
        `}>
          {!collapsed && (
            <Link to="/admin" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold leading-none">QAFRICA</span>
                <p className="text-[10px] text-gray-400 leading-none mt-0.5">Admin Panel</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <div className="hidden lg:flex w-9 h-9 bg-orange-500 rounded-xl items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 hover:bg-gray-800 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto min-h-0">
          {NAV.map(item => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm
                  ${active ? 'bg-orange-500 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                  ${collapsed ? 'lg:justify-center lg:px-2' : ''}
                `}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className={`px-3 py-3 border-t border-gray-800 flex-shrink-0 ${collapsed ? 'lg:px-2' : ''}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-none">{user?.full_name}</p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{user?.email}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="hidden lg:flex justify-center mb-2">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Logout"
            className={`
              flex items-center gap-2 w-full px-3 py-2 text-red-400
              hover:bg-gray-800 rounded-xl transition-colors text-sm
              ${collapsed ? 'lg:justify-center lg:px-2' : ''}
            `}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-30">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <button onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex p-2 hover:bg-gray-100 rounded-lg transition-colors">
                {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <h1 className="text-sm font-semibold text-gray-900">{activeLabel}</h1>
            </div>
            <Link to="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Store className="w-3.5 h-3.5" />
              Seller Dashboard
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
