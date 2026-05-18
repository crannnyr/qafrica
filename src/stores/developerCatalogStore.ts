// src/stores/developerCatalogStore.ts
import { create } from 'zustand';
import {
  developerProductService,
  developerImportService,
} from '@/services/developer';
import type {
  CatalogProduct,
  DeveloperImport,
  InboundProductFormData,
  PaginatedResponse,
} from '@/types/developer';

// ── Filter shape (what the CatalogPage passes to fetchCatalog) ─
export interface CatalogFilters {
  niche?:     string;
  category?:  string;
  subcategory?: string;
  search?:    string;
  min_price?: number;
  max_price?: number;
  in_stock?:  boolean;
  page?:      number;
  limit?:     number;
}

// ── State shape ───────────────────────────────────────────────
interface DeveloperCatalogState {
  // ── Browsable catalog ─────────────────────────────────────────
  catalogProducts:  CatalogProduct[];
  catalogPage:      number;
  catalogTotal:     number;
  catalogPages:     number;
  catalogLoading:   boolean;
  catalogError:     string | null;
  // Last-used filters — preserved so the user's filter state survives
  // navigation between catalog and import pages.
  catalogFilters:   CatalogFilters;

  // ── Available niches (for filter sidebar) ────────────────────
  niches:        { id: string; importable_product_count: number }[];
  nichesLoading: boolean;

  // ── Developer's import catalog ───────────────────────────────
  imports:         DeveloperImport[];
  importsPage:     number;
  importsTotal:    number;
  importsPages:    number;
  importsLoading:  boolean;
  importsError:    string | null;
  // Set of imported product IDs — used by CatalogPage to show "Imported" badge
  importedProductIds: Set<string>;

  // ── Inbound products (developer pushed into QAFRICA) ─────────
  inboundProducts:        CatalogProduct[];
  inboundPage:            number;
  inboundTotal:           number;
  inboundLoading:         boolean;
  inboundError:           string | null;

  // ── Per-action loading states (for individual buttons) ───────
  importingId:    string | null;   // product_id being imported right now
  removingId:     string | null;   // import id being removed right now
  updatingId:     string | null;   // import id being updated right now

  // ── Actions: Catalog ─────────────────────────────────────────
  fetchCatalog:  (filters?: CatalogFilters) => Promise<void>;
  fetchNiches:   () => Promise<void>;
  setFilters:    (filters: CatalogFilters) => void;
  resetFilters:  () => void;

  // ── Actions: Imports ─────────────────────────────────────────
  fetchImports:      (page?: number) => Promise<void>;
  importProduct:     (productId: string, customSellingPrice?: number) => Promise<{ success: boolean; error?: string }>;
  updateImport:      (importId: string, updates: { custom_selling_price?: number; is_active?: boolean }) => Promise<{ success: boolean; error?: string }>;
  removeImport:      (importId: string) => Promise<{ success: boolean; error?: string }>;

