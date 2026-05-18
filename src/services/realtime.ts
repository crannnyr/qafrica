import { supabase } from './supabase';
import { toast } from 'sonner';

// Subscribe to new orders for a store
export const subscribeToOrders = (storeId: string, callback: (order: any) => void) => {
  const subscription = supabase
    .channel(`orders:store:${storeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${storeId}`,
      },
      (payload) => {
        callback(payload.new);
        toast.success('New order received!', {
          description: `Order #${payload.new.id.slice(0, 8)}`,
        });
      }
    )
    .subscribe();

  return subscription;
};

// Subscribe to order status changes
export const subscribeToOrderUpdates = (orderId: string, callback: (order: any) => void) => {
  const subscription = supabase
    .channel(`orders:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return subscription;
};

// Subscribe to stock alerts
export const subscribeToStockAlerts = (ownerId: string, callback: (alert: any) => void) => {
  const subscription = supabase
    .channel(`stock_alerts:owner:${ownerId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'stock_alerts',
        filter: `owner_id=eq.${ownerId}`,
      },
      (payload) => {
        callback(payload.new);
        const alert = payload.new;
        if (alert.alert_type === 'out_of_stock') {
          toast.error(`Out of Stock: Product needs restocking`, {
            description: 'View stock alerts for details',
          });
        } else if (alert.alert_type === 'low_stock') {
          toast.warning(`Low Stock Alert: Running low on inventory`, {
            description: 'Check your stock levels',
          });
        }
      }
    )
    .subscribe();

  return subscription;
};

// Subscribe to wallet transactions
export const subscribeToWalletUpdates = (userId: string, callback: (transaction: any) => void) => {
  const subscription = supabase
    .channel(`wallet_transactions:user:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'wallet_transactions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new);
        const tx = payload.new;
        if (tx.type === 'credit') {
          toast.success(`₦${tx.amount.toLocaleString()} credited to your wallet!`);
        }
      }
    )
    .subscribe();

  return subscription;
};

// Subscribe to payment confirmations
export const subscribeToPayments = (storeId: string, callback: (payment: any) => void) => {
  const subscription = supabase
    .channel(`payments:store:${storeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'payments',
        filter: `store_id=eq.${storeId}`,
      },
      (payload) => {
        callback(payload.new);
        toast.success('Payment received!', {
          description: `₦${payload.new.amount.toLocaleString()}`,
        });
      }
    )
    .subscribe();

  return subscription;
};

// Subscribe to all notifications for a user
export const subscribeToAllNotifications = (userId: string, storeId: string | null, callbacks: {
  onNewOrder?: (order: any) => void;
  onStockAlert?: (alert: any) => void;
  onWalletUpdate?: (transaction: any) => void;
  onPayment?: (payment: any) => void;
}) => {
  const subscriptions: any[] = [];

  if (storeId && callbacks.onNewOrder) {
    subscriptions.push(subscribeToOrders(storeId, callbacks.onNewOrder));
  }

  if (callbacks.onStockAlert) {
    subscriptions.push(subscribeToStockAlerts(userId, callbacks.onStockAlert));
  }

  if (callbacks.onWalletUpdate) {
    subscriptions.push(subscribeToWalletUpdates(userId, callbacks.onWalletUpdate));
  }

  if (storeId && callbacks.onPayment) {
    subscriptions.push(subscribeToPayments(storeId, callbacks.onPayment));
  }

  // Return unsubscribe function
  return () => {
    subscriptions.forEach(sub => sub.unsubscribe());
  };
};

// Hook for using realtime subscriptions
export const useRealtimeNotifications = (userId: string | undefined, storeId: string | null) => {
  if (!userId) return;

  const unsubscribe = subscribeToAllNotifications(userId, storeId, {
    onNewOrder: (order) => {
      console.log('New order:', order);
    },
    onStockAlert: (alert) => {
      console.log('Stock alert:', alert);
    },
    onWalletUpdate: (transaction) => {
      console.log('Wallet update:', transaction);
    },
    onPayment: (payment) => {
      console.log('Payment:', payment);
    },
  });

  return unsubscribe;
};
