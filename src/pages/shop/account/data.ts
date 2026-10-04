import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';

export type MyOrder = {
  id: string;
  source_type: 'store' | 'china_import';
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  is_escrow_released: boolean | null;
  buyer_reported_issue: boolean | null;
  dispute_status: string | null;
  tracking_number: string | null;
  delivery_fee: number;
  subtotal: number;
  coupon_discount: number | null;
  delivery_address: { address?: string; city?: string; state?: string } | null;
  customer_email: string | null;
  stores: { name: string; slug: string; logo_url: string | null } | null;
  order_items: {
    product_name: string;
    quantity: number;
    total_price: number;
    variant_options: Record<string, string> | null;
    product_id: string | null;
    image_url?: string | null;
  }[];
  china_code?: string | null;
  china_shipping_method?: string | null;
  china_batch_id?: string | null;
  china_received_at?: string | null;
  china_fulfillment_status?: string | null;
  china_ordered_quantity?: number;
  china_received_quantity?: number;
  china_shipped_quantity?: number;
  china_delivered_quantity?: number;
};

export type Bucket = 'all' | 'to_ship' | 'on_the_way' | 'delivered' | 'problems';

export const bucketOf = (o: MyOrder): Exclude<Bucket, 'all'> | 'other' => {
  if (o.buyer_reported_issue || o.dispute_status) return 'problems';
  if (o.status === 'delivered' || o.china_received_at || o.china_fulfillment_status === 'delivered') return 'delivered';
  if (['shipped', 'out_for_delivery', 'in_transit'].includes(o.status) || ['shipped'].includes(o.china_fulfillment_status ?? '')) return 'on_the_way';
  if (o.payment_status === 'paid' && (['pending', 'confirmed', 'processing', 'staged', 'received'].includes(o.status) || ['awaiting_arrival', 'received'].includes(o.china_fulfillment_status ?? ''))) return 'to_ship';
  return 'other';
};

export const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'to_ship', label: 'To ship' },
  { id: 'on_the_way', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'problems', label: 'Problems' },
];

const SELECT =
  'id, order_number, status, payment_status, total, created_at, shipped_at, delivered_at, is_escrow_released, buyer_reported_issue, dispute_status, tracking_number, delivery_fee, subtotal, coupon_discount, delivery_address, customer_email, stores(name, slug, logo_url), order_items(product_name, quantity, total_price, variant_options, product_id)';

type ChinaRow = {
  id: string;
  code: string;
  status: string;
  payment_status: string;
  total_ngn: number;
  subtotal_ngn: number;
  shipping_ngn: number;
  created_at: string;
  shipped_at: string | null;
  received_at: string | null;
  user_id: string;
  customer_whatsapp: string | null;
  delivery_address: { address?: string; city?: string; state?: string } | null;
  shipping_method: string | null;
  batch_id: string | null;
  items: Array<{
    id?: string;
    name?: string;
    quantity?: number;
    price_ngn?: number;
    image_url?: string | null;
    variant_options?: Record<string, string> | null;
  }> | null;
};

const normalizeChina = (o: ChinaRow): MyOrder => ({
  id: o.id,
  source_type: 'china_import',
  order_number: o.code,
  status: o.status,
  payment_status: o.payment_status,
  total: Number(o.total_ngn ?? 0),
  created_at: o.created_at,
  shipped_at: o.shipped_at,
  delivered_at: o.received_at,
  is_escrow_released: null,
  buyer_reported_issue: false,
  dispute_status: null,
  tracking_number: null,
  delivery_fee: Number(o.shipping_ngn ?? 0),
  subtotal: Number(o.subtotal_ngn ?? 0),
  coupon_discount: null,
  delivery_address: o.delivery_address,
  customer_email: null,
  stores: { name: 'QAFRICA · China Import', slug: 'stores-v2', logo_url: null },
  order_items: (o.items ?? []).map((it) => ({
    product_name: it.name ?? 'China Import item',
    quantity: Number(it.quantity ?? 1),
    total_price: Number(it.price_ngn ?? 0) * Number(it.quantity ?? 1),
    variant_options: it.variant_options ?? null,
    product_id: it.id ?? null,
    image_url: it.image_url ?? null,
  })),
  china_code: o.code,
  china_shipping_method: o.shipping_method,
  china_batch_id: o.batch_id,
  china_received_at: o.received_at,
});

