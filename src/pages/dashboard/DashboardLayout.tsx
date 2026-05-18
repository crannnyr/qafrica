import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Package, ShoppingCart, Wallet, MapPin, ChartBar as BarChart3, Settings, Store, LogOut, Menu, X, Import, Bell, User, Crown, Globe, ChevronLeft, TriangleAlert as AlertTriangle, Calculator, BookOpen, MessageSquare, Tag, Upload, Palette, Layers, Clock, CircleCheck as CheckCircle2, ChevronDown, ChevronRight, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useStoreStore } from '@/stores';
import { stockAlertService, supabase } from '@/services/supabase';
import { subscribeToOrders, subscribeToStockAlerts, subscribeToWalletUpdates } from '@/services/realtime';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import ModalNotificationDisplay from '@/components/ModalNotificationDisplay';
import { toast } from 'sonner';
import type { StockAlert } from '@/types';

// ── Sidebar structure ─────────────────────────────────────────────────────────

interface NavChild {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  children?: NavChild[];
}

const sidebarItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: Package,
    label: 'Products',
    path: '/dashboard/products',
    children: [
      { icon: Upload,  label: 'Bulk Import',     path: '/dashboard/products/bulk-import' },
      { icon: Import,  label: 'Import Catalog',  path: '/dashboard/import-catalog' },
    ],
  },
  {
    icon: ShoppingCart,
    label: 'Sales',
    path: '/dashboard/orders',
    children: [
      { icon: ShoppingCart, label: 'Orders',           path: '/dashboard/orders' },
      { icon: Truck,        label: 'Dropship Orders',  path: '/dashboard/dropship-orders' },
      { icon: MessageSquare, label: 'Reviews',         path: '/dashboard/reviews' },
      { icon: Tag,           label: 'Coupons',         path: '/dashboard/coupons' },
    ],
  },
  {
    icon: Wallet,
    label: 'Finance',
    path: '/dashboard/wallet',
    children: [
      { icon: Wallet,     label: 'Wallet',         path: '/dashboard/wallet' },
      { icon: Calculator, label: 'Tax & Expenses', path: '/dashboard/tax-expenses' },
    ],
  },
  {
    icon: Globe,
    label: 'Store Setup',
    path: '/dashboard/delivery-zones',
    children: [
      { icon: MapPin,  label: 'Delivery Zones', path: '/dashboard/delivery-zones' },
      { icon: Globe,   label: 'Custom Domain',  path: '/dashboard/domain' },
      { icon: Palette, label: 'Templates',      path: '/dashboard/templates' },
      { icon: Layers,  label: 'Niches',         path: '/dashboard/niches' },
    ],
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    path: '/dashboard/analytics',
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/dashboard/settings',
  },
  {
    icon: BookOpen,
    label: 'How to Use',
    path: '/dashboard/how-to-use',
  },
];

const allNavItems = sidebarItems.flatMap(item =>
  item.children ? [item, ...item.children] : [item]
);

