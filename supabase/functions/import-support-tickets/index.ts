import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
})

const clean = (v: unknown, max = 5000) => String(v ?? '').trim().slice(0, max)

async function getManagerId(s: any, token: unknown) {
  if (!token || typeof token !== 'string') throw new Error('Admin authentication required')
  const { data: session, error: se } = await s.from('import_admin_sessions')
    .select('manager_id').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (se || !session) throw new Error('Invalid or expired admin session')
  return session.manager_id as string
}

async function managerHasPermission(s: any, managerId: string, permission: string) {
  const { data: roles, error: re } = await s.from('import_admin_manager_roles')
    .select('role_id').eq('manager_id', managerId)
  if (re) throw re
  const roleIds = (roles ?? []).map((x: any) => x.role_id)
  if (!roleIds.length) return false

  const { data: links, error: le } = await s.from('import_admin_role_permissions')
    .select('permission_id').in('role_id', roleIds)
  if (le) throw le
  const permissionIds = (links ?? []).map((x: any) => x.permission_id)
  if (!permissionIds.length) return false

  const { data: perms, error: pe } = await s.from('import_admin_permissions')
    .select('key').in('id', permissionIds)
  if (pe) throw pe
  return (perms ?? []).some((p: any) => p.key === permission)
}

async function requireAdmin(s: any, token: unknown, permission = 'import.tickets.view') {
  const managerId = await getManagerId(s, token)
  if (!(await managerHasPermission(s, managerId, permission))) {
    throw new Error(`Missing permission: ${permission}`)
  }
  return managerId
}

async function requireTicketViewer(s: any, token: unknown) {
  const managerId = await getManagerId(s, token)
  const canView = await managerHasPermission(s, managerId, 'import.tickets.view')
    || await managerHasPermission(s, managerId, 'import.messages.view')
  if (!canView) throw new Error('Missing permission: import.tickets.view')
  return managerId
}

async function main(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => ({}))
  const action = clean(body.action, 80)
  const token = clean(body.manager_token, 500)
  const s = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  if (action === 'list_tickets') {
    await requireTicketViewer(s, token)
    const status = clean(body.status, 40)
    const query = clean(body.query, 200)
    let q = s.from('import_support_tickets')
      .select('id,ticket_number,customer_id,conversation_id,order_id,order_code,category,subject,description,status,priority,assigned_agent_id,resolution_notes,created_by,created_at,updated_at,resolved_at,closed_at,customers(id,full_name,email,phone,avatar_url)')
      .order('updated_at', { ascending: false }).limit(1000)
    if (status && status !== 'all') q = q.eq('status', status)
    if (query) q = q.or(`subject.ilike.%${query}%,description.ilike.%${query}%,order_code.ilike.%${query}%`)
    const { data, error } = await q
    if (error) throw error
    return { tickets: data ?? [] }
  }

  if (action === 'count_tickets') {
    await requireTicketViewer(s, token)
    const { count, error } = await s.from('import_support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress', 'waiting_customer'])
    if (error) throw error
    return { count: count ?? 0 }
  }

  if (action === 'get_ticket') {
    await requireTicketViewer(s, token)
    const id = clean(body.ticket_id, 80)
    if (!id) throw new Error('ticket_id is required')
    const { data, error } = await s.from('import_support_tickets')
      .select('*,customers(id,full_name,email,phone,avatar_url)')
      .eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Ticket not found')
    let conversation = null
    if (data.conversation_id) {
      const { data: c } = await s.from('import_ai_whatsapp_conversations')
        .select('id,wa_id,channel,customer_id,status,last_inbound_at,last_outbound_at,created_at,updated_at')
        .eq('id', data.conversation_id).maybeSingle()
      conversation = c
    }
    return { ticket: data, conversation }
  }

  if (action === 'create_ticket') {
    const managerId = await requireAdmin(s, token, 'import.tickets.manage')
    const subject = clean(body.subject, 250)
    if (!subject) throw new Error('subject is required')
    const payload = {
      customer_id: clean(body.customer_id, 80) || null,
      conversation_id: clean(body.conversation_id, 80) || null,
      order_id: clean(body.order_id, 80) || null,
      order_code: clean(body.order_code, 80) || null,
      category: clean(body.category, 80) || 'general',
      subject,
      description: clean(body.description, 8000) || null,
      status: clean(body.status, 40) || 'open',
      priority: clean(body.priority, 40) || 'normal',
      assigned_agent_id: clean(body.assigned_agent_id, 80) || managerId,
      created_by: 'admin',
    }
    const { data, error } = await s.from('import_support_tickets').insert(payload)
      .select('*,customers(id,full_name,email,phone,avatar_url)').single()
    if (error) throw error
    return { ticket: data }
  }

  if (action === 'update_ticket') {
    await requireAdmin(s, token, 'import.tickets.manage')
    const id = clean(body.ticket_id, 80)
    if (!id) throw new Error('ticket_id is required')
    const nextStatus = clean(body.status, 40)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of ['category','subject','description','priority','assigned_agent_id','resolution_notes']) {
      if (body[key] !== undefined) updates[key] = body[key] === '' ? null : clean(body[key], 8000)
    }
    if (nextStatus) {
      updates.status = nextStatus
      if (nextStatus === 'resolved') updates.resolved_at = new Date().toISOString()
      if (nextStatus === 'closed') updates.closed_at = new Date().toISOString()
    }
    const { data, error } = await s.from('import_support_tickets').update(updates)
      .eq('id', id).select('*,customers(id,full_name,email,phone,avatar_url)').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Ticket not found')
    return { ticket: data }
  }

  throw new Error('Unknown ticket action')
}

serve(async (req) => {
  try {
    return await main(req)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Ticket request failed' }, 400)
  }
})
