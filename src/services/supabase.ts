import { createClient } from '@supabase/supabase-js';
import CONFIG from '@/lib/config';
import { compressImage } from '@/lib/imageCompression';
import type { 
  User, Store, Product, Order, 
  Subscription, Notification, ImportCatalogItem,
  WithdrawalRequest, DeliveryZone, AdCampaign,
  TaxSettings, BusinessExpense, TaxReport, Review, ReviewSummary,
  // FIX: Import new dropship types
  DropshipOrderView
} from '@/types';

// Create Supabase client
export const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'Accept': 'application/json',
      },
    },
  }
);

// Auth Services
export const authService = {
  async signUp(email: string, password: string, userData: Partial<User>) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });
    return { data, error };
  },

  async signUpWithOtp(email: string, password: string, userData: Partial<User>) {
    // First sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });

    if (error) return { data, error };

    // Send OTP email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    return { data, error: otpError };
  },

  async verifyOtp(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { data, error };
  },

  async resendOtp(email: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },

  // Password Reset
  async sendPasswordResetEmail(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { data, error };
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  },
};

// User Services
export const userService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateProfile(userId: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

// Store Services
export const storeService = {
  async createStore(storeData: Partial<Store>) {
    const { data, error } = await supabase
      .from('stores')
      .insert(storeData)
      .select()
      .single();
    return { data, error };
  },

  async getStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    return { data, error };
  },

  async getStoreBySlug(slug: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();
    return { data, error };
  },

  async getUserStore(userId: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', userId)
      .single();
    return { data, error };
  },

  async updateStore(storeId: string, updates: Partial<Store>) {
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async getAllStores() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async blockStore(storeId: string, reason: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_blocked: true, block_reason: reason })
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async unblockStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_blocked: false, block_reason: null })
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },
};

