import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, Menu, X, PackageCheck, CheckCircle2, Boxes,
  LogOut, Shield, ChevronLeft, User, Loader, Settings, Tags, ReceiptText, MessageSquare,
  Truck, MessageCircle, UserCog, ClipboardList, RotateCcw, WalletCards, CreditCard, Mail, Megaphone, CircleHelp, Users, TrendingUp, Ticket,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementManager, logoutManagementSession, validateManagementSession, getManagementToken, type ManagementManager } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';
import { AiSupportAlertMonitor } from '@/pages/import-admin/AiSupportInbox';

const PERMISSION_LABELS: Record<string, string> = {
  'import.analytics.view': 'View Analytics', 'import.total_orders.view': 'View Total Orders', 'import.orders.view': 'View Orders',
  'import.confirmed_payments.view': 'View Confirmed Payments', 'import.paystack_transactions.view': 'View Paystack Transactions',
  'import.timed_out.view': 'View Timed Out Orders', 'import.refunds.view': 'View Refunds', 'import.custom_orders.view': 'View Custom Orders',
  'import.inventory.view': 'View Inventory', 'import.inventory.add': 'Add Inventory Stock', 'import.inventory.subtract': 'Subtract Inventory Stock',
  'import.products.view': 'View Products', 'import.products.create': 'Create Products', 'import.products.update': 'Update Products',
  'import.reviews.view': 'View Reviews', 'import.categories.view': 'View Categories', 'import.trending.view': 'View Trending',
  'import.clients.view': 'View Clients', 'import.messages.view': 'View Messages', 'import.messages.send': 'Send Messages',
  'import.tickets.view': 'View Support Tickets', 'import.tickets.manage': 'Manage Support Tickets', 'import.questions.view': 'View Questions', 'import.broadcast.send': 'Send Broadcasts',
  'import.expenses.view': 'View Expenses', 'import.pricing_shipping.view': 'View Pricing & Shipping', 'import.promotions.view': 'View China Import Promotions', 'import.promotions.manage': 'Manage China Import Promotions', 'import.settings.view': 'View Settings',
  'import.admin_access.view': 'View Admin Access',
};

