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
    .from('import_admin_manager_roles')
    .select('role_id')
    .eq('manager_id', managerId)
  if (assignmentsError) return false

  const roleIds = Array.from(new Set((assignments ?? []).map((row: any) => row.role_id).filter(Boolean)))
  if (roleIds.length === 0) return false

  const { data: rolePermissions, error: rolePermissionsError } = await db
    .from('import_admin_role_permissions')
    .select('permission_id')
    .in('role_id', roleIds)
  if (rolePermissionsError) return false

  const rolePermissionIds = Array.from(new Set(
    (rolePermissions ?? []).map((row: any) => row.permission_id).filter(Boolean),
  ))

  const { data: deniedPermissions, error: deniedPermissionsError } = await db
    .from('import_admin_manager_denied_permissions')
    .select('permission_id')
    .eq('manager_id', managerId)
  if (deniedPermissionsError) return false

  const deniedIds = new Set(
    (deniedPermissions ?? []).map((row: any) => row.permission_id).filter(Boolean),
  )
  const effectivePermissionIds = rolePermissionIds.filter((id: string) => !deniedIds.has(id))
  if (effectivePermissionIds.length === 0) return false

  const { data: permission, error: permissionError } = await db
    .from('import_admin_permissions')
    .select('id')
    .in('id', effectivePermissionIds)
    .eq('key', permissionKey)
    .limit(1)
    .maybeSingle()

  return !permissionError && !!permission
}

async function requireManager(db: any, token: unknown, permissionKey: string) {
  if (!token || typeof token !== 'string') return false

  const { data: session, error } = await db
    .from('import_admin_sessions')
    .select('token, manager_id, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !session?.manager_id) return false

  await db.from('import_admin_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)

  return hasManagerPermission(db, session.manager_id, permissionKey)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (req.method === 'POST' && action === 'admin-products') {
    const body = await req.json().catch(() => ({}))

    if (!(await requireManager(supabase, body.manager_token, 'import.products.view'))) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const requestedPage = Number(body.page)
    const requestedPerPage = Number(body.per_page)
    const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1
    const perPage = Number.isFinite(requestedPerPage) && requestedPerPage >= 1
      ? Math.min(50, Math.floor(requestedPerPage))
      : 50

    const search = typeof body.search === 'string' ? body.search.trim() : ''
    const status = body.status === 'active' || body.status === 'inactive' ? body.status : 'all'

    let query = supabase
      .from('china_import_products')
      .select('id, name, description, image_url, image_urls, price_cny, price_cny_original, price_ngn, price_usd, category, parent_category, category_id, subcategory_id, markup_percent, markup_amount_ngn, original_price_usd, usd_to_ngn_rate, sea_shipping_allocation_ngn, sea_shipping_customer_ngn, air_shipping_customer_ngn, volume_cbm, weight_grams, sea_shipping_cost_ngn, flight_shipping_cost_ngn, is_active, moq, has_variants, variants, delivery_time, ship_only, sort_order, units_sold, is_trending, trending_order, trending_source, created_at', { count: 'exact' })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (search) query = query.ilike('name', '%' + search + '%')
    if (status === 'active') query = query.eq('is_active', true)
    if (status === 'inactive') query = query.eq('is_active', false)

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const { data, error, count } = await query.range(from, to)

    if (error) return json({ error: error.message, products: [] }, 500)

    const total = Number(count ?? 0)
    return json({
      products: data ?? [],
      pagination: {
        page,
        per_page: perPage,
        total,
        page_count: Math.max(1, Math.ceil(total / perPage)),
      },
    })
  }

  return json({ error: 'Unknown action' }, 404)
})
