// src/stores/developerOrderStore.ts
import { create } from 'zustand';
import { developerOrderService } from '@/services/developer';
import type {
  DeveloperOrder,
  DeveloperOrderStatus,
  PaginatedResponse,
} from '@/types/developer';

// ── Filter shape ──────────────────────────────────────────────
export interface OrderFilters {
  status?:    DeveloperOrderStatus | '';
  date_from?: string;
  date_to?:   string;
  page?:      number;
  limit?:     number;
}

// ── State shape ───────────────────────────────────────────────
interface DeveloperOrderState {
  // ── List ──────────────────────────────────────────────────────
  orders:       DeveloperOrder[];
  ordersPage:   number;
  ordersTotal:  number;
  ordersPages:  number;
  ordersLoading: boolean;
  ordersError:  string | null;
  filters:      OrderFilters;

  // ── Single order ──────────────────────────────────────────────
  currentOrder:        DeveloperOrder | null;
  currentOrderLoading: boolean;
  currentOrderError:   string | null;

  // ── Per-action states ─────────────────────────────────────────
  cancellingId: string | null;   // order id being cancelled

  // ── Computed stats (derived from the current orders list) ─────
  stats: {
    pending:    number;
    confirmed:  number;
    shipped:    number;
    delivered:  number;
    cancelled:  number;
    totalValue: number;
  };

  // ── Actions ───────────────────────────────────────────────────
  fetchOrders:      (filters?: OrderFilters) => Promise<void>;
  fetchOrder:       (orderId: string) => Promise<void>;
  cancelOrder:      (orderId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  setFilters:       (filters: OrderFilters) => void;
  resetFilters:     () => void;
  clearCurrentOrder:() => void;
  clearErrors:      () => void;
  reset:            () => void;
}

// ── Helpers ───────────────────────────────────────────────────
const DEFAULT_FILTERS: OrderFilters = {
  status: '',
  page:   1,
  limit:  20,
};

function computeStats(orders: DeveloperOrder[]) {
  return orders.reduce(
    (acc, o) => {
      switch (o.status) {
        case 'pending':           acc.pending++;   break;
        case 'confirmed':
        case 'processing':        acc.confirmed++; break;
        case 'shipped':
        case 'out_for_delivery':  acc.shipped++;   break;
        case 'delivered':         acc.delivered++; break;
        case 'cancelled':
        case 'refunded':          acc.cancelled++; break;
      }
      acc.totalValue += o.total ?? 0;
      return acc;
    },
    { pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0, totalValue: 0 },
  );
}

// ── Store ─────────────────────────────────────────────────────
export const useDeveloperOrderStore = create<DeveloperOrderState>()(
  (set, get) => ({
    // ── Initial state ───────────────────────────────────────────
    orders:       [],
    ordersPage:   1,
    ordersTotal:  0,
    ordersPages:  1,
    ordersLoading: false,
    ordersError:  null,
    filters:      DEFAULT_FILTERS,

    currentOrder:        null,
    currentOrderLoading: false,
    currentOrderError:   null,

    cancellingId: null,

    stats: {
      pending:    0,
      confirmed:  0,
      shipped:    0,
      delivered:  0,
      cancelled:  0,
      totalValue: 0,
    },

    // ════════════════════════════════════════════════════════════
    // LIST
    // ════════════════════════════════════════════════════════════

    fetchOrders: async (filters) => {
      const merged: OrderFilters = {
        ...get().filters,
        ...filters,
      };

      // Strip empty status so the API receives no status filter
      const apiFilters = {
        ...merged,
        status: merged.status || undefined,
      };

      set({ ordersLoading: true, ordersError: null, filters: merged });

      try {
        const result: PaginatedResponse<DeveloperOrder> =
          await developerOrderService.listOrders(apiFilters);

        set({
          orders:       result.data,
          ordersPage:   result.meta.page,
          ordersTotal:  result.meta.total,
          ordersPages:  result.meta.pages,
          ordersLoading: false,
          stats:        computeStats(result.data),
        });
      } catch (err: any) {
        const message = err?.message ?? 'Failed to load orders.';
        set({ ordersLoading: false, ordersError: message });
      }
    },

    // ════════════════════════════════════════════════════════════
    // SINGLE ORDER
    // ════════════════════════════════════════════════════════════

    fetchOrder: async (orderId) => {
      // Check if we already have it in the list (use as initial data
      // while the full detail loads)
      const cached = get().orders.find((o) => o.id === orderId);
      if (cached) {
        set({ currentOrder: cached });
      }

      set({ currentOrderLoading: true, currentOrderError: null });

      try {
        const result = await developerOrderService.getOrder(orderId);
        set({
          currentOrder:        result.data,
          currentOrderLoading: false,
        });
      } catch (err: any) {
        const message = err?.message ?? 'Failed to load order details.';
        set({ currentOrderLoading: false, currentOrderError: message });
      }
    },

    // ════════════════════════════════════════════════════════════
    // CANCEL
    // ════════════════════════════════════════════════════════════

    cancelOrder: async (orderId, reason) => {
      set({ cancellingId: orderId });

      // Optimistic update on both the list and the current order
      const updateStatus = (order: DeveloperOrder): DeveloperOrder =>
        order.id === orderId ? { ...order, status: 'cancelled' } : order;

      set((state) => ({
        orders:       state.orders.map(updateStatus),
        currentOrder: state.currentOrder?.id === orderId
          ? updateStatus(state.currentOrder)
          : state.currentOrder,
      }));

      try {
        await developerOrderService.cancelOrder(orderId, reason);
        set({ cancellingId: null });

        // Re-compute stats after status change
        set((state) => ({ stats: computeStats(state.orders) }));

        return { success: true };
      } catch (err: any) {
        // Rollback — re-fetch the affected order to restore real status
        try {
          const restored = await developerOrderService.getOrder(orderId);
          set((state) => ({
            orders:       state.orders.map((o) => o.id === orderId ? restored.data : o),
            currentOrder: state.currentOrder?.id === orderId ? restored.data : state.currentOrder,
          }));
        } catch {
          // Rollback failed — just clear loading state and let the user retry
        }

        set({ cancellingId: null });
        const message = err?.message ?? 'Failed to cancel order.';
        return { success: false, error: message };
      }
    },

    // ════════════════════════════════════════════════════════════
    // FILTERS
    // ════════════════════════════════════════════════════════════

    setFilters: (filters) => {
      set((state) => ({
        filters: { ...state.filters, ...filters },
      }));
    },

    resetFilters: () => set({ filters: DEFAULT_FILTERS }),

    // ════════════════════════════════════════════════════════════
    // UTILS
    // ════════════════════════════════════════════════════════════

    clearCurrentOrder: () =>
      set({ currentOrder: null, currentOrderError: null }),

    clearErrors: () =>
      set({ ordersError: null, currentOrderError: null }),

    reset: () =>
      set({
        orders:              [],
        ordersPage:          1,
        ordersTotal:         0,
        ordersPages:         1,
        ordersLoading:       false,
        ordersError:         null,
        filters:             DEFAULT_FILTERS,
        currentOrder:        null,
        currentOrderLoading: false,
        currentOrderError:   null,
        cancellingId:        null,
        stats: {
          pending:    0,
          confirmed:  0,
          shipped:    0,
          delivered:  0,
          cancelled:  0,
          totalValue: 0,
        },
      }),
  }),
);

export default useDeveloperOrderStore;