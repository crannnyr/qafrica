import { create } from 'zustand';
import { orderService } from '@/services/supabase';
import type { Order, DropshipOrderView } from '@/types';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  // FIX: Added state for orders where this store's products are being dropshipped
  // by another store — used by the original product owner's Dropship Orders view
  dropshipOrders: DropshipOrderView[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchStoreOrders: (storeId: string) => Promise<void>;
  fetchUserOrders: (userId: string) => Promise<void>;
  fetchAllOrders: () => Promise<void>;
  getOrder: (orderId: string) => Promise<void>;
  createOrder: (orderData: Partial<Order>) => Promise<{ success: boolean; data?: Order; error?: string }>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<{ success: boolean; error?: string }>;
  confirmDelivery: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  // FIX: New actions for original product owners managing dropshipped orders
  fetchDropshipOrders: (storeId: string) => Promise<void>;
  updateDropshipOrderStatus: (orderId: string, originalStoreId: string, status: Order['status']) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  reset: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  // FIX: Initialise dropshipOrders as empty array
  dropshipOrders: [],
  isLoading: false,
  error: null,

  // FIX: fetchStoreOrders now uses the updated service method which merges direct
  // orders (store_id match) AND orders where this store's products were dropshipped.
  // No change needed here in the store — the service layer handles the merge.
  fetchStoreOrders: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getStoreOrders(storeId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ orders: data as Order[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      set({ isLoading: false, error: message });
    }
  },

  fetchUserOrders: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getUserOrders(userId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ orders: data as Order[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      set({ isLoading: false, error: message });
    }
  },

  fetchAllOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getAllOrders();
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ orders: data as Order[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      set({ isLoading: false, error: message });
    }
  },

  getOrder: async (orderId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getOrder(orderId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ currentOrder: data as Order, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch order';
      set({ isLoading: false, error: message });
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

      set((state) => ({ 
        orders: [data as Order, ...state.orders],
        currentOrder: data as Order,
        isLoading: false 
      }));
      return { success: true, data: data as Order };
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
          o.id === orderId ? { ...o, ...data } as Order : o
        ),
        currentOrder: state.currentOrder?.id === orderId 
          ? { ...state.currentOrder, ...data } as Order 
          : state.currentOrder,
        isLoading: false
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
          o.id === orderId ? { ...o, ...data } as Order : o
        ),
        currentOrder: state.currentOrder?.id === orderId 
          ? { ...state.currentOrder, ...data } as Order 
          : state.currentOrder,
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm delivery';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  // FIX: Fetches orders where this store is the ORIGINAL PRODUCT OWNER and
  // another store is the dropshipper. Populates dropshipOrders (not orders).
  fetchDropshipOrders: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.getDropshipOrdersForStore(storeId);
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }
      set({ dropshipOrders: data as DropshipOrderView[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dropship orders';
      set({ isLoading: false, error: message });
    }
  },

  // FIX: Lets the original product owner advance an order's status after verifying
  // they have items in that order. On success, optimistically patches dropshipOrders.
  updateDropshipOrderStatus: async (orderId, originalStoreId, status) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await orderService.updateDropshipOrderStatus(
        orderId,
        originalStoreId,
        status
      );
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
  // FIX: reset now also clears dropshipOrders
  reset: () => set({ orders: [], currentOrder: null, dropshipOrders: [], error: null }),
}));

export default useOrderStore;