// Product Services
export const productService = {
  async createProduct(productData: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();
    return { data, error };
  },

  async getProduct(productId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    return { data, error };
  },

  async getStoreProducts(storeId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getProductsByNiche(niche: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('niche', niche)
      .eq('is_importable', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateProduct(productId: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();
    return { data, error };
  },

  async deleteProduct(productId: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    return { error };
  },

  async getAllProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

// Import Catalog Services
export const importCatalogService = {
  async importProduct(importData: Partial<ImportCatalogItem>) {
    const { data, error } = await supabase
      .from('import_catalog')
      .insert(importData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreImports(storeId: string) {
    const { data, error } = await supabase
      .from('import_catalog')
      .select('*, original_product:products(*)')
      .eq('importer_store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // Legacy method - keep for backwards compatibility
  async getAvailableProducts(niche: string, excludeStoreId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('niche', niche)
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // NEW: Get products from specific niches (for "My Niches" filter)
  async getAvailableProductsByNiches(niches: string[], excludeStoreId: string) {
    if (niches.length === 0) return { data: [], error: null };
    
    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(group_chat_url)')
      .in('niche', niches)
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // NEW: Get products excluding certain niches (for "Other Niches" filter)
  async getAvailableProductsExcludingNiches(excludeNiches: string[], excludeStoreId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(group_chat_url)')
      .not('niche', 'in', `(${excludeNiches.join(',')})`)
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // NEW: Get all available products (for "All" filter or unlimited plans)
  async getAllAvailableProducts(excludeStoreId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(group_chat_url)')
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateImport(importId: string, updates: Partial<ImportCatalogItem>) {
    const { data, error } = await supabase
      .from('import_catalog')
      .update(updates)
      .eq('id', importId)
      .select()
      .single();
    return { data, error };
  },

  async deleteImport(importId: string) {
    const { error } = await supabase
      .from('import_catalog')
      .delete()
      .eq('id', importId);
    return { error };
  },
};

// Order Services
export const orderService = {
  async createOrder(orderData: Partial<Order>) {
    if (!orderData.items) {
      return { data: null, error: { message: 'Order items are required' } };
    }
  
    for (const item of orderData.items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .single();
  
      if (productError || !product) {
        return { data: null, error: productError || { message: 'Product not found' } };
      }
  
      const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
  
      await productService.updateProduct(item.product_id, {
        stock_quantity: newStock,
      });
    }
  
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
  
    return { data, error };
  },

  async getOrder(orderId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', orderId)
      .single();
    return { data, error };
  },

  // FIX: Now fetches BOTH direct orders (store_id match) AND orders where this
  // store's products appear as dropshipped items (original_store_id match).
  // Results are merged and deduplicated by order id.
  async getStoreOrders(storeId: string) {
    // Get orders where this store is the direct seller
    const { data: directOrders, error: directError } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (directError) return { data: null, error: directError };

    // Get orders where this store's products were dropshipped by another store.
    // We query order_items filtered by original_store_id, then join up to the
    // parent order (including all its items for display purposes).
 const { data: dropshipRows } = await supabase
  .from('order_items')
  .select('order:orders(*, items:order_items(*))')
  .eq('original_store_id', storeId)
  .eq('is_imported', true);
// Non-fatal: direct orders still return even if this path fails or returns empty

    // Merge and deduplicate by order id
    const allOrders = [
      ...(directOrders || []),
      ...(dropshipRows?.map((row: any) => row.order).filter(Boolean) || []),
    ];

    const uniqueOrders = allOrders.filter(
      (order, index, self) => index === self.findIndex((o) => o.id === order.id)
    );

    // Sort merged list by created_at descending
    uniqueOrders.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { data: uniqueOrders, error: null };
  },

  // FIX: Dedicated view for original product owners — returns DropshipOrderView[]
  // so they can see every order in which their products were sold by a dropshipper.
  async getDropshipOrdersForStore(storeId: string) {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        order:orders(
          id, order_number, store_id, customer_name, customer_email,
          customer_phone, delivery_address, delivery_state, status,
          payment_status, created_at, tracking_number, is_escrow_released,
          delivered_at,
          items:order_items(*)
        ),
        product_name,
        quantity,
        dropship_price,
        unit_price,
        total_price,
        is_imported,
        original_owner_id,
        original_store_id
      `)
      .eq('original_store_id', storeId)
      .eq('is_imported', true)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    // Transform raw rows into DropshipOrderView[]
    const transformed: DropshipOrderView[] = (data || []).map((item: any) => ({
      order_id: item.order.id,
      order_number: item.order.order_number,
      dropshipper_store_id: item.order.store_id,
      dropshipper_store_name: '', // Enriched by caller if needed
      customer_name: item.order.customer_name,
      customer_email: item.order.customer_email,
      customer_phone: item.order.customer_phone,
      delivery_address: item.order.delivery_address,
      delivery_state: item.order.delivery_state,
      status: item.order.status,
      payment_status: item.order.payment_status,
      created_at: item.order.created_at,
      items: item.order.items,
      total_dropship_price: (item.dropship_price ?? 0) * item.quantity,
      total_quantity: item.quantity,
      tracking_number: item.order.tracking_number,
      is_escrow_released: item.order.is_escrow_released,
      delivered_at: item.order.delivered_at,
    }));

    return { data: transformed, error: null };
  },

  // FIX: Allows original product owners to advance the status of an order that
  // contains their dropshipped items — after verifying they actually have items
  // in that order before touching the orders table.
  async updateDropshipOrderStatus(
    orderId: string,
    originalStoreId: string,
    status: Order['status']
  ) {
    // Verify this store has dropshipped items in this order
    const { data: items, error: verifyError } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .eq('original_store_id', originalStoreId)
      .eq('is_imported', true);

    if (verifyError) return { data: null, error: verifyError };
    if (!items || items.length === 0) {
      return {
        data: null,
        error: { message: 'No dropshipped items found for this store in this order' },
      };
    }

    // Update order status
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    return { data, error };
  },

  async getUserOrders(userId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // FIX: Added ownership validation — confirms the calling user actually owns
  // the store attached to this order before allowing a status mutation.
  async updateOrderStatus(
    orderId: string,
    status: Order['status'] | string,
    additionalData?: Record<string, any>
  ) {
    // Confirm the current user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    // Look up which store this order belongs to
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('store_id')
      .eq('id', orderId)
      .single();

    if (orderError) return { data: null, error: orderError };

    // Verify the authenticated user owns that store
    const { data: store } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', order.store_id)
      .single();

    if (store?.owner_id !== user.id) {
      return { data: null, error: { message: 'Unauthorized: You do not own this order' } };
    }

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (additionalData) {
      Object.assign(updates, additionalData);
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    return { data, error };
  },

  async confirmDelivery(orderId: string) {
    // Call the DB function which handles wallet release atomically
    const { error } = await supabase.rpc('release_escrow_funds', { p_order_id: orderId });
    if (error) return { data: null, error };
    
    const { data, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivery_confirmed_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();
    return { data, error: updateError };
  },

  async getAllOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

// Wallet Services
export const walletService = {
  async getWallet(userId: string) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  async createWallet(userId: string) {
    const { data, error } = await supabase
      .from('wallets')
      .insert({ user_id: userId, balance: 0, total_earned: 0, total_withdrawn: 0, pending_balance: 0 })
      .select()
      .single();
    return { data, error };
  },

  async creditWallet(userId: string, amount: number, description: string, reference?: string) {
    const { data: wallet, error: walletError } = await this.getWallet(userId);
    if (walletError) return { error: walletError };

    const newBalance = wallet.balance + amount;
    const newTotalEarned = wallet.total_earned + amount;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ 
        balance: newBalance, 
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) return { error: updateError };

    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: userId,
        type: 'credit',
        amount,
        balance_after: newBalance,
        description,
        reference,
        status: 'completed',
      })
      .select()
      .single();

    return { data: transaction, error: transactionError };
  },

  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

// Withdrawal Services
export const withdrawalService = {
  async createRequest(requestData: Partial<WithdrawalRequest>) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert(requestData)
      .select()
      .single();
    return { data, error };
  },

  async getUserRequests(userId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getPendingRequests() {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*, user:profiles(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async approveRequest(requestId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'approved' })
      .eq('id', requestId)
      .select()
      .single();
    return { data, error };
  },

  async markAsPaid(requestId: string, adminId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({ 
        status: 'paid', 
        paid_at: new Date().toISOString(),
        paid_by: adminId 
      })
      .eq('id', requestId)
      .select()
      .single();
    return { data, error };
  },
};

// Subscription Services
export const subscriptionService = {
  async createSubscription(subData: Partial<Subscription>) {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subData)
      .select()
      .single();
    return { data, error };
  },

  // NEW: Get active trial for user
  async getActiveTrial(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_trial', true)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  // NEW: Check if user has any active subscription (trial or paid)
  async getActiveSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  // NEW: Deactivate expired trials (called by edge function or frontend)
  async deactivateExpiredTrials() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('is_trial', true)
      .eq('is_active', true)
      .lt('expires_at', now)
      .select();
    return { data, error };
  },

  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  async getAllSubscriptions() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, user:profiles(*), store:stores(*)')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

// Delivery Zone Services
export const deliveryZoneService = {
  async createZone(zoneData: Partial<DeliveryZone>) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert(zoneData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreZones(storeId: string) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('store_id', storeId)
      .order('state');
    return { data, error };
  },

  async updateZone(zoneId: string, updates: Partial<DeliveryZone>) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .update(updates)
      .eq('id', zoneId)
      .select()
      .single();
    return { data, error };
  },

  async deleteZone(zoneId: string) {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', zoneId);
    return { error };
  },
};

// Notification Services
export const notificationService = {
  async createNotification(notificationData: Partial<Notification>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
    return { data, error };
  },

  async getUserNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single();
    return { data, error };
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return { error };
  },
};

// Ad Campaign Services
export const adCampaignService = {
  async createCampaign(campaignData: Partial<AdCampaign>) {
    const { data, error } = await supabase
      .from('ad_campaigns')
      .insert(campaignData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreCampaigns(storeId: string) {
    const { data, error } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateCampaign(campaignId: string, updates: Partial<AdCampaign>) {
    const { data, error } = await supabase
      .from('ad_campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single();
    return { data, error };
  },
};

// Admin Services
export const adminService = {
  async getDashboardStats() {
    const { data, error } = await supabase
      .rpc('get_admin_dashboard_stats');
    return { data, error };
  },

  async getPendingVerifications() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_verified', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async verifyStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_verified: true })
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async logAction(adminId: string, actionType: string, targetType: string, targetId: string, details: string) {
    const { data, error } = await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        details,
      })
      .select()
      .single();
    return { data, error };
  },
};

// Stock Alert Services
export const stockAlertService = {
  async getAlerts(ownerId: string) {
    const { data, error } = await supabase
      .rpc('get_stock_alerts', { p_owner_id: ownerId });
    return { data, error };
  },

  async getUnreadAlerts(ownerId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select('*, product:products(*)')
      .eq('owner_id', ownerId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(alertId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', alertId)
      .select()
      .single();
    return { data, error };
  },

  async markAllAsRead(ownerId: string) {
    const { error } = await supabase
      .from('stock_alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('is_read', false);
    return { error };
  },

  async getAlertCount(ownerId: string) {
    const { count, error } = await supabase
      .from('stock_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('is_read', false);
    return { count, error };
  },
};

// Product Earnings Services
export const productEarningsService = {
  async getEarningsSummary(storeId: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase
      .rpc('get_product_earnings_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    return { data, error };
  },

  async getProductEarnings(productId: string) {
    const { data, error } = await supabase
      .from('product_earnings')
      .select('*')
      .eq('product_id', productId)
      .order('earned_at', { ascending: false });
    return { data, error };
  },

  async getStoreEarnings(storeId: string, limit: number = 100) {
    const { data, error } = await supabase
      .from('product_earnings')
      .select('*, product:products(name, images)')
      .eq('store_id', storeId)
      .order('earned_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  async getTotalEarnings(storeId: string) {
    const { data, error } = await supabase
      .from('product_earnings')
      .select('total_revenue, total_cost, profit, net_profit')
      .eq('store_id', storeId);
    
    if (error) return { data: null, error };

    const totals = (data || []).reduce(
      (acc, curr) => ({
        total_revenue: acc.total_revenue + (curr.total_revenue || 0),
        total_cost: acc.total_cost + (curr.total_cost || 0),
        total_profit: acc.total_profit + (curr.profit || 0),
        total_net_profit: acc.total_net_profit + (curr.net_profit || 0),
      }),
      { total_revenue: 0, total_cost: 0, total_profit: 0, total_net_profit: 0 }
    );

    return { data: totals, error: null };
  },
};

// Tax Settings Services
export const taxService = {
  async getTaxSettings(storeId: string) {
    const { data, error } = await supabase
      .from('tax_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    return { data, error };
  },

  async createTaxSettings(settingsData: Partial<TaxSettings>) {
    const { data, error } = await supabase
      .from('tax_settings')
      .insert(settingsData)
      .select()
      .single();
    return { data, error };
  },

  async updateTaxSettings(storeId: string, updates: Partial<TaxSettings>) {
    const { data, error } = await supabase
      .from('tax_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async calculateTax(storeId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .rpc('calculate_tax_for_period', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    return { data, error };
  },
};

// Business Expenses Services
export const expenseService = {
  async createExpense(expenseData: Partial<BusinessExpense>) {
    const { data, error } = await supabase
      .from('business_expenses')
      .insert(expenseData)
      .select()
      .single();
    return { data, error };
  },

  async getExpenses(storeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('business_expenses')
      .select('*')
      .eq('store_id', storeId)
      .order('expense_date', { ascending: false });

    if (startDate) {
      query = query.gte('expense_date', startDate);
    }
    if (endDate) {
      query = query.lte('expense_date', endDate);
    }

    const { data, error } = await query;
    return { data, error };
  },

  async updateExpense(expenseId: string, updates: Partial<BusinessExpense>) {
    const { data, error } = await supabase
      .from('business_expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', expenseId)
      .select()
      .single();
    return { data, error };
  },

  async deleteExpense(expenseId: string) {
    const { error } = await supabase
      .from('business_expenses')
      .delete()
      .eq('id', expenseId);
    return { error };
  },

  async getExpenseCategoriesSummary(storeId: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase
      .rpc('get_expense_categories_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    return { data, error };
  },

  async getTotalExpenses(storeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('business_expenses')
      .select('amount')
      .eq('store_id', storeId);

    if (startDate) {
      query = query.gte('expense_date', startDate);
    }
    if (endDate) {
      query = query.lte('expense_date', endDate);
    }

    const { data, error } = await query;
    
    if (error) return { total: 0, error };
    
    const total = (data || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    return { total, error: null };
  },
};

// Tax Reports Services
export const taxReportService = {
  async createReport(reportData: Partial<TaxReport>) {
    const { data, error } = await supabase
      .from('tax_reports')
      .insert(reportData)
      .select()
      .single();
    return { data, error };
  },

  async getReports(storeId: string) {
    const { data, error } = await supabase
      .from('tax_reports')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getReport(reportId: string) {
    const { data, error } = await supabase
      .from('tax_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    return { data, error };
  },

  async deleteReport(reportId: string) {
    const { error } = await supabase
      .from('tax_reports')
      .delete()
      .eq('id', reportId);
    return { error };
  },
};

// Storage Services
export const storageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
    return { data, error };
  },

  async uploadImage(bucket: string, file: File, folder: string = '') {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt) {
      return { url: null, error: new Error('Invalid file: no extension') };
    }

    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExts.includes(fileExt)) {
      return { url: null, error: new Error('File type not allowed') };
    }

    // Compress before upload — settings vary by bucket type
    let fileToUpload = file;
    try {
      if (bucket === 'store-logos') {
        fileToUpload = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
      } else if (bucket === 'store-banners') {
        fileToUpload = await compressImage(file, { maxWidth: 1200, maxHeight: 400, quality: 0.82 });
      } else {
        // product images and everything else
        fileToUpload = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
      }
    } catch {
      // Non-fatal — if compression fails for any reason, upload the original
      fileToUpload = file;
    }

    // Use compressed file's extension (may have changed to .webp)
    const compressedExt = fileToUpload.name.split('.').pop()?.toLowerCase() || fileExt;
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}_${randomStr}.${compressedExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Pass file directly — no ArrayBuffer/Blob conversion
    const { error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileToUpload.type,
      });

    if (uploadError) {
      console.error('[storageService] Upload error:', uploadError);
      return { url: null, error: uploadError };
    }

    const { data } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(filePath);

    // Strict URL validation
    if (!data?.publicUrl || !data.publicUrl.startsWith('http')) {
      console.error('[storageService] Invalid public URL:', data);
      return { url: null, error: new Error('Failed to generate valid public URL') };
    }

    // Strip query params to keep URL clean
    const cleanUrl = data.publicUrl.split('?')[0];
    return { url: cleanUrl, error: null };
  },

  async uploadMultipleImages(bucket: string, files: File[], folder: string = '') {
    const uploadPromises = files.map(file => this.uploadImage(bucket, file, folder));
    const results = await Promise.all(uploadPromises);
    
    const urls = results.filter(r => r.url).map(r => r.url!);
    const errors = results.filter(r => r.error).map(r => r.error);
    
    return { urls, errors };
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase
      .storage
      .from(bucket)
      .remove([path]);
    return { error };
  },

  async deleteFiles(bucket: string, paths: string[]) {
    const { error } = await supabase
      .storage
      .from(bucket)
      .remove(paths);
    return { error };
  },
};

// Analytics Services
export const analyticsService = {
  // Track store visit
  async trackVisit(storeId: string, visitorData: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
    source?: 'direct' | 'social' | 'search' | 'ads';
  }) {
    const { data, error } = await supabase
      .from('store_visits')
      .insert({
        store_id: storeId,
        ...visitorData,
        visited_at: new Date().toISOString(),
      })
      .select()
      .single();
    return { data, error };
  },

  // Get visitor statistics
  async getVisitorStats(storeId: string, startDate?: string, endDate?: string) {
    try {
      // Get total visits
      let visitsQuery = supabase
        .from('store_visits')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

      if (startDate) visitsQuery = visitsQuery.gte('visited_at', startDate);
      if (endDate) visitsQuery = visitsQuery.lte('visited_at', endDate);

      const { count: totalVisits, error: visitsError } = await visitsQuery;

      if (visitsError) throw visitsError;

      // Get unique visitors (by IP)
      let uniqueQuery = supabase
        .from('store_visits')
        .select('ip')
        .eq('store_id', storeId);

      if (startDate) uniqueQuery = uniqueQuery.gte('visited_at', startDate);
      if (endDate) uniqueQuery = uniqueQuery.lte('visited_at', endDate);

      const { data: uniqueData, error: uniqueError } = await uniqueQuery;

      if (uniqueError) throw uniqueError;

      const uniqueIps = new Set(uniqueData?.map(v => v.ip).filter(Boolean));
      const uniqueVisitors = uniqueIps.size;

      // Get traffic sources
      let sourcesQuery = supabase
        .from('store_visits')
        .select('source')
        .eq('store_id', storeId);

      if (startDate) sourcesQuery = sourcesQuery.gte('visited_at', startDate);
      if (endDate) sourcesQuery = sourcesQuery.lte('visited_at', endDate);

      const { data: sourcesData, error: sourcesError } = await sourcesQuery;

      if (sourcesError) throw sourcesError;

      const trafficSources = (sourcesData || []).reduce((acc: Record<string, number>, visit: { source?: string }) => {
        const source = visit.source || 'direct';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, { direct: 0, social: 0, search: 0, ads: 0 });

      // Calculate bounce rate (simplified - visits with less than 30 seconds)
      const bounceRate = totalVisits ? Math.round((totalVisits * 0.35)) : 0; // Placeholder

      return {
        data: {
          totalVisits: totalVisits || 0,
          uniqueVisitors,
          avgSessionDuration: '2m 34s', // Placeholder
          bounceRate: Math.min(bounceRate, 100),
          trafficSources,
        },
        error: null,
      };
    } catch (error) {
      console.error('Error getting visitor stats:', error);
      return {
        data: {
          totalVisits: 0,
          uniqueVisitors: 0,
          avgSessionDuration: '0m 0s',
          bounceRate: 0,
          trafficSources: { direct: 0, social: 0, search: 0, ads: 0 },
        },
        error,
      };
    }
  },

  // Get conversion statistics
  async getConversionStats(storeId: string, startDate?: string, endDate?: string) {
    try {
      // Get total orders for conversion rate calculation
      let ordersQuery = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

      if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate);
      if (endDate) ordersQuery = ordersQuery.lte('created_at', endDate);

      const { count: totalOrders, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      // Get visitor count for conversion rate
      let visitsQuery = supabase
        .from('store_visits')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

      if (startDate) visitsQuery = visitsQuery.gte('visited_at', startDate);
      if (endDate) visitsQuery = visitsQuery.lte('visited_at', endDate);

      const { count: totalVisits } = await visitsQuery;

      // Calculate conversion rate
      const conversionRate = totalVisits && totalOrders
        ? (totalOrders / totalVisits) * 100
        : 0;

      // Get abandoned carts (placeholder)
      const abandonedCarts = Math.floor((totalOrders || 0) * 0.25);

      return {
        data: {
          conversionRate,
          addToCartRate: conversionRate * 2.5, // Estimated
          checkoutRate: conversionRate * 1.8, // Estimated
          abandonedCarts,
        },
        error: null,
      };
    } catch (error) {
      console.error('Error getting conversion stats:', error);
      return {
        data: {
          conversionRate: 0,
          addToCartRate: 0,
          checkoutRate: 0,
          abandonedCarts: 0,
        },
        error,
      };
    }
  },

  // Track add to cart event
  async trackAddToCart(storeId: string, productId: string, visitorData: {
    ip?: string;
    userAgent?: string;
  }) {
    const { data, error } = await supabase
      .from('cart_events')
      .insert({
        store_id: storeId,
        product_id: productId,
        event_type: 'add_to_cart',
        ...visitorData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    return { data, error };
  },

  // Get popular products
  async getPopularProducts(storeId: string, limit: number = 10) {
    const { data, error } = await supabase
      .rpc('get_popular_products', {
        p_store_id: storeId,
        p_limit: limit,
      });
    return { data, error };
  },
};

// Review Services
export const reviewService = {
  // Create a new review
  async createReview(reviewData: Partial<Review>) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...reviewData,
        is_approved: false, // Reviews require approval
        helpful_count: 0,
        unhelpful_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    return { data, error };
  },

  // Get reviews for a product
  async getProductReviews(productId: string, options?: {
    approvedOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (options?.approvedOnly !== false) {
      query = query.eq('is_approved', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    return { data, error };
  },

  // Get reviews for a store
  async getStoreReviews(storeId: string, options?: {
    approvedOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('reviews')
      .select('*, product:products(name, images)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (options?.approvedOnly !== false) {
      query = query.eq('is_approved', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    return { data, error };
  },

  // Get pending reviews (for seller approval)
  async getPendingReviews(storeId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, product:products(name, images)')
      .eq('store_id', storeId)
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // Approve a review
  async approveReview(reviewId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .update({
        is_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();
    return { data, error };
  },

  // Reject/delete a review
  async rejectReview(reviewId: string) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);
    return { error };
  },

  // Add admin response to a review
  async respondToReview(reviewId: string, response: string) {
    const { data, error } = await supabase
      .from('reviews')
      .update({
        admin_response: response,
        admin_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();
    return { data, error };
  },

  // Mark review as helpful
  async markHelpful(reviewId: string) {
    const { data, error } = await supabase
      .rpc('increment_review_helpful', { review_id: reviewId });
    return { data, error };
  },

  // Mark review as unhelpful
  async markUnhelpful(reviewId: string) {
    const { data, error } = await supabase
      .rpc('increment_review_unhelpful', { review_id: reviewId });
    return { data, error };
  },

  // Get review summary for a product
  async getProductReviewSummary(productId: string): Promise<{ data: ReviewSummary | null; error: any }> {
    try {
      const { data, error } = await supabase
        .rpc('get_product_review_summary', { p_product_id: productId });

      if (error) throw error;

      return { data: data?.[0] || null, error: null };
    } catch (error) {
      console.error('Error getting review summary:', error);
      return {
        data: {
          product_id: productId,
          average_rating: 0,
          total_reviews: 0,
          five_star: 0,
          four_star: 0,
          three_star: 0,
          two_star: 0,
          one_star: 0,
        },
        error,
      };
    }
  },

  // Get review statistics for a store
  async getStoreReviewStats(storeId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_store_review_stats', { p_store_id: storeId });

      if (error) throw error;

      return {
        data: data?.[0] || {
          total_reviews: 0,
          average_rating: 0,
          pending_reviews: 0,
        },
        error: null,
      };
    } catch (error) {
      console.error('Error getting store review stats:', error);
      return {
        data: {
          total_reviews: 0,
          average_rating: 0,
          pending_reviews: 0,
        },
        error,
      };
    }
  },

  // Check if customer can review (must have purchased)
  async canCustomerReview(productId: string, customerEmail: string) {
    const { data, error } = await supabase
      .rpc('can_customer_review', {
        p_product_id: productId,
        p_customer_email: customerEmail,
      });
    return { canReview: data || false, error };
  },
};

// Message Services
export const messageService = {
  async sendMessage(messageData: {
    store_id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    message: string;
    context?: string;
  }) {
    const { data, error } = await supabase
      .from('store_messages')
      .insert(messageData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreMessages(storeId: string) {
    const { data, error } = await supabase
      .from('store_messages')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(messageId: string) {
    const { data, error } = await supabase
      .from('store_messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .select()
      .single();
    return { data, error };
  },
};

export default supabase;