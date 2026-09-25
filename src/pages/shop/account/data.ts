import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';

export type MyOrder = {
  id: string;
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
  order_items: { product_name: string; quantity: number; total_price: number; variant_options: Record<string, string> | null; product_id: string | null }[];
};

export type Bucket = 'all' | 'to_ship' | 'on_the_way' | 'delivered' | 'problems';

export const bucketOf = (o: MyOrder): Exclude<Bucket, 'all'> | 'other' => {
  if (o.buyer_reported_issue || o.dispute_status) return 'problems';
  if (['shipped', 'out_for_delivery'].includes(o.status)) return 'on_the_way';
  if (o.status === 'delivered') return 'delivered';
  if (o.payment_status === 'paid' && ['pending', 'confirmed', 'processing'].includes(o.status)) return 'to_ship';
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

export function useMyOrders() {
  const { customer } = useCustomerAuthStore();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const load = useCallback(async () => {
    if (!customer) return;
    const { data } = await supabase.from('orders').select(SELECT).eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(200);
    setOrders((data as unknown as MyOrder[]) ?? []);
  }, [customer]);
  useEffect(() => {
    let alive = true;
    if (!customer) return;
    supabase
      .from('orders')
      .select(SELECT)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => alive && setOrders((data as unknown as MyOrder[]) ?? []));
    return () => {
      alive = false;
    };
  }, [customer]);
  return { orders, reload: load };
}

export async function fetchOrder(id: string, customerId: string) {
  const { data } = await supabase.from('orders').select(SELECT).eq('id', id).eq('customer_id', customerId).maybeSingle();
  return (data as unknown as MyOrder) ?? null;
}

export async function productImages(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await supabase.from('products').select('id, images').in('id', uniq);
  return Object.fromEntries((data ?? []).map((p: { id: string; images: string[] | null }) => [p.id, p.images?.[0] ?? '']));
}

export const statusLabel = (o: MyOrder) => {
  if (o.buyer_reported_issue) return 'Problem reported';
  if (o.status === 'delivered' && o.is_escrow_released) return 'Completed';
  return (
    { pending: 'Paid · waiting for seller', confirmed: 'Seller preparing', processing: 'Seller preparing', shipped: 'On the way', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' } as Record<string, string>
  )[o.status] ?? o.status;
};
