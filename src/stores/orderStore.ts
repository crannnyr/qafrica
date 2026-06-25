import { create } from 'zustand';
import { orderService } from '@/services';
import type { Order, DropshipOrderView } from '@/types';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  dropshipOrders: DropshipOrderView[];
  isLoading: boolean;
  error: string | null;

  fetchStoreOrders: (storeId: string) => Promise<void>;
  fetchUserOrders: (userId: string) => Promise<void>;
  fetchAllOrders: () => Promise<void>;
  getOrder: (orderId: string) => Promise<void>;
  createOrder: (orderData: Partial<Order>) => Promise<{ success: boolean; data?: Order; error?: string }>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<{ success: boolean; error?: string }>;
  confirmDelivery: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  fetchDropshipOrders: (storeId: string) => Promise<void>;
  updateDropshipOrderStatus: (orderId: string, originalStoreId: string, status: Order['status']) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  reset: () => void;
}

// FIX: Helper to safely cast Supabase response data to Order[].
// Our service now returns order_items instead of items (to avoid the JSONB
// column name conflict), but the Order type requires both. We normalise here
// so the rest of the app can use either order.items or order.order_items.
function toOrders(data: any[] | null): Order[] {
  if (!data) return [];
  return data.map(row => ({
    ...row,
    // Ensure both aliases are populated so components that read either field work
    items:       row.items       ?? row.order_items ?? [],
    order_items: row.order_items ?? row.items       ?? [],
  })) as Order[];
}

function toOrder(data: any | null): Order | null {
  if (!data) return null;
  return {
    ...data,
    items:       data.items       ?? data.order_items ?? [],
    order_items: data.order_items ?? data.items       ?? [],
  } as Order;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  dropshipOrders: [],
  isLoading: false,
  error: null,

  fetchStoreOrders: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getStoreOrders(storeId);
      if (error) { set({ isLoading: false, error: error.message }); return; }
      set({ orders: toOrders(data), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch orders' });
    }
  },

  fetchUserOrders: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getUserOrders(userId);
      if (error) { set({ isLoading: false, error: error.message }); return; }
      set({ orders: toOrders(data), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch orders' });
    }
  },

  fetchAllOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getAllOrders();
      if (error) { set({ isLoading: false, error: error.message }); return; }
      set({ orders: toOrders(data), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch orders' });
    }
  },

  getOrder: async (orderId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getOrder(orderId);
      if (error) { set({ isLoading: false, error: error.message }); return; }
      set({ currentOrder: toOrder(data), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch order' });
    }
  },

  createOrder: async (orderData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.createOrder(orderData);
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      const order = toOrder(data);
      set((state) => ({
        orders: [order!, ...state.orders],
        currentOrder: order,
        isLoading: false,
      }));
      return { success: true, data: order! };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  updateOrderStatus: async (orderId, status) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.updateOrderStatus(orderId, status);
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? toOrder({ ...o, ...data })! : o
        ),
        currentOrder: state.currentOrder?.id === orderId
          ? toOrder({ ...state.currentOrder, ...data })
          : state.currentOrder,
        isLoading: false,
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update order status';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  confirmDelivery: async (orderId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.confirmDelivery(orderId);
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? toOrder({ ...o, ...data })! : o
        ),
        currentOrder: state.currentOrder?.id === orderId
          ? toOrder({ ...state.currentOrder, ...data })
          : state.currentOrder,
        isLoading: false,
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm delivery';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  fetchDropshipOrders: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getDropshipOrdersForStore(storeId);
      if (error) { set({ isLoading: false, error: error.message }); return; }
      set({ dropshipOrders: (data ?? []) as DropshipOrderView[], isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch dropship orders' });
    }
  },

  updateDropshipOrderStatus: async (orderId, originalStoreId, status) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.updateDropshipOrderStatus(orderId, originalStoreId, status);
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      set((state) => ({
        dropshipOrders: state.dropshipOrders.map((o) =>
          o.order_id === orderId ? { ...o, status } as DropshipOrderView : o
        ),
        isLoading: false,
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update dropship order status';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ orders: [], currentOrder: null, dropshipOrders: [], error: null }),
}));

export default useOrderStore;
