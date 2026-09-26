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

async function hasManagerPermission(db: any, managerId: string, permissionKey: string) {
  const { data: assignments, error: assignmentsError } = await db
    .from('import_admin_manager_roles').select('role_id').eq('manager_id', managerId)
  if (assignmentsError) return false

  const roleIds = Array.from(new Set((assignments ?? []).map((row: any) => row.role_id).filter(Boolean)))
  if (roleIds.length === 0) return false

  const { data: rolePermissions, error: rolePermissionsError } = await db
    .from('import_admin_role_permissions').select('permission_id').in('role_id', roleIds)
  if (rolePermissionsError) return false

  const rolePermissionIds = Array.from(new Set((rolePermissions ?? []).map((row: any) => row.permission_id).filter(Boolean)))

  const { data: deniedPermissions, error: deniedPermissionsError } = await db
    .from('import_admin_manager_denied_permissions').select('permission_id').eq('manager_id', managerId)
  if (deniedPermissionsError) return false

  const deniedIds = new Set((deniedPermissions ?? []).map((row: any) => row.permission_id).filter(Boolean))
  const effectivePermissionIds = rolePermissionIds.filter((id: string) => !deniedIds.has(id))
  if (effectivePermissionIds.length === 0) return false

  const { data: directPermissions, error: directError } = await db
    .from('import_admin_manager_permissions').select('permission_id')
    .eq('manager_id', managerId).in('permission_id', effectivePermissionIds)
  if (!directError && (directPermissions ?? []).some((row: any) => row.permission_id)) {
    // Direct grants are not required for role permissions; this query only
    // confirms the table is readable for deployments that use both models.
  }

  const { data: permission, error: permissionError } = await db
    .from('import_admin_permissions').select('id')
    .in('id', effectivePermissionIds).eq('key', permissionKey).limit(1).maybeSingle()

  return !permissionError && !!permission
}

async function requireManager(db: any, token: unknown, permissionKey: string) {
  if (!token || typeof token !== 'string') return false

  const { data: session, error } = await db
    .from('import_admin_sessions')
    .select('token, manager_id, expires_at')
    .eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle()

  if (error || !session?.manager_id) return false

  await db.from('import_admin_sessions')
    .update({ last_used_at: new Date().toISOString() }).eq('token', token)

  return hasManagerPermission(db, session.manager_id, permissionKey)
}

