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
    return json({ order_code: data.order_code, items: data.items, created_at: data.created_at })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await req.json().catch(() => ({}))
  const managerToken = typeof body.manager_token === 'string' ? body.manager_token : ''
  const orderId = typeof body.order_id === 'string' ? body.order_id : ''
  if (!managerToken || !orderId) return json({ error: 'Manager session and order are required.' }, 400)

  const { data: session, error: sessionError } = await db.from('import_admin_sessions')
    .select('token,manager_id,expires_at').eq('token', managerToken)
    .gt('expires_at', new Date().toISOString()).maybeSingle()
  if (sessionError || !session?.manager_id) return json({ error: 'Unauthorized' }, 401)

  const { data: order, error: orderError } = await db.from('china_import_orders')
    .select('id,code').eq('id', orderId).maybeSingle()
  if (orderError || !order) return json({ error: 'Order not found.' }, 404)

  const { data: rows, error: itemsError } = await db.from('china_import_fulfillment_items')
    .select('id,product_name,image_url,variant_options,ordered_quantity,received_quantity')
    .eq('order_id', orderId).order('order_item_index', { ascending: true })
  if (itemsError) return json({ error: 'Could not load fulfillment items.' }, 500)

  const selectedRows = (rows ?? []).filter((item: any) => selectedItemIds.includes(item.id));
  if (selectedRows.length !== selectedItemIds.length) return json({ error: 'One or more selected items do not belong to this order.' }, 400);

  const items = selectedRows.map((item: any) => ({
    product_name: item.product_name,
    image_url: item.image_url ?? null,
    variant_options: variantObject(item.variant_options),
    ordered_quantity: Number(item.ordered_quantity ?? 0),
    received_quantity: Number(item.received_quantity ?? 0),
    remaining_quantity: Math.max(0, Number(item.ordered_quantity ?? 0) - Number(item.received_quantity ?? 0)),
  })).filter((item: any) => item.remaining_quantity > 0)

  if (!items.length || items.length !== selectedItemIds.length || items.some((item: any) => item.remaining_quantity <= 0)) {
    return json({ error: 'Select only items that still have outstanding quantities.' }, 400)
  }

  const { data: created, error: createError } = await db.from('china_import_partial_receiving_shares')
    .insert({ order_id: orderId, order_code: order.code, items, created_by: session.manager_id })
    .select('token').single()
  if (createError || !created) return json({ error: 'Could not create the public list.' }, 500)
  return json({ success: true, token: created.token })
})
