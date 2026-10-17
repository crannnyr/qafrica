import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
function variantObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const token = (url.searchParams.get('token') ?? '').trim()
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'This shared list could not be found.' }, 404)
    const { data, error } = await db.from('china_import_partial_receiving_shares')
      .select('order_code,items,created_at').eq('token', token).maybeSingle()
    if (error || !data) return json({ error: 'This shared list could not be found.' }, 404)

    // Resolve shipping methods live from china_import_orders for every order represented in the shared list.
    const items = Array.isArray(data.items) ? data.items as Record<string, unknown>[] : []
    const orderCodes = [...new Set(items
      .map(item => typeof item.order_code === 'string' ? item.order_code.trim() : '')
      .filter(Boolean))]
    const { data: orders, error: ordersError } = orderCodes.length
      ? await db.from('china_import_orders').select('code,shipping_method').in('code', orderCodes)
      : { data: [], error: null }
    if (ordersError) return json({ error: 'Could not load shipping methods for this list.' }, 500)
    const shippingByCode = new Map((orders ?? []).map((order: { code: string; shipping_method: string | null }) => [
      order.code,
      typeof order.shipping_method === 'string' ? order.shipping_method : null,
    ]))
    const refreshedItems = items.map(item => ({
      ...item,
      shipping_method: shippingByCode.get(typeof item.order_code === 'string' ? item.order_code : '') ?? null,
    }))
    return json({ order_code: data.order_code, items: refreshedItems, created_at: data.created_at })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await req.json().catch(() => ({}))
  const managerToken = typeof body.manager_token === 'string' ? body.manager_token : ''
  const orderId = typeof body.order_id === 'string' ? body.order_id : ''
  const selectedItemIds = Array.isArray(body.selected_item_ids)
    ? [...new Set(body.selected_item_ids.filter((id: unknown): id is string => typeof id === 'string'))]
    : []
  if (!managerToken || selectedItemIds.length === 0) return json({ error: 'Manager session and selected items are required.' }, 400)

  const { data: session, error: sessionError } = await db.from('import_admin_sessions')
    .select('token,manager_id,expires_at').eq('token', managerToken)
    .gt('expires_at', new Date().toISOString()).maybeSingle()
  if (sessionError || !session?.manager_id) return json({ error: 'Unauthorized' }, 401)

  const { data: selectedRows, error: itemsError } = await db.from('china_import_fulfillment_items')
    .select('id,order_id,product_name,image_url,variant_options,ordered_quantity,received_quantity')
    .in('id', selectedItemIds)
  if (itemsError) return json({ error: 'Could not load selected fulfillment items.' }, 500)
  if (!selectedRows || selectedRows.length !== selectedItemIds.length) return json({ error: 'One or more selected items could not be found.' }, 400)

  const orderIds = [...new Set(selectedRows.map((item: any) => item.order_id))]
  const { data: orders, error: ordersError } = await db.from('china_import_orders')
    .select('id,code,shipping_method').in('id', orderIds)
  if (ordersError || !orders || orders.length !== orderIds.length) return json({ error: 'Could not load the selected orders.' }, 500)
  const orderCodes = new Map(orders.map((order: any) => [order.id, order.code]))
  const shippingMethods = new Map(orders.map((order: any) => [order.id, typeof order.shipping_method === 'string' ? order.shipping_method : null]))
  const items = selectedRows.map((item: any) => ({
    order_code: orderCodes.get(item.order_id) ?? '',
    shipping_method: shippingMethods.get(item.order_id) ?? null,
    product_name: item.product_name,
    image_url: item.image_url ?? null,
    variant_options: variantObject(item.variant_options),
    ordered_quantity: Number(item.ordered_quantity ?? 0),
    received_quantity: Number(item.received_quantity ?? 0),
    remaining_quantity: Math.max(0, Number(item.ordered_quantity ?? 0) - Number(item.received_quantity ?? 0)),
  }))
  if (!items.length || items.some((item: any) => item.remaining_quantity <= 0)) {
    return json({ error: 'Select only items that still have outstanding quantities.' }, 400)
  }
  const firstOrderId = selectedRows[0].order_id
  const orderCodeLabel = orderIds.length === 1 ? (orderCodes.get(firstOrderId) ?? '') : `Multiple orders (${orderIds.length})`

  const { data: created, error: createError } = await db.from('china_import_partial_receiving_shares')
    .insert({ order_id: firstOrderId, order_code: orderCodeLabel, items, created_by: session.manager_id })
    .select('token').single()
  if (createError || !created) return json({ error: 'Could not create the public list.' }, 500)
  return json({ success: true, token: created.token })
})