async function attachChinaDropshipTracking(order: MyOrder): Promise<MyOrder> {
  const { data } = await supabase.rpc('get_customer_china_dropship_tracking', { p_order_id: order.id });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return order;
  return {
    ...order,
    china_code: row.china_code ?? null,
    china_shipping_method: row.shipping_method ?? null,
    china_batch_id: row.batch_id ?? null,
    china_received_at: row.received_at ?? null,
    china_fulfillment_status: row.fulfillment_status ?? null,
    china_ordered_quantity: Number(row.ordered_quantity ?? 0),
    china_received_quantity: Number(row.received_quantity ?? 0),
    china_shipped_quantity: Number(row.shipped_quantity ?? 0),
    china_delivered_quantity: Number(row.delivered_quantity ?? 0),
  };
}

async function fetchUnifiedOrders(customerId: string): Promise<MyOrder[]> {
  const [storeResult, chinaResult] = await Promise.all([
    supabase.from('orders').select(SELECT).eq('customer_id', customerId).order('created_at', { ascending: false }).limit(200),
    supabase.from('china_import_orders').select('id, code, status, payment_status, total_ngn, subtotal_ngn, shipping_ngn, created_at, shipped_at, received_at, user_id, customer_whatsapp, delivery_address, shipping_method, batch_id, items').eq('user_id', customerId).order('created_at', { ascending: false }).limit(200),
  ]);

  const storeOrders = ((storeResult.data ?? []) as unknown as MyOrder[]).map((o) => ({ ...o, source_type: 'store' as const }));
  const trackedStoreOrders = await Promise.all(storeOrders.map(attachChinaDropshipTracking));
  const chinaOrders = ((chinaResult.data ?? []) as unknown as ChinaRow[]).map(normalizeChina);

  return [...trackedStoreOrders, ...chinaOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function useMyOrders() {
  const { customer } = useCustomerAuthStore();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const load = useCallback(async () => {
    if (!customer) return;
    setOrders(await fetchUnifiedOrders(customer.id));
  }, [customer]);
  useEffect(() => {
    let alive = true;
    if (!customer) return;
    fetchUnifiedOrders(customer.id).then((data) => alive && setOrders(data));
    return () => { alive = false; };
  }, [customer]);
  return { orders, reload: load };
}

export async function fetchOrder(id: string, customerId: string): Promise<MyOrder | null> {
  const { data } = await supabase.from('orders').select(SELECT).eq('id', id).eq('customer_id', customerId).maybeSingle();
  if (data) return { ...(data as unknown as MyOrder), source_type: 'store' };

  const { data: china } = await supabase.from('china_import_orders')
    .select('id, code, status, payment_status, total_ngn, subtotal_ngn, shipping_ngn, created_at, shipped_at, received_at, user_id, customer_whatsapp, delivery_address, shipping_method, batch_id, items')
    .eq('id', id).eq('user_id', customerId).maybeSingle();

  return china ? normalizeChina(china as unknown as ChinaRow) : null;
}

export async function productImages(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await supabase.from('products').select('id, images').in('id', uniq);
  return Object.fromEntries((data ?? []).map((p: { id: string; images: string[] | null }) => [p.id, p.images?.[0] ?? '']));
}

export const statusLabel = (o: MyOrder) => {
  if (o.buyer_reported_issue) return 'Problem reported';
  if (o.source_type === 'china_import') {
    if (o.china_received_at) return 'Delivered';
    return ({
      pending: 'Paid · preparing import',
      confirmed: 'Paid · preparing import',
      processing: 'Preparing shipment',
      staged: 'Ready for batch',
      shipped: 'On the way',
      in_transit: 'On the way',
      received: 'Arrived in Nigeria',
      cancelled: 'Cancelled',
    } as Record<string, string>)[o.status] ?? o.status.replaceAll('_', ' ');
  }
  if (o.status === 'delivered' && o.is_escrow_released) return 'Completed';
  return (
    { pending: 'Paid · waiting for seller', confirmed: 'Seller preparing', processing: 'Seller preparing', shipped: 'On the way', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' } as Record<string, string>
  )[o.status] ?? o.status;
};
