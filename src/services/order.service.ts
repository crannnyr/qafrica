import { supabase } from './supabase';
import { productService } from './product.service';
import type { Order, DropshipOrderView } from '@/types';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-orders`;

async function callGetOrders(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) return { data: null, error: { message: json.error ?? 'Request failed' } };
  return { data: json.data, error: null };
}

// FIX: orders table has a legacy 'items' JSONB column that conflicts with the
// order_items relation alias and causes a 500. We explicitly list every column
// except 'items' so PostgREST never tries to return both.
const ORDER_SELECT = `
  id, order_number, store_id, customer_id,
  customer_name, customer_email, customer_phone,
  subtotal, delivery_fee, platform_fee, total,
  delivery_address, delivery_state,
  payment_status, payment_method, payment_reference, paid_at,
  status, escrow_release_at, is_escrow_released,
  tracking_number, created_at, updated_at,
  delivered_at, delivery_confirmed_at, escrow_auto_release_at,
  buyer_reported_issue, issue_reported_at, issue_description,
  dispute_status, dispute_resolved_at, dispute_resolved_by,
  refund_amount, refund_processed_at, shipped_at,
  shipbubble_order_id, shipbubble_tracking_url,
  shipbubble_courier_name, shipbubble_courier_phone, shipbubble_status,
  shipbubble_receiver_address_code,
  is_cod_order, dropshipper_store_id, dropshipper_profit,
  is_manual_sale, has_reviewed,
  order_items(*)
`;

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

      await productService.updateProduct(item.product_id, {
        stock_quantity: Math.max(0, (product.stock_quantity || 0) - item.quantity),
      });
    }

    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    return { data, error };
  },

  // ── FETCH METHODS — all via edge function ──────────────────────────────────

  async getOrder(orderId: string) {
    return callGetOrders({ mode: 'detail', order_id: orderId });
  },

  async getStoreOrders(storeId: string) {
    return callGetOrders({ mode: 'store', store_id: storeId });
  },

  async getDropshipOrdersForStore(storeId: string) {
    return callGetOrders({ mode: 'dropship', store_id: storeId });
  },

  async getUserOrders(_userId: string) {
    // userId kept for API compatibility — identity resolved from JWT in edge fn
    return callGetOrders({ mode: 'customer' });
  },

  async getAllOrders(page = 1, limit = 50) {
    return callGetOrders({ mode: 'admin', page, limit });
  },

  // ── WRITE METHODS — direct Supabase (unchanged) ────────────────────────────

  async updateDropshipOrderStatus(
    orderId: string,
    originalStoreId: string,
    status: Order['status']
  ) {
    const { data: items, error: verifyError } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .eq('original_store_id', originalStoreId)
      .eq('is_imported', true);

    if (verifyError) return { data: null, error: verifyError };
    if (!items || items.length === 0) {
      return { data: null, error: { message: 'No dropshipped items found for this store in this order' } };
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    return { data, error };
  },

  async updateOrderStatus(
    orderId: string,
    status: Order['status'] | string,
    additionalData?: Record<string, any>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('store_id')
      .eq('id', orderId)
      .single();
    if (orderError) return { data: null, error: orderError };

    const { data: store } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', order.store_id)
      .single();

    if (store?.owner_id !== user.id) {
      return { data: null, error: { message: 'Unauthorized: You do not own this order' } };
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString(), ...additionalData })
      .eq('id', orderId)
      .select()
      .single();
    return { data, error };
  },

  async confirmDelivery(orderId: string) {
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
};
