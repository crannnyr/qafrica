import { supabase } from './supabase';
import { productService } from './product.service';
import type { Order, DropshipOrderView } from '@/types';

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

  async getOrder(orderId: string) {
    // FIX: changed 'items:order_items(*)' to 'order_items(*)' to avoid conflict
    // with the orders.items JSONB column which silently overrides the join alias
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();
    return { data, error };
  },

  async getStoreOrders(storeId: string) {
    // FIX: changed 'items:order_items(*)' to 'order_items(*)'
    const { data: directOrders, error: directError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (directError) return { data: null, error: directError };

    const { data: dropshipRows } = await supabase
      .from('order_items')
      .select('order:orders(*, order_items(*))')
      .eq('original_store_id', storeId)
      .eq('is_imported', true);

    const allOrders = [
      ...(directOrders || []),
      ...(dropshipRows?.map((row: any) => row.order).filter(Boolean) || []),
    ];

    const uniqueOrders = allOrders.filter(
      (order, index, self) => index === self.findIndex((o) => o.id === order.id)
    );

    uniqueOrders.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { data: uniqueOrders, error: null };
  },

  async getDropshipOrdersForStore(storeId: string) {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        order:orders(
          id, order_number, store_id, customer_name, customer_email,
          customer_phone, delivery_address, delivery_state, status,
          payment_status, created_at, tracking_number, is_escrow_released,
          delivered_at, order_items(*)
        ),
        product_name, quantity, dropship_price,
        unit_price, total_price, is_imported,
        original_owner_id, original_store_id
      `)
      .eq('original_store_id', storeId)
      .eq('is_imported', true)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    const transformed: DropshipOrderView[] = (data || []).map((item: any) => ({
      order_id:               item.order.id,
      order_number:           item.order.order_number,
      dropshipper_store_id:   item.order.store_id,
      dropshipper_store_name: '',
      customer_name:          item.order.customer_name,
      customer_email:         item.order.customer_email,
      customer_phone:         item.order.customer_phone,
      delivery_address:       item.order.delivery_address,
      delivery_state:         item.order.delivery_state,
      status:                 item.order.status,
      payment_status:         item.order.payment_status,
      created_at:             item.order.created_at,
      items:                  item.order.order_items,
      total_dropship_price:   (item.dropship_price ?? 0) * item.quantity,
      total_quantity:         item.quantity,
      tracking_number:        item.order.tracking_number,
      is_escrow_released:     item.order.is_escrow_released,
      delivered_at:           item.order.delivered_at,
    }));

    return { data: transformed, error: null };
  },

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

  async getUserOrders(userId: string) {
    // FIX: changed 'items:order_items(*)' to 'order_items(*)'
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
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

  async getAllOrders() {
    // FIX: changed 'items:order_items(*)' to 'order_items(*)'
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};
