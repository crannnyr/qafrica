import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storeService, productService, deliveryZoneService } from '@/services';
import type { Store, Product, DeliveryZone } from '@/types';

interface StoreState {
  currentStore: Store | null;
  products: Product[];
  deliveryZones: DeliveryZone[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentStore: (store: Store | null) => void;
  createStore: (storeData: Partial<Store>) => Promise<{ success: boolean; data?: Store; error?: string }>;
  fetchStore: (storeId: string) => Promise<void>;
  fetchUserStore: (userId: string) => Promise<void>;
  updateStore: (storeId: string, updates: Partial<Store>) => Promise<{ success: boolean; error?: string }>;
  
  // Products
  fetchProducts: (storeId: string) => Promise<void>;
  addProduct: (productData: Partial<Product>) => Promise<{ success: boolean; error?: string }>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<{ success: boolean; error?: string }>;
  deleteProduct: (productId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Delivery Zones
  fetchDeliveryZones: (storeId: string) => Promise<void>;
  addDeliveryZone: (zoneData: Partial<DeliveryZone>) => Promise<{ success: boolean; error?: string }>;
  updateDeliveryZone: (zoneId: string, updates: Partial<DeliveryZone>) => Promise<{ success: boolean; error?: string }>;
  deleteDeliveryZone: (zoneId: string) => Promise<{ success: boolean; error?: string }>;
  
  clearError: () => void;
  reset: () => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      currentStore: null,
      products: [],
      deliveryZones: [],
      isLoading: false,
      error: null,

      setCurrentStore: (store) => set({ currentStore: store }),

      createStore: async (storeData) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await storeService.createStore(storeData);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set({ currentStore: data as Store, isLoading: false });
          return { success: true, data: data as Store };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create store';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      fetchStore: async (storeId) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await storeService.getStore(storeId);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return;
          }

          set({ currentStore: data as Store, isLoading: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch store';
          set({ isLoading: false, error: message });
        }
      },

      fetchUserStore: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await storeService.getUserStore(userId);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return;
          }

          set({ currentStore: data as Store, isLoading: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch store';
          set({ isLoading: false, error: message });
        }
      },

      updateStore: async (storeId, updates) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await storeService.updateStore(storeId, updates);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set({ currentStore: data as Store, isLoading: false });
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update store';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      // Products
      fetchProducts: async (storeId) => {
        try {
          const { data, error } = await productService.getStoreProducts(storeId);
          
          if (error) {
            console.error('Failed to fetch products:', error);
            return;
          }

          set({ products: data as Product[] });
        } catch (err) {
          console.error('Failed to fetch products:', err);
        }
      },

      addProduct: async (productData) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await productService.createProduct(productData);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set((state) => ({ 
            products: [data as Product, ...state.products],
            isLoading: false 
          }));
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to add product';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      updateProduct: async (productId, updates) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await productService.updateProduct(productId, updates);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set((state) => ({
            products: state.products.map((p) => 
              p.id === productId ? { ...p, ...data } as Product : p
            ),
            isLoading: false
          }));
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update product';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      deleteProduct: async (productId) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await productService.deleteProduct(productId);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set((state) => ({
            products: state.products.filter((p) => p.id !== productId),
            isLoading: false
          }));
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete product';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      // Delivery Zones
      fetchDeliveryZones: async (storeId) => {
        try {
          const { data, error } = await deliveryZoneService.getStoreZones(storeId);
          
          if (error) {
            console.error('Failed to fetch delivery zones:', error);
            return;
          }

          set({ deliveryZones: data as DeliveryZone[] });
        } catch (err) {
          console.error('Failed to fetch delivery zones:', err);
        }
      },

      addDeliveryZone: async (zoneData) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await deliveryZoneService.createZone(zoneData);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set((state) => ({ 
            deliveryZones: [...state.deliveryZones, data as DeliveryZone],
            isLoading: false 
          }));
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to add delivery zone';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      updateDeliveryZone: async (zoneId, updates) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await deliveryZoneService.updateZone(zoneId, updates);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set((state) => ({
            deliveryZones: state.deliveryZones.map((z) => 
              z.id === zoneId ? { ...z, ...data } as DeliveryZone : z
            ),
            isLoading: false
          }));
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update delivery zone';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      deleteDeliveryZone: async (zoneId) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await deliveryZoneService.deleteZone(zoneId);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set((state) => ({
            deliveryZones: state.deliveryZones.filter((z) => z.id !== zoneId),
            isLoading: false
          }));
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete delivery zone';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      clearError: () => set({ error: null }),
      reset: () => set({ currentStore: null, products: [], deliveryZones: [], error: null }),
    }),
    {
      name: 'qafrica-store',
      partialize: (state) => ({ currentStore: state.currentStore }),
    }
  )
);

export default useStoreStore;