  // ── Actions: Inbound products ────────────────────────────────
  fetchInboundProducts: (page?: number) => Promise<void>;
  createInboundProduct: (data: InboundProductFormData) => Promise<{ success: boolean; error?: string; productId?: string }>;
  updateInboundProduct: (productId: string, updates: Partial<InboundProductFormData>) => Promise<{ success: boolean; error?: string }>;
  updateInboundStock:   (productId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
  deactivateInboundProduct: (productId: string) => Promise<{ success: boolean; error?: string }>;

  // ── Utils ────────────────────────────────────────────────────
  clearErrors: () => void;
  reset:       () => void;
}

const DEFAULT_FILTERS: CatalogFilters = {
  page:  1,
  limit: 24,
};

// ── Store ─────────────────────────────────────────────────────
export const useDeveloperCatalogStore = create<DeveloperCatalogState>()(
  (set, get) => ({
    // ── Initial state ───────────────────────────────────────────
    catalogProducts:  [],
    catalogPage:      1,
    catalogTotal:     0,
    catalogPages:     1,
    catalogLoading:   false,
    catalogError:     null,
    catalogFilters:   DEFAULT_FILTERS,

    niches:        [],
    nichesLoading: false,

    imports:         [],
    importsPage:     1,
    importsTotal:    0,
    importsPages:    1,
    importsLoading:  false,
    importsError:    null,
    importedProductIds: new Set(),

    inboundProducts: [],
    inboundPage:     1,
    inboundTotal:    0,
    inboundLoading:  false,
    inboundError:    null,

    importingId: null,
    removingId:  null,
    updatingId:  null,

    // ════════════════════════════════════════════════════════════
    // CATALOG
    // ════════════════════════════════════════════════════════════

    fetchCatalog: async (filters) => {
      // Merge with existing filters so partial updates work
      const merged: CatalogFilters = {
        ...get().catalogFilters,
        ...filters,
      };

      set({ catalogLoading: true, catalogError: null, catalogFilters: merged });

      try {
        const result: PaginatedResponse<CatalogProduct> =
          await developerProductService.getCatalog(merged);

        set({
          catalogProducts: result.data,
          catalogPage:     result.meta.page,
          catalogTotal:    result.meta.total,
          catalogPages:    result.meta.pages,
          catalogLoading:  false,
        });
      } catch (err: any) {
        const message = err?.message ?? 'Failed to load product catalog.';
        set({ catalogLoading: false, catalogError: message });
      }
    },

    fetchNiches: async () => {
      set({ nichesLoading: true });
      try {
        const result = await developerProductService.getNiches();
        set({ niches: result.data, nichesLoading: false });
      } catch (err) {
        console.error('[CatalogStore] fetchNiches error:', err);
        set({ nichesLoading: false });
      }
    },

    setFilters: (filters) => {
      set((state) => ({
        catalogFilters: { ...state.catalogFilters, ...filters },
      }));
    },

    resetFilters: () => {
      set({ catalogFilters: DEFAULT_FILTERS });
    },

    // ════════════════════════════════════════════════════════════
    // IMPORTS
    // ════════════════════════════════════════════════════════════

    fetchImports: async (page = 1) => {
      set({ importsLoading: true, importsError: null });
      try {
        const result: PaginatedResponse<DeveloperImport> =
          await developerImportService.listImports(page, 20);

        // Build a Set of original_product_id values for quick lookup
        const importedProductIds = new Set(
          result.data
            .map((imp) => imp.original_product?.id)
            .filter(Boolean) as string[],
        );

        set({
          imports:            result.data,
          importsPage:        result.meta.page,
          importsTotal:       result.meta.total,
          importsPages:       result.meta.pages,
          importedProductIds,
          importsLoading:     false,
        });
      } catch (err: any) {
        const message = err?.message ?? 'Failed to load imports.';
        set({ importsLoading: false, importsError: message });
      }
    },

    importProduct: async (productId, customSellingPrice) => {
      set({ importingId: productId });
      try {
        const result = await developerImportService.importProduct(productId, customSellingPrice);

        // Add to imports list
        set((state) => ({
          imports:            [result.data, ...state.imports],
          importsTotal:       state.importsTotal + 1,
          importedProductIds: new Set([...state.importedProductIds, productId]),
          importingId:        null,
        }));

        // Also increment import_count on the catalog product (optimistic)
        set((state) => ({
          catalogProducts: state.catalogProducts.map((p) =>
            p.id === productId
              ? { ...p, import_count: p.import_count + 1 }
              : p,
          ),
        }));

        return { success: true };
      } catch (err: any) {
        const message = err?.message ?? 'Failed to import product.';
        set({ importingId: null });
        return { success: false, error: message };
      }
    },

    updateImport: async (importId, updates) => {
      set({ updatingId: importId });
      try {
        const result = await developerImportService.updateImport(importId, updates);

        set((state) => ({
          imports: state.imports.map((imp) =>
            imp.id === importId
              ? { ...imp, ...result.data }
              : imp,
          ),
          updatingId: null,
        }));

        return { success: true };
      } catch (err: any) {
        const message = err?.message ?? 'Failed to update import.';
        set({ updatingId: null });
        return { success: false, error: message };
      }
    },

    removeImport: async (importId) => {
      set({ removingId: importId });

      // Find the product ID before removing (to update importedProductIds)
      const importRecord = get().imports.find((imp) => imp.id === importId);
      const productId    = importRecord?.original_product?.id;

      // Optimistic remove
      const previousImports = get().imports;
      set((state) => ({
        imports:      state.imports.filter((imp) => imp.id !== importId),
        importsTotal: Math.max(0, state.importsTotal - 1),
      }));

      try {
        await developerImportService.removeImport(importId);

        // Remove from importedProductIds set
        if (productId) {
          set((state) => {
            const next = new Set(state.importedProductIds);
            next.delete(productId);
            return { importedProductIds: next, removingId: null };
          });
        } else {
          set({ removingId: null });
        }

        return { success: true };
      } catch (err: any) {
        // Rollback
        set({ imports: previousImports, removingId: null });
        const message = err?.message ?? 'Failed to remove import.';
        return { success: false, error: message };
      }
    },

    // ════════════════════════════════════════════════════════════
    // INBOUND PRODUCTS (developer pushed into QAFRICA)
    // ════════════════════════════════════════════════════════════

    fetchInboundProducts: async (page = 1) => {
      set({ inboundLoading: true, inboundError: null });
      try {
        // Inbound products live in the catalog as regular products
        // belonging to the developer's shadow store.
        // We fetch them via the catalog endpoint filtered by shadow store,
        // but since the API doesn't expose that filter directly we use
        // the developer's own product management endpoint.
        const result = await developerProductService.getCatalog({
          page,
          limit: 20,
        });

        set({
          inboundProducts: result.data,
          inboundPage:     result.meta.page,
          inboundTotal:    result.meta.total,
          inboundLoading:  false,
        });
      } catch (err: any) {
        const message = err?.message ?? 'Failed to load your products.';
        set({ inboundLoading: false, inboundError: message });
      }
    },

    createInboundProduct: async (data) => {
      set({ inboundLoading: true, inboundError: null });
      try {
        const result = await developerProductService.createProduct(data);

        set((state) => ({
          inboundProducts: [result.data, ...state.inboundProducts],
          inboundTotal:    state.inboundTotal + 1,
          inboundLoading:  false,
        }));

        return { success: true, productId: result.data.id };
      } catch (err: any) {
        const message = err?.message ?? 'Failed to create product.';
        set({ inboundLoading: false, inboundError: message });
        return { success: false, error: message };
      }
    },

    updateInboundProduct: async (productId, updates) => {
      try {
        const result = await developerProductService.updateProduct(productId, updates);

        set((state) => ({
          inboundProducts: state.inboundProducts.map((p) =>
            p.id === productId ? { ...p, ...result.data } : p,
          ),
        }));

        return { success: true };
      } catch (err: any) {
        const message = err?.message ?? 'Failed to update product.';
        return { success: false, error: message };
      }
    },

    updateInboundStock: async (productId, quantity) => {
      try {
        await developerProductService.updateStock(productId, quantity);

        set((state) => ({
          inboundProducts: state.inboundProducts.map((p) =>
            p.id === productId
              ? { ...p, stock_quantity: quantity, is_out_of_stock: quantity === 0 }
              : p,
          ),
        }));

        return { success: true };
      } catch (err: any) {
        const message = err?.message ?? 'Failed to update stock.';
        return { success: false, error: message };
      }
    },

    deactivateInboundProduct: async (productId) => {
      // Optimistic
      const previous = get().inboundProducts;
      set((state) => ({
        inboundProducts: state.inboundProducts.filter((p) => p.id !== productId),
        inboundTotal:    Math.max(0, state.inboundTotal - 1),
      }));

      try {
        await developerProductService.deactivateProduct(productId);
        return { success: true };
      } catch (err: any) {
        set({ inboundProducts: previous });
        const message = err?.message ?? 'Failed to deactivate product.';
        return { success: false, error: message };
      }
    },

    // ── Utils ────────────────────────────────────────────────────
    clearErrors: () =>
      set({ catalogError: null, importsError: null, inboundError: null }),

    reset: () =>
      set({
        catalogProducts:    [],
        catalogPage:        1,
        catalogTotal:       0,
        catalogPages:       1,
        catalogLoading:     false,
        catalogError:       null,
        catalogFilters:     DEFAULT_FILTERS,
        niches:             [],
        nichesLoading:      false,
        imports:            [],
        importsPage:        1,
        importsTotal:       0,
        importsPages:       1,
        importsLoading:     false,
        importsError:       null,
        importedProductIds: new Set(),
        inboundProducts:    [],
        inboundPage:        1,
        inboundTotal:       0,
        inboundLoading:     false,
        inboundError:       null,
        importingId:        null,
        removingId:         null,
        updatingId:         null,
      }),
  }),
);

export default useDeveloperCatalogStore;