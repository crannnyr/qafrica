import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/services';
import CONFIG from '@/lib/config';

const IMPORT_PRODUCTS_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import?action=products`;

// ── Types (mirrors RecommendationsPage's local types, kept here so both
// RecommendationsPage and ProductDetailPage share one cart instead of each
// keeping their own local useState — that split was the root cause of the
// product detail page needing to redirect to the catalog just to reach the
// cart, and could silently drop items when the two got out of sync). ──────
export interface VariantGroup {
  id: string;
  name: string;
  options: string[];
  price_deltas?: Record<string, number>;
}

export interface ImportProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  image_urls?: string[];
  price_cny: number;
  price_ngn: number;
  price_usd?: number;
  category: string;
  moq: number;
  has_variants?: boolean;
  variants?: VariantGroup[];
  units_sold?: number;
  /** Sea freight only. Carried into the cart so checkout can force the
   *  shipping method without re-fetching the product. */
  ship_only?: boolean;
  /** Volume/weight and their derived per-unit shipping costs — set by the
   *  admin, carried into the cart so checkout can compute shipping without
   *  re-fetching the product. */
  volume_cbm?: number | null;
  weight_grams?: number | null;
  sea_shipping_cost_ngn?: number | null;
  flight_shipping_cost_ngn?: number | null;
}

export interface ImportCartItem extends ImportProduct {
  quantity: number;
  variant_selection?: Record<string, string>;
  cart_key: string;
}

export function buildImportCartKey(productId: string, selection?: Record<string, string>) {
  if (!selection || Object.keys(selection).length === 0) return productId;
  const sorted = Object.keys(selection).sort().map(k => `${k}:${selection[k]}`).join('|');
  return `${productId}::${sorted}`;
}

interface ImportCartState {
  cart: ImportCartItem[];
  addToCart: (product: ImportProduct, quantity: number, priceNgn: number, variantSelection?: Record<string, string>) => void;
  addOne: (cartKey: string) => void;
  removeOne: (cartKey: string, moq: number) => void;
  /** Typed quantity, not a +/- nudge. 0 or a non-finite value removes the
   *  item; anything else clamps up to at least the product's MOQ. */
  setQuantity: (cartKey: string, quantity: number, moq: number) => void;
  removeItem: (cartKey: string) => void;
  clearCart: () => void;
  /** Re-prices every cart line from the live catalogue. The cart stores a
   *  snapshot of each product, so without this a price change in admin left
   *  the cart showing the old price while checkout charged the new one. */
  refreshPrices: () => Promise<void>;
  syncWithServer: (customerId: string) => Promise<void>;
  saveToServer: (customerId: string) => Promise<void>;
}

export const useImportCartStore = create<ImportCartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (product, quantity, priceNgn, variantSelection) => {
        const cart_key = buildImportCartKey(product.id, variantSelection);
        set(state => {
          const existing = state.cart.find(i => i.cart_key === cart_key);
          if (existing) {
            return {
              cart: state.cart.map(i =>
                i.cart_key === cart_key ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          return {
            cart: [
              ...state.cart,
              { ...product, price_ngn: priceNgn, quantity, variant_selection: variantSelection, cart_key },
            ],
          };
        });
      },

      addOne: (cartKey) => {
        set(state => ({
          cart: state.cart.map(i => i.cart_key === cartKey ? { ...i, quantity: i.quantity + 1 } : i),
        }));
      },

      removeOne: (cartKey, moq) => {
        set(state => {
          const item = state.cart.find(i => i.cart_key === cartKey);
          if (!item) return state;
          if (item.quantity <= moq) {
            return { cart: state.cart.filter(i => i.cart_key !== cartKey) };
          }
          return {
            cart: state.cart.map(i => i.cart_key === cartKey ? { ...i, quantity: i.quantity - 1 } : i),
          };
        });
      },

      setQuantity: (cartKey, quantity, moq) => {
        set(state => {
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return { cart: state.cart.filter(i => i.cart_key !== cartKey) };
          }
          const clamped = Math.max(moq, Math.floor(quantity));
          return {
            cart: state.cart.map(i => i.cart_key === cartKey ? { ...i, quantity: clamped } : i),
          };
        });
      },

      removeItem: (cartKey) => {
        set(state => ({ cart: state.cart.filter(i => i.cart_key !== cartKey) }));
      },

      clearCart: () => set({ cart: [] }),

      refreshPrices: async () => {
        if (get().cart.length === 0) return;
        try {
          const res = await fetch(IMPORT_PRODUCTS_URL);
          const data = await res.json().catch(() => ({}));
          const list: ImportProduct[] = Array.isArray(data?.products) ? data.products : [];
          if (!res.ok || list.length === 0) return;
          const live = new Map(list.map(p => [p.id, p]));
          set(state => {
            let changed = false;
            const cart = state.cart.map(item => {
              const p = live.get(item.id);
              if (!p || !Number.isFinite(Number(p.price_ngn))) return item;
              let price = Number(p.price_ngn);
              for (const group of p.variants ?? []) {
                const selected = item.variant_selection?.[group.name];
                const delta = selected == null ? undefined : group.price_deltas?.[selected];
                if (typeof delta === 'number') price += delta;
              }
              if (price === Number(item.price_ngn) && p.ship_only === item.ship_only) return item;
              changed = true;
              return {
                ...item,
                price_ngn: price,
                price_cny: p.price_cny,
                price_usd: p.price_usd,
                category: p.category,
                variants: p.variants,
                has_variants: p.has_variants,
                ship_only: p.ship_only,
                sea_shipping_cost_ngn: p.sea_shipping_cost_ngn,
                flight_shipping_cost_ngn: p.flight_shipping_cost_ngn,
              };
            });
            return changed ? { cart } : state;
          });
        } catch (err) {
          console.error('Failed to refresh import cart prices:', err);
        }
      },

      syncWithServer: async (customerId) => {
        try {
          const { data, error } = await supabase
            .from('import_customer_carts')
            .select('items')
            .eq('customer_id', customerId)
            .maybeSingle();
          if (!error && data?.items && Array.isArray(data.items)) {
            set({ cart: data.items as ImportCartItem[] });
          }
        } catch (err) {
          console.error('Failed to sync import cart:', err);
        }
        await get().refreshPrices();
      },

      saveToServer: async (customerId) => {
        try {
          const { cart } = get();
          const { error } = await supabase
            .from('import_customer_carts')
            .upsert({
              customer_id: customerId,
              items: cart,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'customer_id' });
          if (error) console.error('Failed to save import cart:', error);
        } catch (err) {
          console.error('Failed to save import cart:', err);
        }
      },
    }),
    { name: 'qafrica-import-cart' }
  )
);
