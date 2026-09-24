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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function itemRows(items: Array<{ product_name: string; quantity: number }>): string {
  if (!items.length) return '<p style="margin:0;color:#6B7280;font-size:13px;">None</p>'
  return items.map((item) =>
    `<p style="margin:0 0 6px;color:#374151;font-size:13px;"><strong>${escapeHtml(item.product_name)}</strong> × ${item.quantity}</p>`
  ).join('')
}

async function queueFulfillmentNotification(
  db: any,
  notificationKey: string,
  notificationType: string,
  orderId: string,
  shipmentId: string | null,
  templateKey: string,
  tokens: Record<string, string>,
) {
  const { data: existing } = await db
    .from('china_import_customer_notification_log')
    .select('id')
    .eq('notification_key', notificationKey)
    .maybeSingle()
  if (existing) return

  const { data: order } = await db
    .from('china_import_orders')
    .select('id, code, user_id, customer_name')
    .eq('id', orderId)
    .maybeSingle()
  if (!order?.user_id) return

  const { data: customer } = await db
    .from('customers')
    .select('email, full_name')
    .eq('id', order.user_id)
    .maybeSingle()
  if (!customer?.email) return

  const { data: template } = await db
    .from('import_message_templates')
    .select('subject, body_html')
    .eq('key', templateKey)
    .maybeSingle()
  if (!template) return

  const render = (value: string) => {
    let output = value
    for (const [key, token] of Object.entries(tokens)) {
      output = output.split(`{{${key}}}`).join(token)
    }
    return output.replace(/\{\{[a-z_]+\}\}/g, '')
  }

  const { data: claimed, error: claimError } = await db
    .from('china_import_customer_notification_log')
    .insert({
      notification_key: notificationKey,
      order_id: orderId,
      shipment_id: shipmentId,
      notification_type: notificationType,
    })
    .select('id')
    .maybeSingle()

  if (claimError) {
    if (claimError.code === '23505') return
    return
  }
  if (!claimed) return

  const subject = render(template.subject)
  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
      <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
    </div>
    ${render(template.body_html)}
  </div>`

  const { error: queueError } = await db.from('import_notification_queue').insert({
    to_email: customer.email,
    subject,
    html,
  })

  if (queueError) {
    await db.from('china_import_customer_notification_log').delete().eq('id', claimed.id)
  }
}

async function notifyShipmentChange(db: any, shipment: any, status: string) {
  if (!['shipped', 'delivered'].includes(status)) return

  const { data: order } = await db
    .from('china_import_orders')
    .select('id, code, customer_name, user_id')
    .eq('id', shipment.order_id)
    .maybeSingle()
  if (!order) return

  const { data: fulfillmentItems } = await db
    .from('china_import_fulfillment_items')
    .select('id, order_item_index, product_name, ordered_quantity, shipped_quantity, delivered_quantity')
    .eq('order_id', order.id)
    .order('order_item_index', { ascending: true })

  const items = fulfillmentItems ?? []
  const remainingUnshipped = items
    .map((item: any) => ({ product_name: item.product_name, quantity: Math.max(0, item.ordered_quantity - item.shipped_quantity) }))
    .filter((item: any) => item.quantity > 0)

  if (status === 'shipped' && remainingUnshipped.length > 0) {
    const { data: shipmentItems } = await db
      .from('china_import_shipment_items')
      .select('fulfillment_item_id, quantity')
      .eq('shipment_id', shipment.id)

    const itemById = new Map(items.map((item: any) => [item.id, item]))
    const shipped = (shipmentItems ?? []).map((row: any) => ({
      product_name: itemById.get(row.fulfillment_item_id)?.product_name ?? 'Item',
      quantity: Number(row.quantity ?? 0),
    })).filter((item: any) => item.quantity > 0)

    const trackingNumber = shipment.tracking_number || 'Not available yet'
    const trackingLink = shipment.tracking_url || `https://qafrica.store/track?code=${encodeURIComponent(order.code)}`

    await queueFulfillmentNotification(
      db,
      `partial_shipment:${shipment.id}`,
      'partial_shipment',
      order.id,
      shipment.id,
      'fulfillment_partial_shipment',
      {
        customer_name: escapeHtml(order.customer_name || 'there'),
        order_code: escapeHtml(order.code),
        shipped_items_html: itemRows(shipped),
        remaining_items_html: itemRows(remainingUnshipped),
        shipment_code: escapeHtml(shipment.shipment_code),
        tracking_number: escapeHtml(trackingNumber),
        tracking_link: escapeHtml(trackingLink),
      },
    )
    return
  }

  if (status === 'delivered') {
    const allDelivered = items.length > 0 && items.every((item: any) => item.delivered_quantity >= item.ordered_quantity)

    if (allDelivered) {
      await queueFulfillmentNotification(
        db,
        `order_complete:${order.id}`,
        'order_complete',
        order.id,
        null,
        'fulfillment_order_complete',
        {
          customer_name: escapeHtml(order.customer_name || 'there'),
          order_code: escapeHtml(order.code),
        },
      )
      return
    }

    const { data: shipmentItems } = await db
      .from('china_import_shipment_items')
      .select('fulfillment_item_id, quantity')
      .eq('shipment_id', shipment.id)

    const itemById = new Map(items.map((item: any) => [item.id, item]))
    const delivered = (shipmentItems ?? []).map((row: any) => ({
      product_name: itemById.get(row.fulfillment_item_id)?.product_name ?? 'Item',
      quantity: Number(row.quantity ?? 0),
    })).filter((item: any) => item.quantity > 0)

    const remaining = items
      .map((item: any) => ({ product_name: item.product_name, quantity: Math.max(0, item.ordered_quantity - item.delivered_quantity) }))
      .filter((item: any) => item.quantity > 0)

    await queueFulfillmentNotification(
      db,
      `partial_delivery:${shipment.id}`,
      'partial_delivery',
      order.id,
      shipment.id,
      'fulfillment_partial_delivery',
      {
        customer_name: escapeHtml(order.customer_name || 'there'),
        order_code: escapeHtml(order.code),
        delivered_items_html: itemRows(delivered),
        remaining_items_html: itemRows(remaining),
      },
    )
  }
}

