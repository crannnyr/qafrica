import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manager-token' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function authorize(supabase: any, token: string | null, permission: string) {
  if (!token) return null
  const { data: session } = await supabase.from('import_admin_sessions').select('manager_id,user_id').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (!session?.manager_id) return null
  const managerId = session.manager_id
  const { data: assignments } = await supabase.from('import_admin_manager_roles').select('role_id').eq('manager_id', managerId)
  const roleIds = (assignments ?? []).map((r: any) => r.role_id).filter(Boolean)
  const { data: rolePerms } = roleIds.length ? await supabase.from('import_admin_role_permissions').select('permission_id').in('role_id', roleIds) : { data: [] }
  const { data: direct } = await supabase.from('import_admin_manager_permissions').select('permission_id').eq('manager_id', managerId)
  const { data: denied } = await supabase.from('import_admin_manager_denied_permissions').select('permission_id').eq('manager_id', managerId)
  const deniedIds = new Set((denied ?? []).map((r: any) => r.permission_id))
  const ids = Array.from(new Set([...(rolePerms ?? []).map((r: any) => r.permission_id), ...(direct ?? []).map((r: any) => r.permission_id)])).filter((id: string) => !deniedIds.has(id))
  if (!ids.length) return null
  const { data: permissionRow } = await supabase.from('import_admin_permissions').select('id').in('id', ids).eq('key', permission).maybeSingle()
  return permissionRow ? managerId : null
}

async function presentRequest(supabase: any, request: any) {
  const { data: manager } = await supabase.from('import_admin_managers').select('full_name,email').eq('id', request.requested_by).maybeSingle()
  const requesterName = typeof manager?.full_name === 'string' && manager.full_name.trim() ? manager.full_name.trim() : 'Unknown manager'
  return { ...request, amount: Number(request.amount ?? 0), requested_by: requesterName, requested_by_name: manager?.full_name?.trim() || null, requested_by_email: manager?.email || null }
}

