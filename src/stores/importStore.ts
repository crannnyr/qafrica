import { create } from 'zustand';
import { importCatalogService, supabase } from '@/services';
import type { ImportCatalogItem, Product } from '@/types';

interface ImportState {
  imports: ImportCatalogItem[];
  availableProducts: Product[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchStoreImports: (storeId: string) => Promise<void>;
  fetchAvailableProducts: (niche: string, excludeStoreId: string) => Promise<void>;
  importProduct: (importData: Partial<ImportCatalogItem>) => Promise<{ success: boolean; error?: string }>;
  updateImport: (importId: string, updates: Partial<ImportCatalogItem>) => Promise<{ success: boolean; error?: string }>;
  deleteImport: (importId: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  reset: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  imports: [],
  availableProducts: [],
  isLoading: false,
  error: null,

  fetchStoreImports: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await importCatalogService.getStoreImports(storeId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ imports: data as ImportCatalogItem[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch imports';
      set({ isLoading: false, error: message });
    }
  },

  fetchAvailableProducts: async (niche, excludeStoreId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await importCatalogService.getAvailableProducts(niche, excludeStoreId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ availableProducts: data as Product[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch available products';
      set({ isLoading: false, error: message });
    }
  },

  importProduct: async (importData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await importCatalogService.importProduct(importData);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        // code 23505 = unique constraint violation — product already imported
        const message = error.code === '23505'
          ? 'You have already imported this product'
          : error.message;
        return { success: false, error: message };
      }

      set((state) => ({ 
        imports: [data as ImportCatalogItem, ...state.imports],
        isLoading: false 
      }));

      // Notify the original product owner that someone imported their product
      if (importData.original_owner_id && importData.importer_store_id) {
        try {
          // Get the importer's store name for the notification message
          const { data: importerStore } = await supabase
            .from('stores')
            .select('name')
            .eq('id', importData.importer_store_id)
            .single();

          const importerName = importerStore?.name ?? 'Another store';

          await supabase.from('notifications').insert({
            user_id:  importData.original_owner_id,
            store_id: importData.original_store_id ?? null,
            type:     'product_imported',
            title:    '🛍️ Your product was imported!',
            message:  `${importerName} just imported "${importData.name}" into their store.`,
            data: {
              product_name:        importData.name,
              importer_store_id:   importData.importer_store_id,
              importer_name:       importerName,
              original_product_id: importData.original_product_id,
            },
            is_read: false,
          });
        } catch (notifErr) {
          // Non-fatal — import succeeded, notification failure shouldn't block the user
          console.error('Failed to send import notification:', notifErr);
        }
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import product';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  updateImport: async (importId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await importCatalogService.updateImport(importId, updates);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set((state) => ({
        imports: state.imports.map((i) => 
          i.id === importId ? { ...i, ...data } as ImportCatalogItem : i
        ),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update import';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  deleteImport: async (importId) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await importCatalogService.deleteImport(importId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set((state) => ({
        imports: state.imports.filter((i) => i.id !== importId),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete import';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ imports: [], availableProducts: [], error: null }),
}));

export default useImportStore;