async function authorize(db: any, token: unknown, permissionKey: string) {
  if (!token || typeof token !== 'string') return null
  const { data: session, error } = await db.from('import_admin_sessions')
    .select('token, manager_id, expires_at').eq('token', token)
    .gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error || !session?.manager_id) return null
  await db.from('import_admin_sessions').update({ last_used_at: new Date().toISOString() }).eq('token', token)

  const { data: assignments } = await db.from('import_admin_manager_roles')
    .select('role_id').eq('manager_id', session.manager_id)
  const roleIds = Array.from(new Set((assignments ?? []).map((r: any) => r.role_id).filter(Boolean)))
  if (!roleIds.length) return null

  const { data: rolePermissions } = await db.from('import_admin_role_permissions')
    .select('permission_id').in('role_id', roleIds)
  const rolePermissionIds = Array.from(new Set((rolePermissions ?? []).map((r: any) => r.permission_id).filter(Boolean)))
  if (!rolePermissionIds.length) return null

  const { data: denied } = await db.from('import_admin_manager_denied_permissions')
    .select('permission_id').eq('manager_id', session.manager_id)
  const deniedIds = new Set((denied ?? []).map((r: any) => r.permission_id))
  const effectiveIds = rolePermissionIds.filter((id: string) => !deniedIds.has(id))
  if (!effectiveIds.length) return null

  const { data: permission, error: permissionError } = await db.from('import_admin_permissions')
    .select('id').in('id', effectiveIds).eq('key', permissionKey).limit(1).maybeSingle()
  if (permissionError || !permission) return null
  return session.manager_id as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''
  const body = await req.json().catch(() => ({}))
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const permission = action === 'admin-fulfillment-shipments-list'
      ? 'import.orders.view'
      : action === 'admin-fulfillment-shipment-create' || action === 'admin-fulfillment-shipment-update'
        ? 'import.orders.update'
        : null
    if (!permission) return json({ error: 'Unknown action' }, 400)

    const managerId = await authorize(db, body.manager_token, permission)
    if (!managerId) return json({ error: 'Unauthorized' }, 401)

    if (action === 'admin-fulfillment-shipments-list') {
      const orderId = typeof body.order_id === 'string' ? body.order_id : null
      let query = db.from('china_import_shipments')
        .select('id,shipment_code,order_id,customer_id,batch_id,status,delivery_mode,carrier_name,tracking_number,tracking_url,waybill_url,delivery_address,notes,shipped_at,delivered_at,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(200)
      if (orderId) query = query.eq('order_id', orderId)

      const { data: shipments, error } = await query
      if (error) return json({ error: error.message }, 500)
      const orderIds = Array.from(new Set((shipments ?? []).map((s: any) => s.order_id).filter(Boolean)))
      const { data: orders, error: ordersError } = orderIds.length
        ? await db.from('china_import_orders').select('id,delivery_mode,delivery_address,pickup_station_name,pickup_station_address').in('id', orderIds)
        : { data: [], error: null }
      if (ordersError) return json({ error: ordersError.message }, 500)
      const orderById = new Map((orders ?? []).map((o: any) => [o.id, o]))

      const ids = (shipments ?? []).map((s: any) => s.id)
      const { data: shipmentItems, error: itemsError } = ids.length
        ? await db.from('china_import_shipment_items').select('id,shipment_id,fulfillment_item_id,quantity').in('shipment_id', ids)
        : { data: [], error: null }
      if (itemsError) return json({ error: itemsError.message }, 500)

      const fulfillmentIds = Array.from(new Set((shipmentItems ?? []).map((i: any) => i.fulfillment_item_id)))
      const { data: fulfillmentItems, error: fulfillmentError } = fulfillmentIds.length
        ? await db.from('china_import_fulfillment_items').select('id,product_name,image_url,variant_options,ordered_quantity,received_quantity,allocated_quantity,shipped_quantity,delivered_quantity,status').in('id', fulfillmentIds)
        : { data: [], error: null }
      if (fulfillmentError) return json({ error: fulfillmentError.message }, 500)

      const byId = new Map((fulfillmentItems ?? []).map((i: any) => [i.id, i]))
      return json({
        shipments: (shipments ?? []).map((shipment: any) => {
          const order = orderById.get(shipment.order_id)
          return {
            ...shipment,
            delivery_mode: shipment.delivery_mode ?? order?.delivery_mode ?? null,
            delivery_address: shipment.delivery_address ?? order?.delivery_address ?? (
              order?.delivery_mode === 'pickup_station' && order?.pickup_station_name
                ? { name: order.pickup_station_name, address: order.pickup_station_address ?? '' }
                : null
            ),
            items: (shipmentItems ?? []).filter((i: any) => i.shipment_id === shipment.id)
            .map((i: any) => ({ ...i, fulfillment_item: byId.get(i.fulfillment_item_id) ?? null })),
          }
        }),
      })
    }

    if (action === 'admin-fulfillment-shipment-update') {
      if (typeof body.shipment_id !== 'string') return json({ error: 'shipment_id is required' }, 400)
      const allowed = ['ready_to_ship','shipped','in_transit','out_for_delivery','delivered','cancelled']
      if (!allowed.includes(body.status)) return json({ error: 'Invalid shipment status' }, 400)

      const { data: shipment, error } = await db.rpc('update_china_import_shipment_status', {
        p_shipment_id: body.shipment_id,
        p_status: body.status,
        p_manager_id: managerId,
        p_carrier_name: typeof body.carrier_name === 'string' ? body.carrier_name : null,
        p_tracking_number: typeof body.tracking_number === 'string' ? body.tracking_number : null,
        p_tracking_url: typeof body.tracking_url === 'string' ? body.tracking_url : null,
        p_waybill_url: typeof body.waybill_url === 'string' ? body.waybill_url : null,
        p_delivery_mode: typeof body.delivery_mode === 'string' ? body.delivery_mode : null,
        p_note: typeof body.note === 'string' ? body.note : null,
      })
      if (error) return json({ error: error.message }, 400)
      await notifyShipmentChange(db, shipment, body.status)
      return json({
        success: true,
        status: 'updated',
        shipment,
      }, 200)
    }

    if (action === 'admin-fulfillment-shipment-create') {
      if (typeof body.order_id !== 'string') return json({ error: 'order_id is required' }, 400)
      if (!Array.isArray(body.items) || body.items.length === 0) return json({ error: 'At least one item is required' }, 400)

      const items = body.items.map((item: any) => ({
        fulfillment_item_id: String(item.fulfillment_item_id ?? ''),
        quantity: Number(item.quantity),
      }))
      if (items.some((item: any) => !item.fulfillment_item_id || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
        return json({ error: 'Each item must have a positive integer quantity' }, 400)
      }

      const { data: orderSnapshot, error: orderSnapshotError } = await db.from('china_import_orders')
        .select('delivery_mode,delivery_address,pickup_station_name,pickup_station_address')
        .eq('id', body.order_id)
        .maybeSingle()
      if (orderSnapshotError) return json({ error: orderSnapshotError.message }, 500)
      if (!orderSnapshot) return json({ error: 'Order not found' }, 404)

      const deliveryMode = typeof body.delivery_mode === 'string' && body.delivery_mode.trim()
        ? body.delivery_mode
        : orderSnapshot.delivery_mode
      const deliveryAddress = body.delivery_address && typeof body.delivery_address === 'object'
        ? body.delivery_address
        : orderSnapshot.delivery_address ?? (
          orderSnapshot.delivery_mode === 'pickup_station' && orderSnapshot.pickup_station_name
            ? { name: orderSnapshot.pickup_station_name, address: orderSnapshot.pickup_station_address ?? '' }
            : null
        )

      const { data: shipment, error } = await db.rpc('create_china_import_shipment', {
        p_order_id: body.order_id,
        p_items: items,
        p_manager_id: managerId,
        p_delivery_mode: deliveryMode,
        p_delivery_address: deliveryAddress,
        p_notes: typeof body.notes === 'string' ? body.notes : null,
      })
      if (error) return json({ error: error.message }, 400)
      return json({ success: true, shipment })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error' }, 500)
  }
})
