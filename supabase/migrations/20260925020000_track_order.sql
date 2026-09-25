-- Applied live via apply_migration on 2026-09-25 (name: track_order).
-- Verified as anon: right email finds order (case-insensitive), wrong email finds nothing, no phone/address exposed.
-- Public order tracking: requires BOTH the order number and the email used at checkout.
-- Returns only what the shopper needs; never the full address, phone or payment internals.
CREATE OR REPLACE FUNCTION public.track_order(p_email text, p_order_number text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'shipped_at', o.shipped_at,
    'delivered_at', COALESCE(o.delivered_at, o.delivery_confirmed_at),
    'escrow_released', COALESCE(o.is_escrow_released, false),
    'escrow_release_at', o.escrow_release_at,
    'escrow_auto_release_at', o.escrow_auto_release_at,
    'tracking_number', o.tracking_number,
    'dispute_status', o.dispute_status,
    'refund_amount', o.refund_amount,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'discount', o.coupon_discount, 'total', o.total,
    'deliver_to', jsonb_build_object('city', o.delivery_address->>'city', 'state', o.delivery_state),
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'store', jsonb_build_object('name', s.name, 'slug', s.slug, 'logo_url', s.logo_url),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                 'name', oi.product_name, 'quantity', oi.quantity, 'total', oi.total_price,
                 'options', oi.variant_options, 'image', p.images[1]) ORDER BY oi.created_at)
               FROM order_items oi LEFT JOIN products p ON p.id = COALESCE(oi.original_product_id, oi.product_id)
               WHERE oi.order_id = o.id), '[]'::jsonb),
    'siblings', COALESCE((SELECT jsonb_agg(o2.order_number) FROM orders o2
                 WHERE o2.payment_reference = o.payment_reference AND o2.id <> o.id AND o.payment_reference IS NOT NULL), '[]'::jsonb))
  FROM orders o JOIN stores s ON s.id = o.store_id
  WHERE upper(trim(o.order_number)) = upper(trim(p_order_number))
    AND lower(trim(o.customer_email)) = lower(trim(p_email))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.track_order(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;