const NAV = [
  { section: 'Overview', items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/import-admin-v2', permission: 'import.analytics.view' }] },
  { section: 'Orders & Payments', items: [
    { icon: ShoppingCart, label: 'Orders', path: '/import-admin-v2/orders', permission: 'import.total_orders.view' },
    { icon: ClipboardList, label: 'Batch Orders', path: '/import-admin-v2/batch-orders', permission: 'import.orders.view' },
    { icon: CheckCircle2, label: 'Confirmed Payments', path: '/import-admin-v2/confirmed-payments', permission: 'import.confirmed_payments.view' },
    { icon: CreditCard, label: 'Payment Transactions', path: '/import-admin-v2/payment-transactions', permission: 'import.paystack_transactions.view' },
    { icon: WalletCards, label: 'Payment Recovery', path: '/import-admin-v2/payment-recovery', permission: 'import.timed_out.view' },
    { icon: RotateCcw, label: 'Refunds', path: '/import-admin-v2/refunds', permission: 'import.refunds.view' },
    { icon: ClipboardList, label: 'Custom Orders', path: '/import-admin-v2/custom-orders', permission: 'import.custom_orders.view' },
  ] },
  { section: 'Fulfillment', items: [
    { icon: PackageCheck, label: 'Fulfillment', path: '/import-admin-v2/fulfillment', permission: 'import.orders.view' },
    { icon: Boxes, label: 'Inventory', path: '/import-admin-v2/inventory', permission: 'import.inventory.view' },
  ] },
  { section: 'Products', items: [
    { icon: Package, label: 'Products', path: '/import-admin-v2/products', permission: 'import.products.view' },
    { icon: Tags, label: 'Categories', path: '/import-admin-v2/categories', permission: 'import.categories.view' },
    { icon: TrendingUp, label: 'Trending', path: '/import-admin-v2/trending', permission: 'import.trending.view' },
    { icon: MessageSquare, label: 'Reviews', path: '/import-admin-v2/reviews', permission: 'import.reviews.view' },
  ] },
  { section: 'Customers & Support', items: [
    { icon: Users, label: 'Users', path: '/import-admin-v2/users', permission: 'import.clients.view' },
    { icon: MessageCircle, label: 'Support', path: '/import-admin-v2/support', permission: 'import.messages.view' },
    { icon: Ticket, label: 'Tickets', path: '/import-admin-v2/support?view=tickets', permission: 'import.tickets.view' },
    { icon: CircleHelp, label: 'Product FAQ', path: '/import-admin-v2/product-faq', permission: 'import.questions.view' },
  ] },
  { section: 'Communications', items: [
    { icon: Mail, label: 'Email Templates', path: '/import-admin-v2/email-templates', permission: 'import.messages.view' },
    { icon: Megaphone, label: 'Broadcast', path: '/import-admin-v2/broadcast', permission: 'import.broadcast.send' },
  ] },
  { section: 'Finance & Administration', items: [
    { icon: ReceiptText, label: 'Expenses', path: '/import-admin-v2/expenses', permission: 'import.expenses.view' },
    { icon: Truck, label: 'Pricing & Shipping', path: '/import-admin-v2/pricing-shipping', permission: 'import.pricing_shipping.view' },
    { icon: Ticket, label: 'Promotions', path: '/import-admin-v2/pricing-shipping?view=promotions', permission: 'import.promotions.view' },
    { icon: Settings, label: 'Settings', path: '/import-admin-v2/settings', permission: 'import.settings.view' },
    { icon: UserCog, label: 'Admin Access', path: '/import-admin-v2/admin-access', permission: 'import.admin_access.view' },
  ] },
];

export default function ManagementLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [manager, setManager] = useState<ManagementManager | null>(getManagementManager());
  const managementToken = getManagementToken();
  const { permissions, hasPermission, loading: permissionsLoading, error: permissionsError } = useImportAdminPermissions(managementToken);

  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (permissionsLoading || !managementToken) return;
    const canViewTickets = permissions.has('import.tickets.view') || permissions.has('import.messages.view');
    if (!canViewTickets) {
      setTicketCount(null);
      return;
    }

    let cancelled = false;
    const loadTicketCount = async () => {
      try {
        const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/import-support-tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'count_tickets', manager_token: managementToken }),
        });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setTicketCount(Number(data.count || 0));
      } catch {
        // The badge is optional; never block the management layout when it cannot refresh.
      }
    };

    void loadTicketCount();
    const interval = window.setInterval(loadTicketCount, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [managementToken, permissions, permissionsLoading]);

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      const activeManager = validateManagementSession();
      if (cancelled) return;
      if (!activeManager) { navigate('/import-admin-v2/login', { replace: true }); return; }
      setManager(activeManager);
      setCheckingSession(false);
    };
    void checkSession();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleLogout = () => navigate('/import-admin-v2/logout');
  const isActive = (path: string) => {
    const [pathname, search] = path.split('?');
    if (search) return location.pathname === pathname && location.search === `?${search}`;
    // The dashboard is the parent route of every management page, so it must
    // only match exactly. Otherwise /orders, /products, etc. incorrectly
    // resolve to the dashboard item and require import.analytics.view.
    if (pathname === '/import-admin-v2') return location.pathname === pathname;
    if (pathname === '/import-admin-v2/support') return location.pathname === pathname && location.search !== '?view=tickets';
    if (pathname === '/import-admin-v2/pricing-shipping') return location.pathname === pathname && location.search !== '?view=promotions';
    return location.pathname === pathname || location.pathname.startsWith(pathname + '/');
  };
  const activeItem = NAV.flatMap(section => section.items).find(n => isActive(n.path));
  const activeLabel = activeItem?.label || 'Dashboard';
  const managerName = manager?.full_name || manager?.name || 'Manager';
  const requiredPermission = location.pathname === '/import-admin-v2/products/add'
    ? 'import.products.create'
    : location.pathname.startsWith('/import-admin-v2/products/edit/')
      ? 'import.products.update'
      : activeItem?.permission;
  const isDashboardRoute = location.pathname === '/import-admin-v2';
  const canViewCurrentRoute = isDashboardRoute ? permissions.size > 0 : !requiredPermission || hasPermission(requiredPermission);
  const requiredPermissionLabel = requiredPermission ? (PERMISSION_LABELS[requiredPermission] ?? requiredPermission) : 'access to this section';

  if (checkingSession) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader className="w-5 h-5 text-orange-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AiSupportAlertMonitor token={managementToken || ''} enabled={hasPermission('import.messages.view')} />
      <AnimatePresence>
        {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      </AnimatePresence>
      <aside className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 bg-white text-gray-900 flex flex-col h-screen transition-all duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'w-0 lg:w-[68px]' : 'w-[260px]'}`}>
        <div className={`px-4 py-4 border-b border-gray-200 flex items-center flex-shrink-0 ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
          {!collapsed && <Link to="/import-admin-v2" className="flex items-center gap-3"><img src="/qafrica-bag-logo.svg" alt="QAFRICA" className="w-9 h-9 rounded-xl object-cover" /><div><span className="text-sm font-bold leading-none">QAFRICA</span><p className="text-[10px] text-gray-500 leading-none mt-0.5">Management</p></div></Link>}
          {collapsed && <img src="/qafrica-bag-logo.svg" alt="QAFRICA" className="hidden lg:block w-9 h-9 rounded-xl object-cover" />}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto min-h-0">
          {NAV.map(section => ({
            ...section,
            items: section.items.filter(item => {
              if (permissionsLoading) return false;
              if (item.permission === 'import.tickets.view') return hasPermission('import.tickets.view') || hasPermission('import.messages.view');
              return item.path === '/import-admin-v2' ? permissions.size > 0 : hasPermission(item.permission);
            }),
          })).filter(section => section.items.length > 0).map(section => (
            <div key={section.section} className="mb-3">
              {!collapsed && <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">{section.section}</p>}
              {section.items.map(item => {
                const active = isActive(item.path);
                const showTicketBadge = item.path === '/import-admin-v2/support?view=tickets' && ticketCount !== null && ticketCount > 0;
                return <Link key={item.path} to={item.path} title={collapsed ? item.label : undefined} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${active ? 'bg-orange-500 text-white font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}><item.icon className="w-4 h-4 flex-shrink-0" />{!collapsed && <><span className="truncate flex-1">{item.label}</span>{showTicketBadge && <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'}`}>{ticketCount}</span>}</>}</Link>;
              })}
            </div>
          ))}
        </nav>
        <div className={`px-3 py-3 border-t border-gray-200 flex-shrink-0 ${collapsed ? 'lg:px-2' : ''}`}>
          {!collapsed && <div className="flex items-center gap-2.5 mb-2 px-1"><div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate leading-none">{managerName}</p><p className="text-[10px] text-gray-500 truncate mt-0.5">{manager?.email || ''}</p></div></div>}
          <button onClick={handleLogout} className={`flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:bg-gray-100 rounded-xl transition-colors text-sm ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}><LogOut className="w-4 h-4 flex-shrink-0" />{!collapsed && <span>Logout</span>}</button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-30"><div className="flex items-center justify-between h-14 px-4 lg:px-6"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"><Menu className="w-5 h-5" /></button><button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-2 hover:bg-gray-100 rounded-lg">{collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}</button><h1 className="text-sm font-semibold text-gray-900">{activeLabel}</h1></div><div className="text-xs text-gray-500">Management</div></div></header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {permissionsLoading ? <div className="min-h-[40vh] flex items-center justify-center"><Loader className="w-5 h-5 text-orange-500 animate-spin" /></div>
            : permissionsError ? <div className="bg-white rounded-2xl border border-red-100 p-8 text-center"><Shield className="w-8 h-8 mx-auto text-red-300" /><h2 className="mt-3 text-sm font-bold text-gray-900">Could not verify access</h2><p className="mt-1 text-xs text-gray-500">{permissionsError}</p></div>
            : !canViewCurrentRoute ? <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center"><Shield className="w-8 h-8 mx-auto text-gray-300" /><h2 className="mt-3 text-sm font-bold text-gray-900">Permission required</h2><p className="mt-1 text-xs text-gray-500">Your account does not have the required permission for this section. Ask an administrator to grant access if you need it.</p></div>
            : <AnimatePresence mode="wait"><motion.div key={location.pathname + location.search} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}><Outlet /></motion.div></AnimatePresence>}
        </main>
      </div>
    </div>
  );
}
