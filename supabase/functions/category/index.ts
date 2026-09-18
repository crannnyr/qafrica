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

async function requireAdmin(db: any, token: unknown) {
  const t = clean(token)
  if (!t) return false
  const { data, error } = await db.from('import_admin_sessions').select('token')
    .eq('token', t).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error || !data) return false
  await db.from('import_admin_sessions').update({ last_used_at: new Date().toISOString() }).eq('token', t)
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const action = new URL(req.url).searchParams.get('action') ?? 'list'
  try {
    if (req.method === 'GET' && action === 'list') {
      const { data: categories, error: ce } = await db.from('niche_categories')
        .select('id,niche_id,name,sort_order').order('name').order('niche_id').order('sort_order')
      if (ce) return json({ error: ce.message, categories: [] }, 500)
      const { data: subs, error: se } = await db.from('niche_subcategories')
        .select('id,category_id,niche_id,name,sort_order,markup_percent').order('name').order('niche_id').order('sort_order')
      if (se) return json({ error: se.message, categories: [] }, 500)
      return json({ categories: (categories ?? []).map((c: any) => ({
        ...c, subcategories: (subs ?? []).filter((s: any) => s.category_id === c.id && s.niche_id === c.niche_id),
      })) })
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const body = await req.json().catch(() => ({}))
    if (!(await requireAdmin(db, body.manager_token))) return json({ error: 'Unauthorized' }, 401)

    if (action === 'save-category') {
      const name = clean(body.name), niche_id = clean(body.niche_id), id = clean(body.id) || slugify(name)
      if (!name || !niche_id || !id) return json({ error: 'Category name, niche_id and a valid category id are required' }, 400)
      const { data, error } = await db.from('niche_categories')
        .upsert({ id, niche_id, name, sort_order: sort(body.sort_order) }, { onConflict: 'id,niche_id' })
        .select('id,niche_id,name,sort_order').single()
      if (error) return json({ error: error.message }, 400)
      return json({ category: data })
    }

    if (action === 'save-subcategory') {
      const name = clean(body.name), category_id = clean(body.category_id), niche_id = clean(body.niche_id)
      const markup_percent = Number(body.markup_percent ?? 0)
      if (!name || !category_id || !niche_id) return json({ error: 'Niche, category and subcategory name are required' }, 400)
      if (!Number.isFinite(markup_percent) || markup_percent < 0 || markup_percent > 100) return json({ error: 'Markup percentage must be between 0 and 100' }, 400)
      const { data: category, error: ce } = await db.from('niche_categories')
        .select('id,niche_id').eq('id', category_id).eq('niche_id', niche_id).maybeSingle()
      if (ce) return json({ error: ce.message }, 500)
      if (!category) return json({ error: 'Category not found for this niche' }, 400)
      const id = clean(body.id)
      const row = { ...(id ? { id } : {}), category_id, niche_id, name, sort_order: sort(body.sort_order), markup_percent }
      const q = id ? db.from('niche_subcategories').update(row).eq('id', id) : db.from('niche_subcategories').insert(row)
      const { data, error } = await q.select('id,category_id,niche_id,name,sort_order,markup_percent').single()
      if (error) return json({ error: error.message }, 400)
      return json({ subcategory: data })
    }

    if (action === 'delete-category') {
      const id = clean(body.id), niche_id = clean(body.niche_id)
      if (!id || !niche_id) return json({ error: 'Category id and niche_id are required' }, 400)
      const { error } = await db.from('niche_categories').delete().eq('id', id).eq('niche_id', niche_id)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    if (action === 'delete-subcategory') {
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
