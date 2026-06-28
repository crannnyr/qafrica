// src/pages/dashboard/DashboardLayout.tsx

import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useStoreStore } from '@/stores';
import { stockAlertService, supabase } from '@/services';
import { subscribeToOrders, subscribeToStockAlerts, subscribeToWalletUpdates } from '@/services/realtime';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import ModalNotificationDisplay from '@/components/ModalNotificationDisplay';
import { toast } from 'sonner';
import type { StockAlert, Store } from '@/types';
import type { PermissionKey } from '@/lib/staffPermissions';

import Sidebar from './Layout/Sidebar';
import DashboardHeader from './Layout/DashboardHeader';
import ComingSoonModal from './Layout/ComingSoonModal';
import {
  sidebarItems, allNavItems, getVisibleSidebarItems, staffCanAccess,
  type MarketplaceBrand,
} from './Layout/constants';

const PERMISSION_COLUMNS =
  'can_view_orders, can_update_orders, can_view_products, can_manage_products, can_manage_wallet, can_manage_settings, can_view_analytics';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout }                                        = useAuthStore();
  const { currentStore, fetchUserStore, getUserStores, switchActiveStore } = useStoreStore();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen]         = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen]   = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu]     = useState(false);
  const [comingSoonBrand, setComingSoonBrand]     = useState<MarketplaceBrand | null>(null);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [stockAlerts, setStockAlerts]                     = useState<StockAlert[]>([]);
  const [subscription, setSubscription]                   = useState<{ tier: string; daysLeft: number } | null>(null);
  const [domainRequest, setDomainRequest]                 = useState<{
    admin_approved: boolean; status: string; domain_name: string;
  } | null>(null);
  const [pendingDropshipCount, setPendingDropshipCount]   = useState(0);
  const [stores, setStores]                               = useState<Store[]>([]);

  // Staff's actual granted permissions, fetched from their store_staff row.
  // null while loading / not yet known — treated as "no access" by staffCanAccess until populated.
  const [staffPermissions, setStaffPermissions]           = useState<Record<PermissionKey, boolean> | null>(null);
  const [staffPermissionsLoaded, setStaffPermissionsLoaded] = useState(false);

  const isStaff = user?.role === 'staff';

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      fetchUserStore(user.id);
      loadStockAlerts();
      fetchSubscriptionStatus();
      getUserStores(user.id).then((result) => setStores(result ?? []));
    }
  }, [user?.id, fetchUserStore]);

  useEffect(() => {
    if (currentStore?.id) {
      fetchDomainRequestStatus();
      fetchPendingDropshipCount();
    }
  }, [currentStore?.id]);

  // Resolve the staff member's store + their actual granted permissions in one query.
  useEffect(() => {
    if (!isStaff || !user?.id) {
      setStaffPermissionsLoaded(true);
      return;
    }
    supabase
      .from('store_staff')
      .select(`store_id, status, ${PERMISSION_COLUMNS}`)
      .eq('staff_user_id', user.id)
      .eq('status', 'active')
      .single()
      .then(({ data }) => {
        if (data?.store_id) fetchUserStore(data.store_id);
        if (data) {
          setStaffPermissions({
            can_view_orders:     Boolean(data.can_view_orders),
            can_update_orders:   Boolean(data.can_update_orders),
            can_view_products:   Boolean(data.can_view_products),
            can_manage_products: Boolean(data.can_manage_products),
            can_manage_wallet:   Boolean(data.can_manage_wallet),
            can_manage_settings: Boolean(data.can_manage_settings),
            can_view_analytics:  Boolean(data.can_view_analytics),
          });
        }
        setStaffPermissionsLoaded(true);
      });
  }, [isStaff, user?.id, fetchUserStore]);

  // Route guard: if a staff member manually navigates to a page they aren't permitted to see,
  // bounce them back to the dashboard home. Waits for permissions to load first so we don't
  // false-redirect on first paint. RLS is the real security boundary — this is just UX.
  useEffect(() => {
    if (!isStaff || !staffPermissionsLoaded) return;
    if (!staffCanAccess(location.pathname, staffPermissions)) {
      toast.error("You don't have access to that page");
      navigate('/dashboard', { replace: true });
    }
  }, [isStaff, staffPermissionsLoaded, staffPermissions, location.pathname, navigate]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const subs: any[] = [];

    if (currentStore?.id) {
      subs.push(
        subscribeToOrders(currentStore.id, (order) => {
          toast.success(
            `New order received! #${order.order_number || order.id.slice(0, 8)}`,
            { action: { label: 'View', onClick: () => navigate('/dashboard/orders') } },
          );
        }),
      );
    }

    subs.push(subscribeToStockAlerts(user.id, () => loadStockAlerts()));
    subs.push(
      subscribeToWalletUpdates(user.id, (tx) => {
        if (tx.type === 'credit')
          toast.success(`₦${Number(tx.amount).toLocaleString()} credited to your wallet!`);
      }),
    );

    return () => subs.forEach((s) => s.unsubscribe());
  }, [user?.id, currentStore?.id, navigate]);

  // ── Data fetchers ──────────────────────────────────────────────────────────
  const loadStockAlerts = async () => {
    if (!user?.id) return;
    const { data } = await stockAlertService.getUnreadAlerts(user.id);
    if (data) setStockAlerts(data as StockAlert[]);
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
        (new Date(data.expires_at).getTime() - Date.now()) / 86400000,
      );
      setSubscription({ tier: data.tier, daysLeft: days });
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

  const fetchPendingDropshipCount = async () => {
    if (!currentStore?.id) return;
    try {
      const { data, error } = await supabase
        .rpc('get_pending_dropship_orders_count', { p_store_id: currentStore.id });
      if (!error && data !== null) { setPendingDropshipCount(Number(data)); return; }
    } catch { /* fall through */ }
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .neq('store_id', currentStore.id)
        .eq('status', 'pending');
      setPendingDropshipCount(!error && count !== null ? count : 0);
    } catch {
      setPendingDropshipCount(0);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMarkAlertRead = async (alertId: string) => {
    const { error } = await stockAlertService.markAsRead(alertId);
    if (!error) setStockAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    const { error } = await stockAlertService.markAllAsRead(user.id);
    if (!error) { setStockAlerts([]); toast.success('All notifications marked as read'); }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleStoreSwitch = async (storeId: string) => {
    await switchActiveStore(storeId);
    window.location.reload();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const getStoreUrl = () => {
    if (!currentStore) return '#';
    if (
      currentStore.custom_domain &&
      currentStore.domain_status === 'connected' &&
      domainRequest?.admin_approved === true
    ) return `https://${currentStore.custom_domain}`;
    return `/${currentStore.slug}`;
  };

  const getStoreDisplayUrl = () => {
    if (!currentStore) return '';
    if (
      currentStore.custom_domain &&
      currentStore.domain_status === 'connected' &&
      domainRequest?.admin_approved === true
    ) return currentStore.custom_domain;
    return `${window.location.host}/${currentStore.slug}`;
  };

  const isDomainPending = () =>
    !!(currentStore?.custom_domain &&
      currentStore?.domain_status === 'pending' &&
      (!domainRequest?.admin_approved || domainRequest?.status === 'pending'));

  // ── Sidebar items with badges + permission-based staff filter ─────────────
  const sidebarItemsWithBadges = sidebarItems.map((item) => {
    if (item.label === 'Sales' && item.children) {
      return {
        ...item,
        children: item.children.map((child) =>
          child.path === '/dashboard/dropship-orders'
            ? { ...child, badge: pendingDropshipCount > 0 ? pendingDropshipCount : undefined }
            : child,
        ),
      };
    }
    return item;
  });

  const visibleItems = getVisibleSidebarItems(sidebarItemsWithBadges, isStaff, staffPermissions);

  const currentLabel =
    allNavItems.find((item) => isActive(item.path))?.label || 'Dashboard';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        visibleItems={visibleItems}
        currentStore={currentStore}
        user={user}
        isStaff={isStaff}
        subscription={subscription}
        domainRequest={domainRequest}
        isActive={isActive}
        getStoreUrl={getStoreUrl}
        getStoreDisplayUrl={getStoreDisplayUrl}
        isDomainPending={isDomainPending}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
        onComingSoon={(brand) => setComingSoonBrand(brand)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <DashboardHeader
          user={user}
          currentStore={currentStore}
          stores={stores}
          currentLabel={currentLabel}
          isSidebarOpen={isSidebarOpen}
          stockAlerts={stockAlerts}
          showNotifications={showNotifications}
          showProfileMenu={showProfileMenu}
          storeUrl={getStoreUrl()}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onToggleNotifications={() => {
            setShowNotifications((v) => !v);
            setShowProfileMenu(false);
          }}
          onToggleProfileMenu={() => {
            setShowProfileMenu((v) => !v);
            setShowNotifications(false);
          }}
          onMarkAlertRead={handleMarkAlertRead}
          onMarkAllRead={handleMarkAllRead}
          onLogout={handleLogout}
          onStoreSwitch={handleStoreSwitch}
        />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <SubscriptionBanner />
          <div className="p-4 lg:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8  }}
                animate={{ opacity: 1, y: 0  }}
                exit={{   opacity: 0, y: -8  }}
                transition={{ duration: 0.15 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Coming soon modal */}
      <ComingSoonModal
        brand={comingSoonBrand}
        onClose={() => setComingSoonBrand(null)}
      />

      <ModalNotificationDisplay />
    </div>
  );
}
