import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/services/supabase';
import type { Product, Store } from '@/types';

// CartItem that matches CheckoutPage expectations (camelCase)
export interface CartItem {
  id: string;
  productId: string;        
  storeId: string;          
  storeName: string;        
  storeSlug: string;        
  name: string;             
  image?: string;           
  quantity: number;
  price: number;            
  unitPrice: number;        
  totalPrice: number;       
  variantOptions?: Record<string, string>; // e.g., { Color: "Red", Size: "Large" }
  addedAt: string;          
}

// Wishlist item matching database structure
export interface WishlistItem {
  id: string;
  productId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  productName: string;
  productImage?: string;
  price: number;
  addedAt: string;
}

interface CartStore {
  items: CartItem[];
  wishlist: WishlistItem[];
  wishlistProductIds: string[]; // Simple array for quick lookup
  isLoading: boolean;
  
  // Getters
  getItemsByStore: () => Record<string, CartItem[]>;
  getStoreCart: (storeSlug: string) => { items: CartItem[] };
  getStoreCount: () => number;
  getItemCount: () => number;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getStoreSubtotal: (storeId: string) => number;
  
  // Cart Actions
  addItem: (product: Product, store: Store, quantity?: number, variantOptions?: Record<string, string>, overridePrice?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  clearStoreCart: (storeId: string) => void;
  
  // Coupon validation
  validateCoupon: (code: string, storeId: string, subtotal: number) => Promise<{
    valid: boolean;
    discountAmount: number;
    message?: string;
  }>;
  
  // Sync with server
  syncWithServer: (customerId: string) => Promise<void>;
  saveToServer: (customerId: string) => Promise<void>;
  
  // Wishlist Actions (Database-integrated)
  addToWishlist: (product: Product, store: Store, customerId?: string) => Promise<void>;
  removeFromWishlist: (productId: string, customerId?: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  loadWishlist: (customerId: string) => Promise<void>;
  clearWishlist: () => void;
}

// Generate unique cart item ID
const generateCartItemId = () => `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      wishlist: [],
      wishlistProductIds: [],
      isLoading: false,

      getItemsByStore: () => {
        const { items } = get();
        return items.reduce((acc, item) => {
          if (!acc[item.storeId]) {
            acc[item.storeId] = [];
          }
          acc[item.storeId].push(item);
          return acc;
        }, {} as Record<string, CartItem[]>);
      },

      getStoreCart: (storeSlug: string) => {
        const { items } = get();
        return {
          items: items.filter(item => item.storeSlug === storeSlug)
        };
      },

      getStoreCount: () => {
        const { items } = get();
        return new Set(items.map(item => item.storeId)).size;
      },

      getItemCount: () => {
        return get().items.length;
      },

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.totalPrice, 0);
      },

      getStoreSubtotal: (storeId: string) => {
        return get().items
          .filter(item => item.storeId === storeId)
          .reduce((sum, item) => sum + item.totalPrice, 0);
      },

      addItem: (product, store, quantity = 1, variantOptions, overridePrice) => {
        const unitPrice = overridePrice ?? product.selling_price;
        set((state) => {
          // Check if same product already in cart from same store (and same variants)
          const existingItemIndex = state.items.findIndex(
            item => item.productId === product.id && 
                   item.storeId === store.id &&
                   JSON.stringify(item.variantOptions) === JSON.stringify(variantOptions)
          );

          if (existingItemIndex >= 0) {
            const updatedItems = [...state.items];
            const existingItem = updatedItems[existingItemIndex];
            const newQuantity = existingItem.quantity + quantity;
            updatedItems[existingItemIndex] = {
              ...existingItem,
              quantity: newQuantity,
              totalPrice: newQuantity * existingItem.unitPrice,
            };
            return { items: updatedItems };
          }

          const newItem: CartItem = {
            id: generateCartItemId(),
            productId: product.id,
            storeId: store.id,
            storeName: store.name,
            storeSlug: store.slug,
            name: product.name,
            image: product.images?.[0],
            quantity,
            unitPrice,
            price: unitPrice,
            totalPrice: unitPrice * quantity,
            variantOptions,
            addedAt: new Date().toISOString(),
          };

          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (cartItemId) => {
        set((state) => ({
          items: state.items.filter(item => item.id !== cartItemId),
        }));
      },

      updateQuantity: (cartItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }

        set((state) => ({
          items: state.items.map(item =>
            item.id === cartItemId
              ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
              : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      clearStoreCart: (storeId) => {
        set((state) => ({
          items: state.items.filter(item => item.storeId !== storeId),
        }));
      },

      validateCoupon: async (code: string, storeId: string, subtotal: number) => {
        try {
          const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('store_id', storeId)
            .eq('is_active', true)
            .single();

          if (error || !coupon) {
            return { valid: false, discountAmount: 0, message: 'Invalid coupon code' };
          }

          if (new Date(coupon.end_date) < new Date()) {
            return { valid: false, discountAmount: 0, message: 'Coupon has expired' };
          }

          if (coupon.start_date && new Date(coupon.start_date) > new Date()) {
            return { valid: false, discountAmount: 0, message: 'Coupon is not yet active' };
          }

          if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
            return { 
              valid: false, 
              discountAmount: 0, 
              message: `Minimum order of ₦${coupon.min_order_amount} required` 
            };
          }

          if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            return { valid: false, discountAmount: 0, message: 'Coupon usage limit reached' };
          }

          let discountAmount = 0;
          if (coupon.discount_type === 'percentage') {
            discountAmount = subtotal * (coupon.discount_value / 100);
            if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
              discountAmount = coupon.max_discount_amount;
            }
          } else {
            discountAmount = coupon.discount_value;
          }

          discountAmount = Math.min(discountAmount, subtotal);

          return { valid: true, discountAmount, message: 'Coupon applied successfully' };
        } catch (err) {
          console.error('Coupon validation error:', err);
          return { valid: false, discountAmount: 0, message: 'Failed to validate coupon' };
        }
      },

      syncWithServer: async (customerId) => {
        try {
          const { data, error } = await supabase
            .from('customer_carts')
            .select('items')
            .eq('customer_id', customerId)
            .single();

          if (data && !error && data.items) {
            set({ items: data.items as CartItem[] });
          }
        } catch (err) {
          console.error('Failed to sync cart:', err);
        }
      },

      saveToServer: async (customerId) => {
        try {
          const { items } = get();
          
          const { error } = await supabase
            .from('customer_carts')
            .upsert({
              customer_id: customerId,
              items,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'customer_id',
            });

          if (error) {
            console.error('Failed to save cart:', error);
          }
        } catch (err) {
          console.error('Failed to save cart:', err);
        }
      },

      // Wishlist with Database Integration
      addToWishlist: async (product, store, customerId) => {
        const newItem: WishlistItem = {
          id: `wish_${Date.now()}`,
          productId: product.id,
          storeId: store.id,
          storeName: store.name,
          storeSlug: store.slug,
          productName: product.name,
          productImage: product.images?.[0],
          price: product.selling_price,
          addedAt: new Date().toISOString(),
        };

        set((state) => ({
          wishlist: [...state.wishlist.filter(w => w.productId !== product.id), newItem],
          wishlistProductIds: [...new Set([...state.wishlistProductIds, product.id])],
        }));

        // Sync to database if logged in
        if (customerId) {
          try {
            await supabase
              .from('customer_wishlists')
              .upsert({
                customer_id: customerId,
                product_id: product.id,
                store_id: store.id,
              }, {
                onConflict: 'customer_id,product_id',
              });
          } catch (err) {
            console.error('Failed to sync wishlist to server:', err);
          }
        }
      },

      removeFromWishlist: async (productId, customerId) => {
        set((state) => ({
          wishlist: state.wishlist.filter(w => w.productId !== productId),
          wishlistProductIds: state.wishlistProductIds.filter(id => id !== productId),
        }));

        if (customerId) {
          try {
            await supabase
              .from('customer_wishlists')
              .delete()
              .eq('customer_id', customerId)
              .eq('product_id', productId);
          } catch (err) {
            console.error('Failed to remove from wishlist:', err);
          }
        }
      },

      isInWishlist: (productId) => {
        return get().wishlistProductIds.includes(productId);
      },

      loadWishlist: async (customerId) => {
        try {
          const { data, error } = await supabase
            .from('customer_wishlists')
            .select(`
              id,
              product_id,
              store_id,
              added_at,
              product:products(id, name, images, selling_price),
              store:stores(id, name, slug)
            `)
            .eq('customer_id', customerId);

          if (data && !error) {
            const formattedWishlist: WishlistItem[] = data.map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              storeId: item.store_id,
              storeName: item.store?.name || '',
              storeSlug: item.store?.slug || '',
              productName: item.product?.name || '',
              productImage: item.product?.images?.[0],
              price: item.product?.selling_price || 0,
              addedAt: item.added_at,
            }));

            set({
              wishlist: formattedWishlist,
              wishlistProductIds: formattedWishlist.map(w => w.productId),
            });
          }
        } catch (err) {
          console.error('Failed to load wishlist:', err);
        }
      },

      clearWishlist: () => {
        set({ wishlist: [], wishlistProductIds: [] });
      },
    }),
    {
      name: 'qafrica-universal-cart',
      partialize: (state) => ({ 
        items: state.items,
        wishlist: state.wishlist,
        wishlistProductIds: state.wishlistProductIds,
      }),
    }
  )
);

export default useCartStore;