async function presentRequests(supabase: any, requests: any[]) {
  return Promise.all((requests ?? []).map((request) => presentRequest(supabase, request)))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const token = req.headers.get('x-manager-token')
  try {
    if (req.method === 'GET' && action === 'list') {
      const managerId = await authorize(supabase, token, 'import.expenses.view')
      if (!managerId) return json({ error: 'Unauthorized' }, 401)
      const status = url.searchParams.get('status')
      let query = supabase.from('import_expense_requests').select('*').order('created_at', { ascending: false }).limit(200)
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (error) return json({ error: error.message }, 500)
      return json({ requests: await presentRequests(supabase, data ?? []) })
    }
    if (req.method === 'POST' && action === 'create') {
      const managerId = await authorize(supabase, token, 'import.expenses.create')
      if (!managerId) return json({ error: 'You do not have permission to create payment requests.' }, 403)
      const body = await req.json().catch(() => ({})); const amount = Number(body.amount)
      if (!body.title?.trim() || !body.purpose?.trim() || !Number.isFinite(amount) || amount <= 0) return json({ error: 'Title, purpose and a valid amount are required.' }, 400)
      if (body.request_type !== 'reimbursement' && (!body.recipient_name?.trim() || !body.recipient_bank_name?.trim() || !body.recipient_account_name?.trim() || !body.recipient_account_number?.trim())) return json({ error: 'Payment requests require recipient name, bank name, account name and account number.' }, 400)
      const { data, error } = await supabase.from('import_expense_requests').insert({ request_type: body.request_type === 'reimbursement' ? 'reimbursement' : 'payment_request', title: body.title.trim(), purpose: body.purpose.trim(), amount, currency: typeof body.currency === 'string' ? body.currency : 'NGN', expense_date: body.expense_date || new Date().toISOString().slice(0, 10), due_date: body.due_date || null, recipient_name: body.recipient_name?.trim() || null, recipient_bank_name: body.recipient_bank_name?.trim() || null, recipient_account_name: body.recipient_account_name?.trim() || null, recipient_account_number: body.recipient_account_number?.trim() || null, recipient_phone: body.recipient_phone?.trim() || null, description: body.description?.trim() || null, related_reference: body.related_reference?.trim() || null, status: 'pending_approval', requested_by: managerId }).select().single()
      if (error) return json({ error: error.message }, 500)
      await supabase.from('import_expense_request_history').insert({ expense_request_id: data.id, action: 'submitted', actor_id: managerId, note: 'Payment request submitted for approval.' })
      return json({ request: await presentRequest(supabase, data) })
    }
    if (req.method === 'POST' && action === 'approve') {
      const managerId = await authorize(supabase, token, 'import.expenses.approve'); if (!managerId) return json({ error: 'You do not have permission to approve expense requests.' }, 403)
      const body = await req.json().catch(() => ({})); const requestId = typeof body.request_id === 'string' ? body.request_id : ''; if (!requestId) return json({ error: 'request_id is required.' }, 400)
      const { data: request, error: fetchError } = await supabase.from('import_expense_requests').select('*').eq('id', requestId).maybeSingle(); if (fetchError) return json({ error: fetchError.message }, 500); if (!request) return json({ error: 'Payment request not found.' }, 404)
      if (request.status !== 'pending_approval') return json({ error: 'Only pending requests can be approved.' }, 409); if (request.requested_by === managerId) return json({ error: 'A request cannot be approved by the same manager who submitted it.' }, 403)
      const now = new Date().toISOString(); const { data: updated, error } = await supabase.from('import_expense_requests').update({ status: 'approved', approved_by: managerId, approved_at: now, rejected_by: null, rejected_at: null, rejection_reason: null, updated_at: now }).eq('id', requestId).eq('status', 'pending_approval').select().maybeSingle()
      if (error) return json({ error: error.message }, 500); if (!updated) return json({ error: 'The request was changed by another action. Refresh and try again.' }, 409)
      const { error: historyError } = await supabase.from('import_expense_request_history').insert({ expense_request_id: requestId, action: 'approved', actor_id: managerId, note: 'Payment request approved.' }); if (historyError) return json({ error: historyError.message }, 500)
      return json({ request: await presentRequest(supabase, updated) })
    }
    if (req.method === 'POST' && action === 'reject') {
      const managerId = await authorize(supabase, token, 'import.expenses.reject'); if (!managerId) return json({ error: 'You do not have permission to reject expense requests.' }, 403)
      const body = await req.json().catch(() => ({})); const requestId = typeof body.request_id === 'string' ? body.request_id : ''; const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (!requestId) return json({ error: 'request_id is required.' }, 400); if (!reason) return json({ error: 'A rejection reason is required.' }, 400)
      const { data: request, error: fetchError } = await supabase.from('import_expense_requests').select('*').eq('id', requestId).maybeSingle(); if (fetchError) return json({ error: fetchError.message }, 500); if (!request) return json({ error: 'Payment request not found.' }, 404)
      if (request.status !== 'pending_approval') return json({ error: 'Only pending requests can be rejected.' }, 409); if (request.requested_by === managerId) return json({ error: 'A request cannot be rejected by the same manager who submitted it.' }, 403)
      const now = new Date().toISOString(); const { data: updated, error } = await supabase.from('import_expense_requests').update({ status: 'rejected', rejected_by: managerId, rejected_at: now, rejection_reason: reason, approved_by: null, approved_at: null, updated_at: now }).eq('id', requestId).eq('status', 'pending_approval').select().maybeSingle()
      if (error) return json({ error: error.message }, 500); if (!updated) return json({ error: 'The request was changed by another action. Refresh and try again.' }, 409)
      const { error: historyError } = await supabase.from('import_expense_request_history').insert({ expense_request_id: requestId, action: 'rejected', actor_id: managerId, note: reason }); if (historyError) return json({ error: historyError.message }, 500)
      return json({ request: await presentRequest(supabase, updated) })
    }
    if (req.method === 'POST' && action === 'mark-paid') {
      const managerId = await authorize(supabase, token, 'import.expenses.pay'); if (!managerId) return json({ error: 'You do not have permission to confirm payments.' }, 403)
      const body = await req.json().catch(() => ({})); const requestId = typeof body.request_id === 'string' ? body.request_id : ''; const paymentReference = typeof body.payment_reference === 'string' ? body.payment_reference.trim() : ''; const note = typeof body.note === 'string' ? body.note.trim() : ''
      if (!requestId) return json({ error: 'request_id is required.' }, 400)
      const { data: request, error: fetchError } = await supabase.from('import_expense_requests').select('id,status').eq('id', requestId).maybeSingle(); if (fetchError) return json({ error: fetchError.message }, 500); if (!request) return json({ error: 'Payment request not found.' }, 404)
      if (request.status !== 'approved') return json({ error: 'Only approved requests can be marked as paid.' }, 409)
      const now = new Date().toISOString(); const { data: updated, error } = await supabase.from('import_expense_requests').update({ status: 'paid', paid_by: managerId, paid_at: now, payment_reference: paymentReference || null, paid_confirmation_note: note || null, updated_at: now }).eq('id', requestId).eq('status', 'approved').select('*').maybeSingle()
      if (error) return json({ error: error.message }, 500); if (!updated) return json({ error: 'The request was changed by another action. Refresh and try again.' }, 409)
      const { error: historyError } = await supabase.from('import_expense_request_history').insert({ expense_request_id: requestId, action: 'paid', actor_id: managerId, note: [paymentReference, note].filter(Boolean).join(' · ') || 'Payment confirmed.' }); if (historyError) return json({ error: historyError.message }, 500)
      return json({ request: await presentRequest(supabase, updated) })
    }
    if (req.method === 'GET' && action === 'history') {
      const managerId = await authorize(supabase, token, 'import.expenses.view'); if (!managerId) return json({ error: 'Unauthorized' }, 401)
      const requestId = url.searchParams.get('request_id'); if (!requestId) return json({ error: 'request_id is required.' }, 400)
      const { data, error } = await supabase.from('import_expense_request_history').select('id,expense_request_id,action,actor_id,note,created_at').eq('expense_request_id', requestId).order('created_at', { ascending: true }); if (error) return json({ error: error.message }, 500)
      return json({ history: data ?? [] })
    }
    return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500) }
})