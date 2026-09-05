import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  removeItem: (cartKey: string) => void;
  clearCart: () => void;
}

export const useImportCartStore = create<ImportCartState>()(
  persist(
    (set) => ({
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

      removeItem: (cartKey) => {
        set(state => ({ cart: state.cart.filter(i => i.cart_key !== cartKey) }));
      },

      clearCart: () => set({ cart: [] }),
    }),
    { name: 'qafrica-import-cart' }
  )
);