// ── Collapsible nav group ─────────────────────────────────────────────────────
function NavGroup({
  item,
  isActive,
  isSidebarOpen,
  onNavigate,
}: {
  item: NavItem;
  isActive: (path: string) => boolean;
  isSidebarOpen: boolean;
  onNavigate: () => void;
}) {
  const groupActive = isActive(item.path) ||
    (item.children?.some(c => isActive(c.path)) ?? false);

  const [isOpen, setIsOpen] = useState(() =>
    item.children?.some(c => isActive(c.path)) ?? false
  );

  useEffect(() => {
    if (!isSidebarOpen) setIsOpen(false);
  }, [isSidebarOpen]);

  if (!item.children) {
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          isActive(item.path)
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        } ${!isSidebarOpen ? 'lg:justify-center lg:px-2' : ''}`}
        title={!isSidebarOpen ? item.label : undefined}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${
            isActive(item.path) ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
          }`}
        />
        {isSidebarOpen && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  if (!isSidebarOpen) {
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        className={`flex items-center justify-center px-2 py-2.5 rounded-lg transition-all ${
          groupActive
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={item.label}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${
            groupActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
          }`}
        />
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          groupActive
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${
            groupActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
          }`}
        />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {isOpen
          ? <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        }
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-0.5 border-l border-gray-100 dark:border-gray-700 pl-3 space-y-0.5">
              {item.children.map(child => (
                <Link
                  key={child.path}
                  to={child.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive(child.path)
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-medium'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <child.icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive(child.path) ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                  <span className="truncate">{child.label}</span>
                  {child.badge ? (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center">
                      {child.badge > 99 ? '99+' : child.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { currentStore, fetchUserStore } = useStoreStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [subscription, setSubscription] = useState<{ tier: string; daysLeft: number } | null>(null);
  const [domainRequest, setDomainRequest] = useState<{
    admin_approved: boolean;
    status: string;
    domain_name: string;
  } | null>(null);
  const [staffStoreId, setStaffStoreId] = useState<string | null>(null);
  const [pendingDropshipCount, setPendingDropshipCount] = useState(0);
  const isStaff = user?.role === 'staff';

  useEffect(() => {
    if (user?.id) {
      fetchUserStore(user.id);
      loadStockAlerts();
      fetchSubscriptionStatus();
    }
  }, [user?.id, fetchUserStore]);

  useEffect(() => {
    if (currentStore?.id) {
      fetchDomainRequestStatus();
      fetchPendingDropshipCount();
    }
  }, [currentStore?.id]);

  useEffect(() => {
    if (isStaff && user?.id) {
      supabase
        .from('store_staff')
        .select('store_id')
        .eq('staff_user_id', user.id)
        .eq('status', 'active')
        .single()
        .then(({ data }) => {
          if (data?.store_id) {
            setStaffStoreId(data.store_id);
            fetchUserStore(data.store_id);
          }
        });
    }
  }, [isStaff, user?.id, fetchUserStore]);

  const fetchPendingDropshipCount = async () => {
    if (!currentStore?.id) return;

    try {
      // Primary: use RPC if available (recommended: create this function in Supabase)
      const { data, error } = await supabase
        .rpc('get_pending_dropship_orders_count', {
          p_store_id: currentStore.id
        });

      if (!error && data !== null) {
        setPendingDropshipCount(Number(data));
        return;
      }
    } catch {
      // RPC not available — fall through to fallback
    }

    // Fallback: adjust this query to match your schema.
    // This should count unique orders where this store's products were sold by dropshippers
    // and the order status is pending/processing.
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .neq('store_id', currentStore.id)
        .eq('status', 'pending');
        // TODO: add .eq('is_dropship', true) or join via order_items to verify product ownership

      if (!error && count !== null) {
        setPendingDropshipCount(count);
      } else {
        setPendingDropshipCount(0);
      }
    } catch {
      setPendingDropshipCount(0);
    }
  };

  const fetchDomainRequestStatus = async () => {
    if (!currentStore?.id) return;
    const { data, error } = await supabase
      .from('domain_requests')
      .select('admin_approved, status, domain_name')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false })
      .maybeSingle();
    setDomainRequest(!error && data ? data : null);
  };

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('subscriptions')
      .select('tier, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    if (data) {
      const days = Math.ceil(
        (new Date(data.expires_at).getTime() - Date.now()) / 86400000
      );
      setSubscription({ tier: data.tier, daysLeft: days });
    }
  };

  const getStoreUrl = () => {
    if (!currentStore) return '#';
    if (
      currentStore.custom_domain &&
      currentStore.domain_status === 'connected' &&
      domainRequest?.admin_approved === true
    ) {
      return `https://${currentStore.custom_domain}`;
    }
    return `/${currentStore.slug}`;
  };

  const getStoreDisplayUrl = () => {
    if (!currentStore) return '';
    if (
      currentStore.custom_domain &&
      currentStore.domain_status === 'connected' &&
      domainRequest?.admin_approved === true
    ) {
      return currentStore.custom_domain;
    }
    return `${window.location.host}/${currentStore.slug}`;
  };

  const isDomainPending = () =>
    currentStore?.custom_domain &&
    currentStore?.domain_status === 'pending' &&
    (!domainRequest?.admin_approved || domainRequest?.status === 'pending');

  useEffect(() => {
    if (!user?.id) return;
    const subs: any[] = [];

    if (currentStore?.id) {
      subs.push(
        subscribeToOrders(currentStore.id, order => {
          toast.success(
            `New order received! #${order.order_number || order.id.slice(0, 8)}`,
            { action: { label: 'View', onClick: () => navigate('/dashboard/orders') } }
          );
        })
      );
    }

    subs.push(subscribeToStockAlerts(user.id, () => loadStockAlerts()));
    subs.push(
      subscribeToWalletUpdates(user.id, tx => {
        if (tx.type === 'credit')
          toast.success(`₦${Number(tx.amount).toLocaleString()} credited to your wallet!`);
      })
    );

    return () => subs.forEach(s => s.unsubscribe());
  }, [user?.id, currentStore?.id, navigate]);

  const loadStockAlerts = async () => {
    if (!user?.id) return;
    const { data } = await stockAlertService.getUnreadAlerts(user.id);
    if (data) setStockAlerts(data as StockAlert[]);
  };

  const handleMarkAlertRead = async (alertId: string) => {
    const { error } = await stockAlertService.markAsRead(alertId);
    if (!error) setStockAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    const { error } = await stockAlertService.markAllAsRead(user.id);
    if (!error) {
      setStockAlerts([]);
      toast.success('All notifications marked as read');
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Fixed: require exact match or sub-route (prevents /dashboard/orders matching /dashboard/dropship-orders)
  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const currentLabel =
    allNavItems.find(item => isActive(item.path))?.label || 'Dashboard';

  const staffAllowedPaths = ['/dashboard', '/dashboard/orders', '/dashboard/products', '/dashboard/dropship-orders'];

  // Inject dynamic badge into sidebar items
  const sidebarItemsWithBadges = sidebarItems.map(item => {
    if (item.label === 'Sales' && item.children) {
      return {
        ...item,
        children: item.children.map(child =>
          child.path === '/dashboard/dropship-orders'
            ? { ...child, badge: pendingDropshipCount > 0 ? pendingDropshipCount : undefined }
            : child
        ),
      };
    }
    return item;
  });

  const visibleItems = isStaff
    ? sidebarItemsWithBadges.filter(item => staffAllowedPaths.some(p => item.path === p))
    : sidebarItemsWithBadges;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          flex flex-col h-screen transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarOpen ? 'w-[260px]' : 'w-0 lg:w-[68px]'}`}
      >
        {/* Logo */}
        <div
          className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0
            ${!isSidebarOpen ? 'lg:justify-center' : ''}`}
        >
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 ${!isSidebarOpen ? 'lg:hidden' : ''}`}
          >
            <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <span className="text-base font-bold text-gray-900 dark:text-white leading-none">QAFRICA</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Seller Dashboard</p>
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

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Store card */}
        {currentStore && isSidebarOpen && (
          <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <a
              href={getStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{currentStore.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{getStoreDisplayUrl()}</p>
                {isDomainPending() && (
                  <p className="text-[11px] text-yellow-600 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> Pending approval
                  </p>
                )}
                {currentStore.custom_domain && domainRequest?.admin_approved && (
                  <p className="text-[11px] text-green-600 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Domain active
                  </p>
                )}
              </div>
            </a>
          </div>
        )}

        {/* Nav — scrollable */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto min-h-0">
          {visibleItems.map(item => (
            <NavGroup
              key={item.path}
              item={item}
              isActive={isActive}
              isSidebarOpen={isSidebarOpen}
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          ))}
        </nav>

        {/* Subscription card */}
        {isSidebarOpen ? (
          <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4" />
                <span className="font-semibold text-sm capitalize">
                  {subscription?.tier || 'Free'} Plan
                </span>
              </div>
              <p className="text-xs text-orange-100 mb-2.5">
                {subscription
                  ? `Expires in ${subscription.daysLeft} days`
                  : 'Upgrade for more features'}
              </p>
              <Link to="/dashboard/subscription">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full bg-white text-orange-600 hover:bg-orange-50 h-7 text-xs"
                >
                  Manage
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex px-2 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 justify-center">
            <Link to="/dashboard/subscription" title="Subscription">
              <div className="w-9 h-9 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Crown className="w-4 h-4 text-white" />
              </div>
            </Link>
          </div>
        )}

        {/* User + logout */}
        <div
          className={`px-2 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800
            ${!isSidebarOpen ? 'lg:px-2' : ''}`}
        >
          {isSidebarOpen && (
            <div className="flex items-center gap-3 px-2 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700">
                {currentStore?.logo_url ? (
                  <img src={currentStore.logo_url} alt="Store logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-300">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{user?.full_name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
          )}

          {isStaff && isSidebarOpen && (
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 rounded-full">
                <Shield className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-medium text-violet-700 dark:text-violet-400">Staff Account</span>
              </div>
            </div>
          )}

          {!isSidebarOpen && (
            <div className="hidden lg:flex justify-center mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-700">
                {currentStore?.logo_url ? (
                  <img src={currentStore.logo_url} alt="Store logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-300">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600
              hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors
              ${!isSidebarOpen ? 'lg:justify-center lg:px-2' : ''}`}
            title={!isSidebarOpen ? 'Logout' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-30">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-white" />
              </button>
              {/* Desktop sidebar toggle */}
              <button
                onClick={() => setIsSidebarOpen(v => !v)}
                className="hidden lg:flex p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {isSidebarOpen
                  ? <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  : <Menu className="w-4 h-4 text-gray-600 dark:text-white" />}
              </button>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white hidden sm:block">
                {currentLabel}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(v => !v);
                    setShowProfileMenu(false);
                  }}
                  className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  {stockAlerts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                      {stockAlerts.length > 9 ? '9+' : stockAlerts.length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotifications(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                        {stockAlerts.length > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-sm text-orange-600"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {stockAlerts.length === 0 ? (
                          <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No new notifications</p>
                          </div>
                        ) : (
                          stockAlerts.map(alert => (
                            <div
                              key={alert.id}
                              className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => handleMarkAlertRead(alert.id)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  alert.alert_type === 'out_of_stock'
                                    ? 'bg-red-100 dark:bg-red-900/30'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30'
                                }`}>
                                  <AlertTriangle className={`w-4 h-4 ${
                                    alert.alert_type === 'out_of_stock'
                                      ? 'text-red-600'
                                      : 'text-yellow-600'
                                  }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                                    {alert.alert_type === 'out_of_stock'
                                      ? 'Out of Stock'
                                      : 'Low Stock Alert'}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {alert.product?.name}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowProfileMenu(v => !v);
                    setShowNotifications(false);
                  }}
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

                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {user?.full_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        {[
                          { to: '/dashboard/settings',     Icon: Settings, label: 'Settings' },
                          { to: '/dashboard/subscription', Icon: Crown,    label: 'Subscription' },
                          { to: '/dashboard/wallet',       Icon: Wallet,   label: 'Wallet' },
                        ].map(({ to, Icon, label }) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setShowProfileMenu(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            {label}
                          </Link>
                        ))}
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                        <button
                          onClick={() => { setShowProfileMenu(false); handleLogout(); }}
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

              {/* View Store */}
              {currentStore && (
                <a
                  href={getStoreUrl()}
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

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <SubscriptionBanner />
          <div className="p-4 lg:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <ModalNotificationDisplay />
    </div>
  );
}