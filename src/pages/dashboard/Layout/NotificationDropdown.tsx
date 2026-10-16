import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Package, CreditCard, Wallet, AlertTriangle, ArrowUpRight,
  CheckCheck, CircleDollarSign, ShoppingBag, BellRing,
} from 'lucide-react';
import { useAuthStore } from '@/stores';
import { notificationService } from '@/services';
import type { StockAlert } from '@/types';

interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  store_id?: string | null;
}

interface Props {
  stockAlerts: StockAlert[];
  isOpen: boolean;
  onToggle: () => void;
  onMarkRead: (alertId: string) => void;
  onMarkAllRead: () => void;
}

function destinationFor(notification: AppNotification): string {
  const data = notification.data ?? {};
  const productId = typeof data.product_id === 'string' ? data.product_id : null;
  const importId = typeof data.import_id === 'string' ? data.import_id : null;

  switch (notification.type) {
    case 'order_placed':
    case 'order_updated':
    case 'order_status_changed':
    case 'order_cancelled':
    case 'refund_processed':
    case 'dispute_opened':
      return '/dashboard/orders';
    case 'payment_received':
    case 'jumia_payment_received':
    case 'withdrawal_request':
    case 'withdrawal_requested':
    case 'withdrawal_processed':
    case 'withdrawal_approved':
    case 'withdrawal_rejected':
      return '/dashboard/wallet';
    case 'price_change':
      return importId
        ? `/dashboard/import-catalog?import=${encodeURIComponent(importId)}`
        : '/dashboard/import-catalog';
    case 'product_imported':
      return '/dashboard/products';
    case 'new_product_in_niche':
      return productId
        ? `/dashboard/import-catalog?product=${encodeURIComponent(productId)}`
        : '/dashboard/import-catalog';
    case 'low_stock':
    case 'out_of_stock':
      return productId
        ? `/dashboard/products?product=${encodeURIComponent(productId)}`
        : '/dashboard/products';
    default:
      return '/dashboard';
  }
}

function iconFor(type: string) {
  if (type.includes('order') || type.includes('product')) return Package;
  if (type.includes('payment')) return CreditCard;
  if (type.includes('withdrawal') || type.includes('wallet')) return Wallet;
  if (type.includes('stock')) return AlertTriangle;
  if (type.includes('price')) return CircleDollarSign;
  if (type.includes('import')) return ShoppingBag;
  return BellRing;
}

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationDropdown({
  stockAlerts,
  isOpen,
  onToggle,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Keep the existing stock-alert props wired for compatibility with dashboard callers.
  void stockAlerts;
  void onMarkRead;
  void onMarkAllRead;

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    const [feed, count] = await Promise.all([
      notificationService.getUserNotifications(user.id, 50),
      notificationService.getUnreadNotificationCount(user.id),
    ]);
    if (!feed.error) setNotifications((feed.data ?? []) as AppNotification[]);
    if (!count.error) setUnreadCount(count.count ?? 0);
    setLoading(false);
  }, [user?.id]);

  // Load the unread badge as soon as the dashboard mounts, not only when
  // the bell is opened. Realtime events keep the badge fresh while the menu is closed.
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void loadNotifications();

    const channel = supabase
      .channel(`dashboard-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  const markReadAndOpen = async (notification: AppNotification) => {
    if (!notification.is_read) {
      const { error } = await notificationService.markAsRead(notification.id);
      if (!error) {
        setNotifications((previous) =>
          previous.map((item) => item.id === notification.id ? { ...item, is_read: true } : item),
        );
        setUnreadCount((previous) => Math.max(0, previous - 1));
      }
    }
    onToggle();
    navigate(destinationFor(notification));
  };

  const markAllRead = async () => {
    if (!user?.id || markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const { error } = await notificationService.markAllAsRead(user.id);
    if (!error) {
      setNotifications((previous) => previous.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    }
    setMarkingAll(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={onToggle}
          />
          <div className="fixed left-2 right-2 top-[5.5rem] w-auto sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {unreadCount ? `${unreadCount.toLocaleString()} unread` : 'You are all caught up'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0 || markingAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            </div>

            <div className="max-h-[min(26rem,65vh)] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading notifications…</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = iconFor(notification.type);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void markReadAndOpen(notification)}
                      className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3 ${notification.is_read ? 'opacity-70' : 'bg-orange-50/50 dark:bg-orange-950/10'}`}
                    >
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${notification.is_read ? 'bg-gray-100 dark:bg-gray-700' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                        <Icon className={`w-4 h-4 ${notification.is_read ? 'text-gray-500' : 'text-orange-600'}`} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{notification.title || 'Notification'}</span>
                          {!notification.is_read && <span className="mt-1 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                        </span>
                        <span className="block text-sm text-gray-600 dark:text-gray-300 mt-0.5 break-words">{notification.message}</span>
                        <span className="block text-[11px] text-gray-400 mt-1">{relativeTime(notification.created_at)}</span>
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 text-[11px] text-gray-500 flex justify-between">
              <span>Showing latest {notifications.length} notifications</span>
              <button type="button" onClick={() => { onToggle(); navigate('/dashboard'); }} className="text-orange-600 hover:text-orange-700 font-medium">Dashboard</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}