const PRODUCT_SELECT = 'id, name, description, image_url, image_urls, price_cny, price_cny_original, price_ngn, price_usd, cost_ngn, price_input_currency, price_input_amount, category, parent_category, category_id, subcategory_id, markup_percent, markup_amount_ngn, original_price_usd, usd_to_ngn_rate, sea_shipping_allocation_ngn, sea_shipping_customer_ngn, air_shipping_customer_ngn, volume_cbm, weight_grams, sea_shipping_cost_ngn, flight_shipping_cost_ngn, is_active, moq, has_variants, variants, delivery_time, source_url, ship_only, express_air_cargo, sort_order, units_sold, is_trending, trending_order, trending_source, created_at, updated_at'

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanNumber(value: unknown, fallback: number | null = null) {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function cleanVariants(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((group: any) =>
    group && typeof group === 'object' &&
    typeof group.name === 'string' &&
    group.name.trim() &&
    Array.isArray(group.options) &&
    group.options.length > 0
  )
}

function buildProductPayload(body: any, partial = false) {
  const row: Record<string, unknown> = {}

  if (!partial || body.name !== undefined) row.name = cleanText(body.name)
  if (!partial || body.description !== undefined) row.description = cleanText(body.description)
  if (!partial || body.image_url !== undefined) row.image_url = cleanText(body.image_url)
  if (body.image_urls !== undefined) row.image_urls = Array.isArray(body.image_urls) ? body.image_urls.filter((v: any) => typeof v === 'string' && v.trim()) : []
  if (!partial || body.price_cny !== undefined) row.price_cny = cleanNumber(body.price_cny, 0)
  if (body.price_cny_original !== undefined) row.price_cny_original = cleanNumber(body.price_cny_original)
  if (body.price_ngn !== undefined) row.price_ngn = cleanNumber(body.price_ngn, 0)
  if (body.price_usd !== undefined) row.price_usd = cleanNumber(body.price_usd)
  if (body.cost_ngn !== undefined) row.cost_ngn = cleanNumber(body.cost_ngn)
  if (body.price_input_currency !== undefined) row.price_input_currency = cleanText(body.price_input_currency) || null
  if (body.price_input_amount !== undefined) row.price_input_amount = cleanNumber(body.price_input_amount)
  if (!partial || body.category !== undefined) row.category = cleanText(body.category, 'General')
  if (body.parent_category !== undefined) row.parent_category = cleanText(body.parent_category) || null
  if (body.category_id !== undefined) row.category_id = cleanText(body.category_id) || null
  if (body.subcategory_id !== undefined) row.subcategory_id = body.subcategory_id || null
  if (body.markup_percent !== undefined) row.markup_percent = cleanNumber(body.markup_percent)
  if (body.markup_amount_ngn !== undefined) row.markup_amount_ngn = cleanNumber(body.markup_amount_ngn)
  if (body.original_price_usd !== undefined) row.original_price_usd = cleanNumber(body.original_price_usd)
  if (body.usd_to_ngn_rate !== undefined) row.usd_to_ngn_rate = cleanNumber(body.usd_to_ngn_rate)
  if (body.sea_shipping_allocation_ngn !== undefined) row.sea_shipping_allocation_ngn = cleanNumber(body.sea_shipping_allocation_ngn)
  if (body.sea_shipping_customer_ngn !== undefined) row.sea_shipping_customer_ngn = cleanNumber(body.sea_shipping_customer_ngn)
  if (body.air_shipping_customer_ngn !== undefined) row.air_shipping_customer_ngn = cleanNumber(body.air_shipping_customer_ngn)
  if (body.volume_cbm !== undefined) row.volume_cbm = cleanNumber(body.volume_cbm)
  if (body.weight_grams !== undefined) row.weight_grams = cleanNumber(body.weight_grams)
  if (body.sea_shipping_cost_ngn !== undefined) row.sea_shipping_cost_ngn = cleanNumber(body.sea_shipping_cost_ngn)
  if (body.flight_shipping_cost_ngn !== undefined) row.flight_shipping_cost_ngn = cleanNumber(body.flight_shipping_cost_ngn)
  if (body.is_active !== undefined) row.is_active = Boolean(body.is_active)
  if (body.units_sold !== undefined) row.units_sold = Math.max(0, Math.floor(Number(body.units_sold) || 0))
  if (body.moq !== undefined) row.moq = Math.max(1, Math.floor(Number(body.moq) || 1))
  if (body.has_variants !== undefined) row.has_variants = Boolean(body.has_variants)
  if (body.variants !== undefined) row.variants = cleanVariants(body.variants)
  if (body.delivery_time !== undefined) row.delivery_time = cleanText(body.delivery_time) || null
  if (body.source_url !== undefined) row.source_url = cleanText(body.source_url) || null
  if (body.ship_only !== undefined) row.ship_only = Boolean(body.ship_only)
  if (body.express_air_cargo !== undefined) row.express_air_cargo = Boolean(body.express_air_cargo)
  if (body.sort_order !== undefined) row.sort_order = Math.floor(Number(body.sort_order) || 0)
  if (body.is_trending !== undefined) row.is_trending = Boolean(body.is_trending)
  if (body.trending_order !== undefined) row.trending_order = Math.floor(Number(body.trending_order) || 0)
  if (body.trending_source !== undefined) row.trending_source = cleanText(body.trending_source, 'manual')

  return row
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const action = new URL(req.url).searchParams.get('action')
  const body = await req.json().catch(() => ({}))

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (action === 'admin-fulfillment-receive-from-stock') {
    if (!(await requireManager(supabase, body.manager_token, 'import.orders.update'))) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!body.fulfillment_item_id) return json({ error: 'Missing fulfillment item id' }, 400)

    const { data: session, error: sessionError } = await supabase
      .from('import_admin_sessions')
      .select('manager_id')
      .eq('token', body.manager_token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (sessionError || !session?.manager_id) return json({ error: 'Valid manager session required' }, 401)

    const { data, error } = await supabase.rpc('receive_china_import_fulfillment_item_from_stock', {
      p_fulfillment_item_id: body.fulfillment_item_id,
      p_manager_id: session.manager_id,
      p_note: typeof body.note === 'string' ? body.note.trim() || null : null,
    })

    if (error) return json({ error: error.message }, 400)
    return json(data)
  }

  if (action === 'admin-inventory-list') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.view'))) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const requestedPage = Number(body.page)
    const requestedPerPage = Number(body.per_page)
    const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1
    const perPage = Number.isFinite(requestedPerPage) && requestedPerPage >= 1 ? Math.min(50, Math.floor(requestedPerPage)) : 50
    const search = typeof body.search === 'string' ? body.search.trim() : ''

    let query = supabase.from('china_import_products')
      .select('id,name,image_url,category,parent_category,is_active,moq,has_variants,variants,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) query = query.ilike('name', '%' + search + '%')

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const { data: products, error: productsError, count } = await query.range(from, to)
    if (productsError) return json({ error: productsError.message }, 500)

    const ids = (products ?? []).map((p: any) => p.id)
    const { data: inventory, error: inventoryError } = ids.length
      ? await supabase.from('china_import_inventory').select('product_id,variant_options,quantity,updated_at').in('product_id', ids)
      : { data: [], error: null }

    if (inventoryError) return json({ error: inventoryError.message }, 500)

    const stockMap = new Map((inventory ?? []).map((row: any) => [
      row.product_id + '|' + JSON.stringify(row.variant_options ?? {}),
      row,
    ]))

    const rows = (products ?? []).flatMap((product: any) => {
      const groups = Array.isArray(product.variants) ? product.variants : []
      const combinations = groups.length
        ? groups.reduce((acc: Array<Record<string, string>>, group: any) => {
            const options = Array.isArray(group?.options) ? group.options.filter((v: any) => typeof v === 'string' && v.trim()) : []
            if (!options.length) return acc
            if (!acc.length) return options.map((option: string) => ({ [group.name]: option }))
            return acc.flatMap((current: Record<string, string>) =>
              options.map((option: string) => ({ ...current, [group.name]: option }))
            )
          }, [])
        : [{}]

      return combinations.map((variant_options: Record<string, string>) => {
        const stock = stockMap.get(product.id + '|' + JSON.stringify(variant_options))
        return {
          ...product,
          variant_options,
          variant_label: Object.keys(variant_options).length
            ? Object.entries(variant_options).map(([k, v]) => k + ': ' + v).join(', ')
            : 'Base / no variant',
          stock_quantity: Number(stock?.quantity ?? 0),
          stock_updated_at: stock?.updated_at ?? null,
        }
      })
    })

    const total = Number(count ?? 0)
    return json({
      products: rows,
      pagination: { page, per_page: perPage, total, page_count: Math.max(1, Math.ceil(total / perPage)) },
    })
  }

  if (action === 'admin-inventory-set') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.update'))) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!body.product_id) return json({ error: 'Missing product id' }, 400)

    const variantOptions = body.variant_options && typeof body.variant_options === 'object' && !Array.isArray(body.variant_options)
      ? Object.fromEntries(Object.entries(body.variant_options).filter(([key, value]) => typeof key === 'string' && typeof value === 'string' && key.trim() && value.trim()))
      : {}

    const quantity = Number(body.quantity)
    if (!Number.isInteger(quantity) || quantity < 0) return json({ error: 'Stock quantity must be a non-negative whole number' }, 400)

    const { data: session, error: sessionError } = await supabase
      .from('import_admin_sessions')
      .select('manager_id')
      .eq('token', body.manager_token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (sessionError || !session?.manager_id) return json({ error: 'Valid manager session required' }, 401)

    const { data, error } = await supabase
      .from('china_import_inventory')
      .upsert({
        product_id: body.product_id,
        variant_options: variantOptions,
        quantity,
        updated_by: session.manager_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id,variant_options' })
      .select('product_id,variant_options,quantity,updated_at')
      .single()

    if (error) return json({ error: error.message }, 400)
    return json({ inventory: data })
  }

  if (action === 'admin-fulfillment-list') {
    if (!(await requireManager(supabase, body.manager_token, 'import.orders.view'))) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: fulfillment, error: fulfillmentError } = await supabase
      .from('china_import_fulfillment_items')
      .select('id, order_id, order_item_index, product_id, product_name, image_url, variant_options, ordered_quantity, received_quantity, allocated_quantity, shipped_quantity, delivered_quantity, status, received_at')
      .order('created_at', { ascending: false })

    if (fulfillmentError) return json({ error: fulfillmentError.message }, 500)

    const rows = fulfillment ?? []
    if (rows.length === 0) return json({ items: [] })

    const orderIds = Array.from(new Set(rows.map((row: any) => row.order_id).filter(Boolean)))

    const [{ data: orders, error: ordersError }, { data: paidBills, error: billsError }] = await Promise.all([
      supabase.from('china_import_orders')
        .select('id, code, customer_name, customer_whatsapp, user_id, batch_id, status, shipping_method')
        .in('id', orderIds),
      supabase.from('china_import_consolidation_bills')
        .select('order_id')
        .in('order_id', orderIds)
        .eq('kind', 'consolidation_shipping')
        .eq('status', 'paid'),
    ])

    if (ordersError) return json({ error: ordersError.message }, 500)
    if (billsError) return json({ error: billsError.message }, 500)

    const paidOrderIds = new Set((paidBills ?? []).map((row: any) => row.order_id))
    const eligibleOrders = (orders ?? []).filter((order: any) => paidOrderIds.has(order.id))
    const eligibleOrderIds = new Set(eligibleOrders.map((order: any) => order.id))

    const customerIds = Array.from(new Set(eligibleOrders.map((order: any) => order.user_id).filter(Boolean)))
    const batchIds = Array.from(new Set(eligibleOrders.map((order: any) => order.batch_id).filter(Boolean)))
    const productIds = Array.from(new Set(rows.map((row: any) => row.product_id).filter(Boolean)))

    const [{ data: customers, error: customersError }, { data: batches, error: batchesError }, { data: inventory, error: inventoryError }] = await Promise.all([
      customerIds.length
        ? supabase.from('customers').select('id, full_name, phone').in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? supabase.from('import_batches').select('id, opened_at').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? supabase.from('china_import_inventory').select('product_id, variant_options, quantity').in('product_id', productIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (customersError) return json({ error: customersError.message }, 500)
    if (batchesError) return json({ error: batchesError.message }, 500)
    if (inventoryError) return json({ error: inventoryError.message }, 500)

    const customerMap = new Map((customers ?? []).map((row: any) => [row.id, row]))
    const batchMap = new Map((batches ?? []).map((row: any) => [row.id, row]))
    const inventoryMap = new Map((inventory ?? []).map((row: any) => [
      row.product_id + '|' + JSON.stringify(row.variant_options ?? {}),
      Number(row.quantity ?? 0),
    ]))

    const items = rows
      .filter((row: any) => eligibleOrderIds.has(row.order_id))
      .map((row: any) => {
        const order = eligibleOrders.find((candidate: any) => candidate.id === row.order_id)
        const customer = order?.user_id ? customerMap.get(order.user_id) : null
        const batch = order?.batch_id ? batchMap.get(order.batch_id) : null
        return {
          ...row,
          order_code: order?.code ?? '—',
          customer_name: customer?.full_name || order?.customer_name || 'Customer',
          customer_whatsapp: customer?.phone || order?.customer_whatsapp || null,
          batch_id: order?.batch_id ?? null,
          batch_opened_at: batch?.opened_at ?? null,
          order_status: order?.status ?? null,
          shipping_method: order?.shipping_method ?? null,
          stock_quantity: Number(inventoryMap.get(row.product_id + '|' + JSON.stringify(row.variant_options ?? {})) ?? 0),
        }
      })

    return json({ items })
  }

  if (action === 'admin-products') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.view'))) return json({ error: 'Unauthorized' }, 401)

    const requestedPage = Number(body.page)
    const requestedPerPage = Number(body.per_page)
    const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1
    const perPage = Number.isFinite(requestedPerPage) && requestedPerPage >= 1 ? Math.min(50, Math.floor(requestedPerPage)) : 50
    const search = typeof body.search === 'string' ? body.search.trim() : ''
    const status = body.status === 'active' || body.status === 'inactive' ? body.status : 'all'

    let query = supabase.from('china_import_products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false })

    if (search) query = query.ilike('name', '%' + search + '%')
    if (status === 'active') query = query.eq('is_active', true)
    if (status === 'inactive') query = query.eq('is_active', false)

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const { data, error, count } = await query.range(from, to)
    if (error) return json({ error: error.message, products: [] }, 500)

    const total = Number(count ?? 0)
    return json({ products: data ?? [], pagination: { page, per_page: perPage, total, page_count: Math.max(1, Math.ceil(total / perPage)) } })
  }

  if (action === 'admin-product') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.view'))) return json({ error: 'Unauthorized' }, 401)
    if (!body.id) return json({ error: 'Missing product id' }, 400)

    const { data, error } = await supabase.from('china_import_products').select(PRODUCT_SELECT).eq('id', body.id).maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!data) return json({ error: 'Product not found' }, 404)
    return json({ product: data })
  }

  if (action === 'admin-product-create') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.create'))) return json({ error: 'Unauthorized' }, 401)

    const row = buildProductPayload(body)
    if (!row.name) return json({ error: 'Product name is required' }, 400)
    if (!row.description) row.description = ''
    if (!row.image_url) return json({ error: 'Product image URL is required' }, 400)

    const { data, error } = await supabase.from('china_import_products').insert(row).select(PRODUCT_SELECT).single()
    if (error) return json({ error: error.message }, 500)
    return json({ product: data })
  }

  if (action === 'admin-product-update') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.update'))) return json({ error: 'Unauthorized' }, 401)
    if (!body.id) return json({ error: 'Missing product id' }, 400)

    const row = buildProductPayload(body, true)
    row.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('china_import_products').update(row).eq('id', body.id).select(PRODUCT_SELECT).maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!data) return json({ error: 'Product not found' }, 404)
    return json({ product: data })
  }

  if (action === 'admin-product-toggle') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.update'))) return json({ error: 'Unauthorized' }, 401)
    if (!body.id || typeof body.is_active !== 'boolean') return json({ error: 'Missing product id or is_active' }, 400)

    const { data, error } = await supabase.from('china_import_products')
      .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
      .eq('id', body.id).select(PRODUCT_SELECT).maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!data) return json({ error: 'Product not found' }, 404)
    return json({ product: data })
  }

  if (action === 'admin-product-delete') {
    if (!(await requireManager(supabase, body.manager_token, 'import.products.delete'))) return json({ error: 'Unauthorized' }, 401)
    if (!body.id) return json({ error: 'Missing product id' }, 400)

    const { data: existing } = await supabase.from('china_import_products').select('id, name').eq('id', body.id).maybeSingle()
    if (!existing) return json({ error: 'Product not found' }, 404)

    const { error } = await supabase.from('china_import_products').delete().eq('id', body.id)
    if (error) return json({ error: error.message }, 500)
    return json({ success: true, id: body.id })
  }

  return json({ error: 'Unknown action' }, 404)
})
