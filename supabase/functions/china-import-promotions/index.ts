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

function cleanCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

async function requireImportManager(supabase: any, token: unknown, permissionKey: string) {
  if (!token || typeof token !== 'string') return false
  const { data: session, error } = await supabase
    .from('import_admin_sessions')
    .select('token, manager_id, user_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !session) return false

  const roleIds = session.manager_id
    ? (await supabase.from('import_admin_manager_roles').select('role_id').eq('manager_id', session.manager_id)).data?.map((r: any) => r.role_id) ?? []
    : (await supabase.from('import_admin_user_roles').select('role_id').eq('user_id', session.user_id)).data?.map((r: any) => r.role_id) ?? []
  if (!roleIds.length) return false

  const { data: rolePermissions } = await supabase.from('import_admin_role_permissions').select('permission_id').in('role_id', roleIds)
  const permissionIds = (rolePermissions ?? []).map((r: any) => r.permission_id)
  const { data: directPermissions } = session.manager_id
    ? await supabase.from('import_admin_manager_permissions').select('permission_id').eq('manager_id', session.manager_id)
    : { data: [] }
  permissionIds.push(...(directPermissions ?? []).map((r: any) => r.permission_id))

  const { data: permission } = await supabase
    .from('import_admin_permissions')
    .select('id')
    .in('id', Array.from(new Set(permissionIds)))
    .eq('key', permissionKey)
    .maybeSingle()
  return !!permission
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const action = new URL(req.url).searchParams.get('action')
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    if (action === 'validate') {
      const code = cleanCode(body.code)
      const customerId = body.customer_id ?? null
      const subtotalNgn = Number(body.order_subtotal_ngn ?? 0)

      const { data, error } = await supabase.rpc('validate_china_import_promotion', {
        p_code: code,
        p_customer_id: customerId,
        p_order_subtotal_ngn: subtotalNgn,
      })
      if (error) return json({ error: error.message }, 400)

      const promotion = data?.[0] ?? null
      if (!promotion?.promotion_id || !customerId) {
        return json({ promotion })
      }

      // If checkout was started before the promo was applied, keep the same
      // unpaid China Import order and update its promo snapshot instead of
      // forcing the customer into a second pending order. We deliberately use
      // the most recent pending order for this customer/subtotal only.
      const { data: pendingOrder } = await supabase
        .from('china_import_orders')
        .select('id, total_ngn, subtotal_ngn, payment_status')
        .eq('user_id', customerId)
        .in('payment_status', ['unpaid', 'failed'])
        .eq('subtotal_ngn', subtotalNgn)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let pendingOrderSnapshot: any = null
      if (pendingOrder) {
        const discount = Math.max(0, Math.min(Number(promotion.discount_amount_ngn ?? 0), Number(pendingOrder.total_ngn ?? 0)))
        const updatedTotal = Math.max(0, Number(pendingOrder.total_ngn ?? 0) - discount)
        const { data: updatedOrder, error: updateError } = await supabase
          .from('china_import_orders')
          .update({
            promotion_id: promotion.promotion_id,
            promotion_code: promotion.code ?? code,
            promotion_discount_ngn: discount,
            total_ngn: updatedTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingOrder.id)
          .select('id, code, subtotal_ngn, total_ngn, promotion_id, promotion_code, promotion_discount_ngn')
          .single()

        if (!updateError && updatedOrder) pendingOrderSnapshot = updatedOrder
      }

      return json({ promotion, pending_order: pendingOrderSnapshot })
    }

    if (action === 'admin-list') {
      if (!(await requireImportManager(supabase, body.manager_token, 'import.promotions.view'))) return json({ error: 'Unauthorized' }, 401)
      const { data, error } = await supabase.from('china_import_promotions').select('*').order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ promotions: data ?? [] })
    }

    if (action === 'admin-upsert') {
      if (!(await requireImportManager(supabase, body.manager_token, 'import.promotions.manage'))) return json({ error: 'Unauthorized' }, 401)
      const code = cleanCode(body.code)
      if (!code) return json({ error: 'Promo code is required.' }, 400)
      const row = {
        code,
        name: typeof body.name === 'string' ? body.name.trim() || null : null,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        discount_type: body.discount_type,
        discount_value: Number(body.discount_value),
        minimum_order_ngn: Number(body.minimum_order_ngn ?? 0),
        maximum_discount_ngn: body.maximum_discount_ngn === '' || body.maximum_discount_ngn == null ? null : Number(body.maximum_discount_ngn),
        usage_limit: body.usage_limit === '' || body.usage_limit == null ? null : Number(body.usage_limit),
        per_customer_limit: body.per_customer_limit === '' || body.per_customer_limit == null ? null : Number(body.per_customer_limit),
        starts_at: body.starts_at || null,
        expires_at: body.expires_at || null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      }
      if (body.id) {
        const { data, error } = await supabase.from('china_import_promotions').update(row).eq('id', body.id).select().single()
        if (error) return json({ error: error.message }, 400)
        return json({ promotion: data })
      }
      const { data, error } = await supabase.from('china_import_promotions').insert(row).select().single()
      if (error) return json({ error: error.message }, 400)
      return json({ promotion: data })
    }

    if (action === 'admin-toggle') {
      if (!(await requireImportManager(supabase, body.manager_token, 'import.promotions.manage'))) return json({ error: 'Unauthorized' }, 401)
      const { data, error } = await supabase.from('china_import_promotions').update({ is_active: !!body.is_active, updated_at: new Date().toISOString() }).eq('id', body.id).select().single()
      if (error) return json({ error: error.message }, 400)
      return json({ promotion: data })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
