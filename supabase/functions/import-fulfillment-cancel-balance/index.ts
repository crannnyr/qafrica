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

async function requireOrderUpdatePermission(db: any, token: unknown) {
  if (typeof token !== 'string' || !token.trim()) return null

  const { data: session, error: sessionError } = await db
    .from('import_admin_sessions')
    .select('token, manager_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (sessionError || !session?.manager_id) return null

  await db.from('import_admin_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)

  const managerId = session.manager_id
  const [{ data: assignments, error: rolesError }, { data: direct, error: directError }, { data: denied, error: deniedError }] = await Promise.all([
    db.from('import_admin_manager_roles').select('role_id').eq('manager_id', managerId),
    db.from('import_admin_manager_permissions').select('permission_id').eq('manager_id', managerId),
    db.from('import_admin_manager_denied_permissions').select('permission_id').eq('manager_id', managerId),
  ])
  if (rolesError || directError || deniedError) return null

  const roleIds = [...new Set((assignments ?? []).map((row: any) => row.role_id).filter(Boolean))]
  const { data: rolePermissions, error: rolePermissionsError } = roleIds.length
    ? await db.from('import_admin_role_permissions').select('permission_id').in('role_id', roleIds)
    : { data: [], error: null }
  if (rolePermissionsError) return null

  const deniedIds = new Set((denied ?? []).map((row: any) => row.permission_id))
  const permissionIds = [...new Set([
    ...(rolePermissions ?? []).map((row: any) => row.permission_id),
    ...(direct ?? []).map((row: any) => row.permission_id),
  ])].filter((id: string) => id && !deniedIds.has(id))
  if (!permissionIds.length) return null

  const { data: permission, error: permissionError } = await db
    .from('import_admin_permissions')
    .select('id')
    .in('id', permissionIds)
    .eq('key', 'import.orders.update')
    .limit(1)
    .maybeSingle()

  return permissionError || !permission ? null : managerId
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const body = await req.json().catch(() => ({}))
  const managerId = await requireOrderUpdatePermission(db, body.manager_token)
  if (!managerId) return json({ error: 'Unauthorized: import.orders.update permission required' }, 403)

  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!orderId || !reason) return json({ error: 'Order ID and cancellation reason are required.' }, 400)

  const { data, error } = await db.rpc('cancel_china_import_unfulfilled_balance', {
    p_order_id: orderId,
    p_reason: reason,
    p_manager_id: managerId,
  })
  if (error) return json({ error: error.message }, 400)
  return json(data)
})
