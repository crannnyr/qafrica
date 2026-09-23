import { serve } from 'https://deno.land/std@0.168.0/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const clean = (v: unknown) => typeof v === 'string' ? v.trim() : ''
const sort = (v: unknown) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0
const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

async function hasImportPermission(db: any, userId: string, permissionKey: string): Promise<boolean> {
  const { data: assignments, error: assignmentsError } = await db
    .from('import_admin_user_roles')
    .select('role_id')
    .eq('user_id', userId)
  if (assignmentsError) return false

  const roleIds = Array.from(new Set((assignments ?? []).map((row: any) => row.role_id).filter(Boolean)))
  if (roleIds.length === 0) return false

  const { data: rolePermissions, error: rolePermissionsError } = await db
    .from('import_admin_role_permissions')
    .select('permission_id')
    .in('role_id', roleIds)
  if (rolePermissionsError) return false

  const permissionIds = Array.from(new Set((rolePermissions ?? []).map((row: any) => row.permission_id).filter(Boolean)))
  if (permissionIds.length === 0) return false

  const { data: permission, error: permissionError } = await db
    .from('import_admin_permissions')
    .select('id')
    .in('id', permissionIds)
    .eq('key', permissionKey)
    .limit(1)
    .maybeSingle()

  return !permissionError && !!permission
}

async function hasManagerPermission(db: any, managerId: string, permissionKey: string): Promise<boolean> {
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

  const rolePermissionIds = Array.from(new Set((rolePermissions ?? []).map((row: any) => row.permission_id).filter(Boolean)))

  const { data: deniedPermissions, error: deniedPermissionsError } = await db
    .from('import_admin_manager_denied_permissions')
    .select('permission_id')
    .eq('manager_id', managerId)
  if (deniedPermissionsError) return false

  const deniedIds = new Set((deniedPermissions ?? []).map((row: any) => row.permission_id).filter(Boolean))
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

async function requireAdmin(db: any, token: unknown, permissionKey?: string) {
  const t = clean(token)
  if (!t) return false

  const { data, error } = await db
    .from('import_admin_sessions')
    .select('token,user_id,manager_id')
    .eq('token', t)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return false

  await db.from('import_admin_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', t)

  if (data.manager_id) {
    return permissionKey ? hasManagerPermission(db, data.manager_id, permissionKey) : true
  }

  if (data.user_id) {
    return permissionKey ? hasImportPermission(db, data.user_id, permissionKey) : true
  }

  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const action = new URL(req.url).searchParams.get('action') ?? 'list'

  try {
    if (req.method === 'GET' && action === 'list') {
      const token = new URL(req.url).searchParams.get('manager_token')
      if (!(await requireAdmin(db, token, 'import.categories.view'))) return json({ error: 'Unauthorized' }, 401)

      const [{ data: categories, error: ce }, { data: subs, error: se }, { data: niches, error: ne }] = await Promise.all([
        db.from('niche_categories')
          .select('id,niche_id,name,sort_order')
          .order('name').order('niche_id').order('sort_order'),
        db.from('niche_subcategories')
          .select('id,category_id,niche_id,name,sort_order,markup_percent')
          .order('name').order('niche_id').order('sort_order'),
        db.from('niches')
          .select('id,name')
          .eq('is_active', true)
          .order('sort_order').order('name'),
      ])

      if (ce) return json({ error: ce.message, categories: [] }, 500)
      if (se) return json({ error: se.message, categories: [] }, 500)
      if (ne) return json({ error: ne.message, categories: [] }, 500)

      return json({
        categories: (categories ?? []).map((c: any) => ({
          ...c,
          subcategories: (subs ?? []).filter((s: any) => s.category_id === c.id && s.niche_id === c.niche_id),
        })),
        niches: niches ?? [],
      })
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const body = await req.json().catch(() => ({}))

    if (action === 'save-category') {
      const permission = clean(body.id) ? 'import.categories.update' : 'import.categories.create'
      if (!(await requireAdmin(db, body.manager_token, permission))) return json({ error: 'Forbidden' }, 403)

      const name = clean(body.name)
      const niche_id = clean(body.niche_id)
      const id = clean(body.id) || slugify(name)

      if (!name || !niche_id || !id) return json({ error: 'Category name, niche_id and a valid category id are required' }, 400)

      const { data: niche, error: nicheError } = await db
        .from('niches')
        .select('id')
        .eq('id', niche_id)
        .eq('is_active', true)
        .maybeSingle()
      if (nicheError) return json({ error: nicheError.message }, 500)
      if (!niche) return json({ error: 'Niche not found or inactive' }, 400)

      const { data, error } = await db.from('niche_categories')
        .upsert({ id, niche_id, name, sort_order: sort(body.sort_order) }, { onConflict: 'id,niche_id' })
        .select('id,niche_id,name,sort_order').single()

      if (error) return json({ error: error.message }, 400)
      return json({ category: data })
    }

    if (action === 'save-subcategory') {
      const permission = clean(body.id) ? 'import.categories.update' : 'import.categories.create'
      if (!(await requireAdmin(db, body.manager_token, permission))) return json({ error: 'Forbidden' }, 403)

      const name = clean(body.name)
      const category_id = clean(body.category_id)
      const niche_id = clean(body.niche_id)
      const markup_percent = Number(body.markup_percent ?? 0)

      if (!name || !category_id || !niche_id) return json({ error: 'Niche, category and subcategory name are required' }, 400)
      if (!Number.isFinite(markup_percent) || markup_percent < 0 || markup_percent > 100) return json({ error: 'Markup percentage must be between 0 and 100' }, 400)

      const { data: category, error: ce } = await db.from('niche_categories')
        .select('id,niche_id').eq('id', category_id).eq('niche_id', niche_id).maybeSingle()
      if (ce) return json({ error: ce.message }, 500)
      if (!category) return json({ error: 'Category not found for this niche' }, 400)

      const id = clean(body.id)
      const row = { ...(id ? { id } : {}), category_id, niche_id, name, sort_order: sort(body.sort_order), markup_percent }
      const q = id
        ? db.from('niche_subcategories').update(row).eq('id', id)
        : db.from('niche_subcategories').insert(row)
      const { data, error } = await q.select('id,category_id,niche_id,name,sort_order,markup_percent').single()

      if (error) return json({ error: error.message }, 400)
      return json({ subcategory: data })
    }

    if (action === 'delete-category') {
      if (!(await requireAdmin(db, body.manager_token, 'import.categories.delete'))) return json({ error: 'Forbidden' }, 403)
      const id = clean(body.id)
      const niche_id = clean(body.niche_id)
      if (!id || !niche_id) return json({ error: 'Category id and niche_id are required' }, 400)

      const { error } = await db.from('niche_categories').delete().eq('id', id).eq('niche_id', niche_id)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    if (action === 'delete-subcategory') {
      if (!(await requireAdmin(db, body.manager_token, 'import.categories.delete'))) return json({ error: 'Forbidden' }, 403)
      const id = clean(body.id)
      if (!id) return json({ error: 'Subcategory id is required' }, 400)

      const { error } = await db.from('niche_subcategories').delete().eq('id', id)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
