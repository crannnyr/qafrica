import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, Menu, X, PackageCheck,
  LogOut, Shield, ChevronLeft, User, Loader, Settings, Tags, ReceiptText, Truck, MessageCircle, UserCog,
} from 'lucide-react';
import { getManagementManager, logoutManagementSession, validateManagementSession, getManagementToken, type ManagementManager } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';
import { AiSupportAlertMonitor } from '@/pages/import-admin/AiSupportInbox';

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/import-admin-v2' },
  { icon: Package, label: 'Products', path: '/import-admin-v2/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/import-admin-v2/orders' },
  { icon: Tags, label: 'Categories', path: '/import-admin-v2/categories' },
  { icon: ReceiptText, label: 'Expenses', path: '/import-admin-v2/expenses' },
  { icon: Settings, label: 'Settings', path: '/import-admin-v2/settings' },
  { icon: Truck, label: 'Pricing & Shipping', path: '/import-admin-v2/pricing-shipping' },
  { icon: PackageCheck, label: 'Fulfillment', path: '/import-admin-v2/fulfillment' },
  { icon: MessageCircle, label: 'Support', path: '/import-admin-v2/support' },
  { icon: UserCog, label: 'Admin Access', path: '/import-admin-v2/admin-access' },
];

export default function ManagementLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [manager, setManager] = useState<ManagementManager | null>(getManagementManager());
  const managementToken = getManagementToken();
  const { hasPermission } = useImportAdminPermissions(managementToken);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const activeManager = validateManagementSession();
      if (cancelled) return;

      if (!activeManager) {
        navigate('/import-admin-v2/login', { replace: true });
        return;
      }

      setManager(activeManager);
      setCheckingSession(false);
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogout = () => {
    navigate('/import-admin-v2/logout');
  };

  const isActive = (path: string) =>
    path === '/import-admin-v2'
      ? location.pathname === '/import-admin-v2'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const activeLabel = NAV.find(n => isActive(n.path))?.label || 'Dashboard';
  const managerName = manager?.full_name || manager?.name || 'Manager';

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-5 h-5 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AiSupportAlertMonitor token={managementToken || ''} enabled={hasPermission('import.messages.view')} />
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 bg-white text-gray-900 flex flex-col h-screen transition-all duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'w-0 lg:w-[68px]' : 'w-[260px]'}`}>
        <div className={`px-4 py-4 border-b border-gray-200 flex items-center flex-shrink-0 ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <Link to="/import-admin-v2" className="flex items-center gap-3">
              <img src="/qafrica-bag-logo.svg" alt="QAFRICA" className="w-9 h-9 rounded-xl object-cover" />
              <div>
                <span className="text-sm font-bold leading-none">QAFRICA</span>
                <p className="text-[10px] text-gray-500 leading-none mt-0.5">Management</p>
              </div>
            </Link>
          )}
          {collapsed && <img src="/qafrica-bag-logo.svg" alt="QAFRICA" className="hidden lg:block w-9 h-9 rounded-xl object-cover" />}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto min-h-0">
          {NAV.map(item => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${active ? 'bg-orange-500 text-white font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`px-3 py-3 border-t border-gray-200 flex-shrink-0 ${collapsed ? 'lg:px-2' : ''}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-none">{managerName}</p>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{manager?.email || ''}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className={`flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:bg-gray-100 rounded-xl transition-colors text-sm ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-30">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"><Menu className="w-5 h-5" /></button>
              <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-2 hover:bg-gray-100 rounded-lg">
                {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <h1 className="text-sm font-semibold text-gray-900">{activeLabel}</h1>
            </div>
            <div className="text-xs text-gray-500">Management</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
