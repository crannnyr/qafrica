// src/pages/dashboard/JumiaDashboardLayout.tsx
// Standalone dashboard shell for Jumia-only sellers (signup_intent === 'jumia').
// Reuses the same Sidebar / DashboardHeader / NavGroup components as the main
// store dashboard, but with a flat Jumia-only nav (jumiaSidebarItems) and none
// of the store-dependent data fetching (no store, no orders, no subscription).

import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores';
import { stockAlertService } from '@/services';
import { subscribeToStockAlerts } from '@/services/realtime';
import ModalNotificationDisplay from '@/components/ModalNotificationDisplay';
import { toast } from 'sonner';
import type { StockAlert } from '@/types';

import Sidebar from './Layout/Sidebar';
import DashboardHeader from './Layout/DashboardHeader';
import { jumiaSidebarItems } from './Layout/constants';

export default function JumiaDashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen]         = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen]   = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu]     = useState(false);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) loadStockAlerts();
  }, [user?.id]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToStockAlerts(user.id, () => loadStockAlerts());
    return () => sub.unsubscribe();
  }, [user?.id]);

  // ── Data fetchers ──────────────────────────────────────────────────────────
  const loadStockAlerts = async () => {
    if (!user?.id) return;
    const { data } = await stockAlertService.getUnreadAlerts(user.id);
    if (data) setStockAlerts(data as StockAlert[]);
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isActive = (path: string) =>
    path === '/jumia-dashboard'
      ? location.pathname === '/jumia-dashboard'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const currentLabel =
    jumiaSidebarItems.find((item) => isActive(item.path))?.label || 'Jumia Dashboard';

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
        visibleItems={jumiaSidebarItems}
        currentStore={null}
        user={user}
        isStaff={false}
        subscription={null}
        domainRequest={null}
        isActive={isActive}
        getStoreUrl={() => '#'}
        getStoreDisplayUrl={() => ''}
        isDomainPending={() => false}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
        onComingSoon={() => {}}
        homePath="/jumia-dashboard"
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <DashboardHeader
          user={user}
          currentStore={null}
          stores={[]}
          currentLabel={currentLabel}
          isSidebarOpen={isSidebarOpen}
          stockAlerts={stockAlerts}
          showNotifications={showNotifications}
          showProfileMenu={showProfileMenu}
          storeUrl="#"
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
          onStoreSwitch={() => {}}
        />

        {/* Scrollable content — no SubscriptionBanner: Jumia-only sellers never
            have a subscriptions row, so that banner (built for the store plan
            flow) doesn't apply here. */}
        <main className="flex-1 overflow-y-auto">
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

      <ModalNotificationDisplay />
    </div>
  );
}
