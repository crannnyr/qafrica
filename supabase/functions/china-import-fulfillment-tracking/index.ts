import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const { code } = await req.json().catch(() => ({}))
    if (!code || typeof code !== 'string' || !code.trim()) {
      return json({ error: 'Missing order code' }, 400)
    }

    const { data: order, error } = await supabase
      .from('china_import_orders')
      .select('id, code, status, shipping_method, shipped_at, received_at, created_at, items, delivery_mode, pickup_station_name, pickup_station_address')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!order) return json({ error: 'No order found with that code. Double-check and try again.' }, 404)

    const { data: bill, error: billError } = await supabase
      .from('china_import_consolidation_bills')
      .select('id, status')
      .eq('order_id', order.id)
      .eq('kind', 'consolidation_shipping')
      .not('status', 'eq', 'cancelled')
      .maybeSingle()
    if (billError) return json({ error: billError.message }, 500)

    const { data: fulfillmentItems, error: fulfillmentError } = await supabase
      .from('china_import_fulfillment_items')
      .select('id, order_item_index, product_id, product_name, image_url, variant_options, ordered_quantity, received_quantity, allocated_quantity, shipped_quantity, delivered_quantity, status, received_at')
      .eq('order_id', order.id)
      .order('order_item_index', { ascending: true })
    if (fulfillmentError) return json({ error: fulfillmentError.message }, 500)

    const normalizedFulfillmentItems = (fulfillmentItems ?? []).map((item: any) => ({
      ...item,
      // Once an item is received at HQ, public tracking must never present it
      // as merely "Shipped", even if the historical shipped quantity remains.
      shipped_quantity: item.received_quantity > 0 ? 0 : item.shipped_quantity,
    }))
    const allReceived = normalizedFulfillmentItems.length > 0 && normalizedFulfillmentItems.every(
      (item: any) => item.received_quantity >= item.ordered_quantity,
    )
    const anyReceived = normalizedFulfillmentItems.some((item: any) => item.received_quantity > 0)
    const publicOrder = allReceived
      ? { ...order, status: 'clearance_and_closed', received_at: order.received_at ?? new Date().toISOString() }
      : anyReceived
        ? { ...order }
        : order

    const { data: shipments, error: shipmentError } = await supabase
      .from('china_import_shipments')
      .select('id, shipment_code, status, delivery_mode, carrier_name, tracking_number, tracking_url, waybill_url, shipped_at, delivered_at, created_at, notes')
      .eq('order_id', order.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    if (shipmentError) return json({ error: shipmentError.message }, 500)

    const shipmentIds = (shipments ?? []).map((s: any) => s.id)
    const shipmentItems = shipmentIds.length
      ? (await supabase.from('china_import_shipment_items').select('shipment_id, fulfillment_item_id, quantity').in('shipment_id', shipmentIds)).data ?? []
      : []
    const shipmentEvents = shipmentIds.length
      ? (await supabase.from('china_import_fulfillment_events')
          .select('id, shipment_id, fulfillment_item_id, event_type, status, location, note, created_at')
          .in('shipment_id', shipmentIds)
          .order('created_at', { ascending: true })).data ?? []
      : []

    const byId = new Map(normalizedFulfillmentItems.map((item: any) => [item.id, item]))
    const publicShipments = (shipments ?? []).map((shipment: any) => ({
      ...shipment,
      items: shipmentItems
        .filter((row: any) => row.shipment_id === shipment.id)
        .map((row: any) => {
          const item = byId.get(row.fulfillment_item_id)
          return {
            fulfillment_item_id: row.fulfillment_item_id,
            quantity: row.quantity,
            product_name: item?.product_name ?? 'Item',
            image_url: item?.image_url ?? null,
            variant_options: item?.variant_options ?? null,
          }
        }),
      events: shipmentEvents
        .filter((event: any) => event.shipment_id === shipment.id)
        .map((event: any) => ({
          event_type: event.event_type,
          status: event.status,
          location: event.location,
          note: event.note,
          created_at: event.created_at,
        })),
    }))

    return json({
      order: {
        ...publicOrder,
        consolidation_billed: !!bill,
        consolidation_bill_status: bill?.status ?? null,
        fulfillment_items: normalizedFulfillmentItems,
        shipments: publicShipments,
      },
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
