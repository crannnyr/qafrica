import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna'
type Actor = 'customer' | 'admin' | 'guest'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
})
const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const bearer = (req: Request) => {
  const h = req.headers.get('authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function makeLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

async function customerId(s: any, req: Request) {
  const internal = req.headers.get('x-import-ai-internal-secret')
  const expected = Deno.env.get('IMPORT_AI_INTERNAL_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const internalCustomer = req.headers.get('x-import-ai-customer-id')
  if (expected && internal && internal === expected && internalCustomer) {
    const { data, error } = await s.from('customers').select('id').eq('id', internalCustomer).maybeSingle()
    if (error || !data) throw new Error('WhatsApp customer is not an import customer')
    return data.id
  }

  const token = bearer(req)
  if (!token) throw new Error('Customer authentication required')
  const { data: auth, error } = await s.auth.getUser(token)
  if (error || !auth.user) throw new Error('Invalid customer authentication')
  const { data, error: ce } = await s.from('customers').select('id').eq('id', auth.user.id).maybeSingle()
  if (ce || !data) throw new Error('Authenticated user is not an import customer')
  return data.id
}

async function createWhatsappLink(s:any, req:Request) {
  const id = await customerId(s, req)
  const code = makeLinkCode()
  const codeHash = await sha256(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await s.from('import_ai_whatsapp_links').delete().eq('customer_id', id).is('linked_at', null)
  const { error } = await s.from('import_ai_whatsapp_links').insert({
    customer_id: id,
    code_hash: codeHash,
    expires_at: expiresAt
  })
  if (error) throw error
  return { success:true, code, expires_at:expiresAt, instruction:'Send this code to the QAfrica WhatsApp test number within 10 minutes.' }
}

async function sendWhatsAppText(to: string, body: string) {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
  const version = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v26.0'
  if (!token || !phoneNumberId) throw new Error('WhatsApp sending credentials are not configured')
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('WhatsApp message could not be sent')
  return result
}

async function adminSupportAction(s:any, token:string, action:string, body:any) {
  if (action === 'list_support_conversations') {
    await requireAdmin(s, token, 'import.messages.view')
    const { data, error } = await s.from('import_ai_whatsapp_conversations')
      .select('id,wa_id,channel,customer_id,status,last_inbound_at,last_outbound_at,human_requested_at,human_assigned_at,human_agent_id,created_at,updated_at,customers(id,full_name,email,phone,avatar_url)')
      .in('status', ['ai','returned_to_ai','human_requested','human_assigned','human_active','resolved'])
      .order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    return { conversations: data ?? [] }
  }

  if (action === 'get_support_conversation') {
    await requireAdmin(s, token, 'import.messages.view')
    const id = clean(body.conversation_id, 80)
    if (!id) throw new Error('conversation_id is required')
    const { data: conversation, error: ce } = await s.from('import_ai_whatsapp_conversations')
      .select('id,wa_id,channel,customer_id,status,last_inbound_at,last_outbound_at,human_requested_at,human_assigned_at,human_agent_id,created_at,updated_at,customers(id,full_name,email,phone,avatar_url)')
      .eq('id', id).maybeSingle()
    if (ce) throw ce
    if (!conversation) throw new Error('Conversation not found')
    const { data: messages, error: me } = await s.from('import_ai_whatsapp_messages')
      .select('id,direction,sender_type,body,whatsapp_message_id,metadata,created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true }).limit(300)
    if (me) throw me
    return { conversation, messages: messages ?? [] }
  }

  if (action === 'take_support_conversation') {
    const managerId = await requireAdmin(s, token, 'import.messages.send')
    const id = clean(body.conversation_id, 80)
    if (!id) throw new Error('conversation_id is required')
    const { data: current, error: currentError } = await s.from('import_ai_whatsapp_conversations')
      .select('id,status,channel,human_agent_id')
      .eq('id', id).maybeSingle()
    if (currentError) throw currentError
    if (!current) throw new Error('Conversation not found')
    if (current.status === 'human_active') {
      return { conversation: current, already_active: true }
    }
    if (!['ai','returned_to_ai','human_requested','human_assigned','resolved'].includes(current.status)) {
      throw new Error(`Conversation cannot be taken over from its current status: ${current.status}`)
    }
    const now = new Date().toISOString()
    const { data, error } = await s.from('import_ai_whatsapp_conversations')
      .update({ status: 'human_active', human_assigned_at:now, human_agent_id:managerId, updated_at: now })
      .eq('id', id).in('status', ['ai','returned_to_ai','human_requested','human_assigned','resolved'])
      .select('id,status,channel,human_agent_id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Conversation changed before takeover completed. Refresh and try again.')
    return { conversation: data }
  }

  if (action === 'resolve_support_conversation') {
    await requireAdmin(s, token, 'import.messages.send')
    const id = clean(body.conversation_id, 80)
    const now = new Date().toISOString()
    const { data, error } = await s.from('import_ai_whatsapp_conversations')
      .update({ status: 'resolved', human_agent_id: null, updated_at: now })
      .eq('id', id).in('status', ['ai','returned_to_ai','human_requested','human_assigned','human_active'])
      .select('id,status,channel').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Conversation is already resolved or not found')
    return { conversation: data }
  }

  if (action === 'return_support_to_ai') {
    await requireAdmin(s, token, 'import.messages.send')
    const id = clean(body.conversation_id, 80)
    const { data, error } = await s.from('import_ai_whatsapp_conversations')
      .update({ status: 'returned_to_ai', human_agent_id: null, updated_at: new Date().toISOString() })
      .eq('id', id).in('status', ['human_requested','human_assigned','human_active'])
      .select('id,status,channel').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Conversation is no longer with human support')
    return { conversation: data }
  }

  if (action === 'send_human_message') {
    await requireAdmin(s, token, 'import.messages.send')
    const id = clean(body.conversation_id, 80)
    const message = clean(body.message, 4000)
    if (!id || !message) throw new Error('conversation_id and message are required')
    const { data: conversation, error: ce } = await s.from('import_ai_whatsapp_conversations')
      .select('id,wa_id,channel,status').eq('id', id).maybeSingle()
    if (ce) throw ce
    if (!conversation) throw new Error('Conversation not found')
    if (!['human_requested','human_assigned','human_active'].includes(conversation.status)) {
      throw new Error('Conversation is not currently with human support')
    }

    if (conversation.channel === 'whatsapp') {
      await sendWhatsAppText(conversation.wa_id, message)
    }

    const { data: saved, error: me } = await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: id, direction: 'outbound', sender_type: 'human', body: message,
      metadata: { channel: conversation.channel, delivery: conversation.channel === 'website' ? 'realtime' : 'whatsapp' }
    }).select('id,direction,sender_type,body,metadata,created_at').single()
    if (me) throw me

    await s.from('import_ai_whatsapp_conversations').update({
      status: 'human_active', last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', id)
    return { message: saved, channel: conversation.channel }
  }

  throw new Error('Unknown support action')
}

async function requireAdmin(s: any, token: unknown, permission: string) {
  if (!token || typeof token !== 'string') throw new Error('Admin authentication required')
  const { data: session, error: se } = await s.from('import_admin_sessions')
    .select('manager_id').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (se || !session) throw new Error('Invalid or expired admin session')

  const { data: roles, error: re } = await s.from('import_admin_manager_roles')
    .select('role_id').eq('manager_id', session.manager_id)
  if (re) throw re
  const roleIds = (roles ?? []).map((x: any) => x.role_id)
  if (!roleIds.length) throw new Error(`Missing permission: ${permission}`)

  const { data: links, error: le } = await s.from('import_admin_role_permissions')
    .select('permission_id').in('role_id', roleIds)
  if (le) throw le
  const permissionIds = (links ?? []).map((x: any) => x.permission_id)
  if (!permissionIds.length) throw new Error(`Missing permission: ${permission}`)

  const { data: perms, error: pe } = await s.from('import_admin_permissions')
    .select('key').in('id', permissionIds)
  if (pe) throw pe
  if (!(perms ?? []).some((p: any) => p.key === permission))
    throw new Error(`Missing permission: ${permission}`)
  return session.manager_id
}

const customerTools = [
  { type:'function', name:'get_terms_of_service', description:'Fetch QAfrica’s current general Terms of Service from https://qafrica.store/terms-of-service. Use this for general account/platform terms. This tool only reads the fixed official URL.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_import_terms', description:'Fetch QAfrica’s current Import Terms & Conditions from https://qafrica.store/import-terms. Use this for import-order questions about cancellations, refunds, billing stages, shipping timelines, delivery, pickup, defects, damaged items, or customer responsibilities. This tool only reads the fixed official URL.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_profile', description:'Get the authenticated import customer profile.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_orders', description:'Get authenticated customer import orders that currently exist in china_import_orders.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_failed_orders', description:'Get authenticated customer import orders that expired or were removed after payment confirmation timed out. These are the same expired/removed orders shown in the customer dashboard. Use this when the customer asks how many orders they have, asks for all order codes, or asks about an expired/removed order.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'track_my_order', description:'Track one of the authenticated customer orders by order code.', parameters:{type:'object',properties:{code:{type:'string'}},required:['code'],additionalProperties:false}},
  { type:'function', name:'get_my_order_context', description:'Get the complete customer-safe lifecycle context for one authenticated order: current customer-facing stage, payment state, shipping method, key timestamps, the customer-facing consolidation & shipping bill and its recorded delivery estimate, plus matching refund or expired-order records. Use this for questions about where an order is, what happens next, when it should arrive, whether payment was confirmed, shipping fees, cancellation/refund status, or a specific order code.', parameters:{type:'object',properties:{code:{type:'string'}},required:['code'],additionalProperties:false}},
  { type:'function', name:'get_my_bills', description:'Get the authenticated customer consolidation & shipping bills. Do not treat internal clearance records as a separate customer-facing bill.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_refunds', description:'Get refund records belonging only to the authenticated customer, including refund status and verified refund details.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_addresses', description:'Get the authenticated customer import address book and defaults.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'search_products', description:'Search active QAfrica import products. Never expose supplier source URLs.', parameters:{type:'object',properties:{query:{type:'string'},category:{type:'string'},limit:{type:'integer',minimum:1,maximum:8}},required:['query'],additionalProperties:false}},
  { type:'function', name:'submit_product_question', description:'Submit a product question only when the customer explicitly asks to send it to QAfrica support.', parameters:{type:'object',properties:{product_id:{type:'string'},question:{type:'string',maxLength:1000}},required:['product_id','question'],additionalProperties:false}},
  { type:'function', name:'get_product_from_url', description:'Resolve a QAfrica import product from a customer-facing URL in the exact form https://qafrica.store/recommendations/<product-uuid>. Never fetch arbitrary URLs and never expose supplier source URLs.', parameters:{type:'object',properties:{url:{type:'string',maxLength:500}},required:['url'],additionalProperties:false}},
  { type:'function', name:'get_my_cart', description:'Get the authenticated customer import cart, including product names, selected variants, quantities, unit prices and subtotal.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'add_to_cart', description:'Add an active import product to the authenticated customer import cart. Only use this after the customer explicitly asks to add/buy the item. Validate the product and every required variant against the database before changing the cart.', parameters:{type:'object',properties:{product_id:{type:'string'},quantity:{type:'integer',minimum:1,maximum:10000},variant_selection:{type:'object',additionalProperties:{type:'string'}}},required:['product_id','quantity'],additionalProperties:false}},
  { type:'function', name:'update_cart_item', description:'Change the quantity of one item in the authenticated customer import cart. Use only when the customer explicitly asks to change the quantity. Quantity 0 removes the item.', parameters:{type:'object',properties:{cart_key:{type:'string',maxLength:500},quantity:{type:'integer',minimum:0,maximum:10000}},required:['cart_key','quantity'],additionalProperties:false}},
  { type:'function', name:'remove_from_cart', description:'Remove one item from the authenticated customer import cart when the customer explicitly asks to remove it.', parameters:{type:'object',properties:{cart_key:{type:'string',maxLength:500}},required:['cart_key'],additionalProperties:false}},
  { type:'function', name:'clear_import_cart', description:'Clear the authenticated customer import cart only when the customer explicitly asks to clear/remove everything.', parameters:{type:'object',properties:{},additionalProperties:false}},
]
const requestHumanSupportTool = {
  type:'function',
  name:'request_human_support',
  description:'Request a human QAfrica support agent to take over the same support conversation. Use this when the customer explicitly asks for a human, when a payment dispute or account issue cannot be verified with the available tools, when the customer needs an action you cannot perform, or when a genuine issue remains unresolved after focused troubleshooting. On the website this hands the current authenticated website chat to the Import Admin support inbox; on WhatsApp it hands over the current WhatsApp conversation.',
  parameters:{type:'object',properties:{reason:{type:'string',maxLength:300}},required:['reason'],additionalProperties:false}
}
const whatsappCustomerTools = [...customerTools, requestHumanSupportTool]

const guestTools = [
  { type:'function', name:'get_terms_of_service', description:'Fetch QAfrica’s current general Terms of Service from the official QAfrica site.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_import_terms', description:'Fetch QAfrica’s current Import Terms & Conditions for general import-order policy questions.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'search_products', description:'Search active QAfrica import products. Never expose supplier source URLs.', parameters:{type:'object',properties:{query:{type:'string'},category:{type:'string'},limit:{type:'integer',minimum:1,maximum:8}},required:['query'],additionalProperties:false}},
]

const adminTools = [
  { type:'function', name:'get_terms_of_service', description:'Fetch QAfrica’s current general Terms of Service from https://qafrica.store/terms-of-service. Use this for general account/platform terms. This tool only reads the fixed official URL.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_import_terms', description:'Fetch QAfrica’s current Import Terms & Conditions from https://qafrica.store/import-terms. Use this for import-order questions about cancellations, refunds, billing stages, shipping timelines, delivery, pickup, defects, damaged items, or customer responsibilities. This tool only reads the fixed official URL.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'search_customers', description:'Search import customers and their order summary. Requires import.clients.view.', parameters:{type:'object',properties:{search:{type:'string'},limit:{type:'integer',minimum:1,maximum:25}},additionalProperties:false}},
  { type:'function', name:'get_customer_detail', description:'Get one import customer, orders, bills and failed orders. Requires import.clients.view.', parameters:{type:'object',properties:{customer_id:{type:'string'}},required:['customer_id'],additionalProperties:false}},
  { type:'function', name:'get_import_analytics', description:'Get the existing import analytics RPC output. Requires import.analytics.view.', parameters:{type:'object',properties:{date_from:{type:'string'},date_to:{type:'string'}},additionalProperties:false}},
  { type:'function', name:'get_batch_breakdown', description:'Get the existing closed-batch breakdown. Requires import.orders.view.', parameters:{type:'object',properties:{batch_key:{type:'string'},kind:{type:'string',enum:['consolidation_shipping','clearance']}},required:['batch_key'],additionalProperties:false}},
  { type:'function', name:'get_customer_questions', description:'List import product questions. Requires import.questions.view.', parameters:{type:'object',properties:{status:{type:'string',enum:['open','answered','all']},limit:{type:'integer',minimum:1,maximum:50}},additionalProperties:false}},
  { type:'function', name:'get_failed_orders', description:'List unrecovered timed-out import orders. Requires import.timed_out.view.', parameters:{type:'object',properties:{search:{type:'string'},limit:{type:'integer',minimum:1,maximum:50}},additionalProperties:false}},
]

async function fetchLegalPage(url:string) {
  const r = await fetch(url, { headers: { 'Accept': 'text/html,text/plain;q=0.9' } });
  if (!r.ok) throw new Error('Official policy page could not be fetched');
  const html = await r.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return { url, text:text.slice(0,20000) };
}

async function getImportTerms(s:any) {
  const {data,error}=await s.from('legal_documents').select('content,updated_at').eq('type','import_terms').maybeSingle();
  if(error) throw error;
  if(!data?.content) throw new Error('Current Import Terms are unavailable');
  const text=String(data.content)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ')
    .trim();
  return {url:'https://qafrica.store/import-terms',updated_at:data.updated_at,text:text.slice(0,20000)};
}

async function getOrCreateWebsiteConversation(s:any, req:Request) {
  const id = await customerId(s, req)
  const { data: existing, error } = await s.from('import_ai_whatsapp_conversations')
    .select('id,status')
    .eq('customer_id', id)
    .eq('channel','website')
    .maybeSingle()
  if (error) throw error
  if (existing) return existing
  const { data, error: insertError } = await s.from('import_ai_whatsapp_conversations')
    .insert({ customer_id:id, wa_id:`web:${id}`, channel:'website', status:'ai' })
    .select('id,status')
    .single()
  if (insertError) throw insertError
  return data
}

async function appendSupportMessage(s:any, conversationId:string, direction:'inbound'|'outbound', senderType:'customer'|'ai'|'human', body:string, metadata:any = {channel:'website'}) {
  const { data, error } = await s.from('import_ai_whatsapp_messages')
    .insert({ conversation_id:conversationId, direction, sender_type:senderType, body, metadata })
    .select('id,direction,sender_type,body,metadata,created_at')
    .single()
  if (error) throw error
  return data
}

async function requestHumanSupport(s:any, req:Request, actor:Actor, conversationId:string|null, reason:string, channel='whatsapp') {
  if (actor !== 'customer') throw new Error('Human handoff is only available to authenticated customers')
  const id = await customerId(s, req)
  let targetId = conversationId
  if (channel === 'website') {
    if (!targetId) targetId = (await getOrCreateWebsiteConversation(s, req)).id
  } else if (!targetId) {
    throw new Error('WhatsApp conversation context is required for human handoff')
  }

  const { data: conversation, error } = await s.from('import_ai_whatsapp_conversations')
    .select('id,customer_id,status,channel')
    .eq('id', targetId).maybeSingle()
  if (error) throw error
  if (!conversation) throw new Error(channel === 'website' ? 'Website support conversation not found' : 'WhatsApp conversation not found')
  if (conversation.customer_id !== id) throw new Error('Support conversation does not belong to this customer')
  if (['human_requested','human_assigned','human_active'].includes(conversation.status)) {
    return { success:true, status:conversation.status, already_with_human:true, conversation_id:targetId, channel:conversation.channel }
  }
  if (!['ai','returned_to_ai'].includes(conversation.status)) {
    throw new Error('This conversation cannot be handed to human support from its current state')
  }

  const now = new Date().toISOString()
  const { data, error: updateError } = await s.from('import_ai_whatsapp_conversations')
    .update({ status:'human_requested', human_requested_at:now, updated_at:now })
    .eq('id', targetId).select('id,status,channel').single()
  if (updateError) throw updateError

  await appendSupportMessage(
    s, targetId, 'inbound', 'customer',
    'Customer requested human support.' + (reason ? ' Reason: ' + clean(reason,300) : ''),
    { channel:conversation.channel, event:'human_request' }
  )
  return { success:true, status:data.status, reason:clean(reason,300), conversation_id:targetId, channel:data.channel }
}

function importCartKey(productId:string, selection?:Record<string,string>) {
  if (!selection || Object.keys(selection).length === 0) return productId;
  return `${productId}::${Object.keys(selection).sort().map(k => `${k}:${selection[k]}`).join('|')}`;
}
function parseQafricaProductUrl(value:unknown) {
  const raw=clean(value,500); let url:URL;
  try { url=new URL(raw); } catch { throw new Error('That is not a valid QAfrica product URL'); }
  if (!['qafrica.store','www.qafrica.store'].includes(url.hostname.toLowerCase()) || url.protocol !== 'https:') throw new Error('Only official QAfrica product URLs are supported');
  const match=url.pathname.match(/^\/recommendations\/([0-9a-fA-F-]{36})\/?$/);
  if (!match) throw new Error('Use a QAfrica product link like https://qafrica.store/recommendations/<product-id>');
  return match[1];
}
function validateImportVariantSelection(product:any, selection:any) {
  const chosen:Record<string,string> = selection && typeof selection === 'object' && !Array.isArray(selection) ? selection : {};
  const groups=Array.isArray(product.variants) ? product.variants : [];
  if (!product.has_variants || groups.length === 0) { if (Object.keys(chosen).length) throw new Error('This product does not have selectable variants'); return {selection:{},price:Number(product.price_ngn)}; }
  for (const group of groups) { const value=chosen[group.name]; if (!value) throw new Error(`Please choose ${group.name} before adding this item to your cart`); if (!Array.isArray(group.options) || !group.options.includes(value)) throw new Error(`The selected ${group.name} option is not available for this product`); }
  for (const key of Object.keys(chosen)) if (!groups.some((g:any)=>g.name===key)) throw new Error(`Unknown variant option: ${key}`);
  let price=Number(product.price_ngn); for (const group of groups) price += Number(group.price_deltas?.[chosen[group.name]] ?? 0);
  return {selection:chosen,price};
}
async function getImportCart(s:any,id:string) {
  const {data,error}=await s.from('import_customer_carts').select('items,updated_at').eq('customer_id',id).maybeSingle(); if(error) throw error;
  const items=Array.isArray(data?.items) ? data.items : []; return {items,updated_at:data?.updated_at??null,subtotal:items.reduce((sum:number,item:any)=>sum+Number(item.price_ngn??0)*Number(item.quantity??0),0)};
}
async function saveImportCart(s:any,id:string,items:any[]) {
  const {data,error}=await s.from('import_customer_carts').upsert({customer_id:id,items,updated_at:new Date().toISOString()},{onConflict:'customer_id'}).select('items,updated_at').single(); if(error) throw error;
  const saved=Array.isArray(data?.items) ? data.items : []; return {items:saved,updated_at:data?.updated_at??null,subtotal:saved.reduce((sum:number,item:any)=>sum+Number(item.price_ngn??0)*Number(item.quantity??0),0)};
}

async function customerTool(s:any, req:Request, actor:Actor, name:string, a:any, context:{channel:string,conversationId:string|null}) {
  if (name === 'get_terms_of_service') return await fetchLegalPage('https://qafrica.store/terms-of-service')
  if (name === 'get_import_terms') return await getImportTerms(s)
  const id = actor === 'customer' ? await customerId(s, req) : null
  if (name === 'request_human_support') return await requestHumanSupport(s, req, actor, context.conversationId, clean(a.reason,300), context.channel)
  if (actor === 'guest' && name === 'search_products') {
    const q=clean(a.query,120), limit=Math.min(Math.max(Number(a.limit??8),1),8)
    let query=s.from('china_import_products').select('id,name,description,image_url,image_urls,price_ngn,category,is_active,has_variants,variants,delivery_time,moq,is_trending,ship_only,volume_cbm,weight_grams,sea_shipping_cost_ngn,flight_shipping_cost_ngn').eq('is_active',true).ilike('name',`%${q}%`).order('is_trending',{ascending:false}).order('sort_order',{ascending:true}).limit(limit)
    if(a.category) query=query.ilike('category',`%${clean(a.category,80)}%`)
    const {data,error}=await query
    if(error) throw error
    return {products:data??[]}
  }
  if (name === 'get_my_profile') {
    const {data,error}=await s.from('customers').select('id,email,full_name,phone,avatar_url,is_verified,created_at,updated_at,signup_source,username,terms_accepted_at,terms_version,import_default_delivery_mode,import_default_pickup_station_id').eq('id',id).single(); if(error)throw error; return data
  }
  if (name === 'get_my_orders') {
    const {data,error}=await s.from('china_import_orders').select('id,code,status,payment_status,payment_method,total_ngn,delivery_type,items,created_at,delivery_mode,pickup_station_id,pickup_station_name,pickup_station_address,shipping_method,delivery_address,restored_at,shipped_at,received_at').eq('user_id',id).order('created_at',{ascending:false}).limit(200); if(error)throw error; return {orders:data??[]}
  }
  if (name === 'get_my_failed_orders') {
    const {data,error}=await s.from('china_import_failed_orders').select('id,code,items,total_ngn,delivery_type,order_created_at,failed_at,restored_at,restored_order_id').eq('user_id',id).order('failed_at',{ascending:false}).limit(100); if(error)throw error; return {failed_orders:data??[]}
  }
  if (name === 'track_my_order') {
    const {data,error}=await s.from('china_import_orders').select('id,code,status,payment_status,payment_method,total_ngn,items,created_at,delivery_mode,pickup_station_name,pickup_station_address,shipping_method,delivery_address,shipped_at,received_at').eq('user_id',id).eq('code',clean(a.code,80)).maybeSingle(); if(error)throw error
    if(!data)return {found:false}; const {data:bill}=await s.from('china_import_consolidation_bills').select('id,status,kind,amount_ngn,delivery_estimate_start_at,delivery_estimate_min_at,delivery_estimate_max_at').eq('user_id',id).eq('order_id',data.id).order('created_at',{ascending:false}).limit(1).maybeSingle(); return {found:true,order:data,latest_bill:bill??null}
  }
  if (name === 'get_my_order_context') {
    const code = clean(a.code, 80);
    const {data:order,error} = await s.from('china_import_orders')
      .select('id,code,status,payment_status,payment_method,total_ngn,items,created_at,paid_at,staged_at,shipped_at,received_at,delivery_mode,pickup_station_name,pickup_station_address,shipping_method,delivery_address,prepaid_shipping_ngn,restored_at,restored_from_failed_order_id')
      .eq('user_id',id).eq('code',code).maybeSingle();
    if(error) throw error;
    if(!order) {
      const {data:failed,error:fe}=await s.from('china_import_failed_orders')
        .select('id,code,items,total_ngn,delivery_type,order_created_at,failed_at,restored_at,restored_order_id')
        .eq('user_id',id).eq('code',code).maybeSingle();
      if(fe) throw fe;
      return {found:false, expired_order:failed??null};
    }

    const [{data:bills,error:be},{data:refunds,error:re}] = await Promise.all([
      s.from('china_import_consolidation_bills')
        .select('id,order_id,amount_ngn,reason,status,line_items,created_at,customer_marked_paid_at,confirmed_paid_at,delivery_estimate_start_at,delivery_estimate_min_at,delivery_estimate_max_at,delivery_delay_notice_at')
        .eq('user_id',id).eq('order_id',order.id).eq('kind','consolidation_shipping').order('created_at',{ascending:false}).limit(10),
      s.from('china_import_refunds')
        .select('id,original_order_id,code,total_ngn,cancel_reason,status,cancellation_type,refund_amount_ngn,cancellation_fee_ngn,refund_policy,refund_method,payment_method,payment_reference,bank_details_submitted_at,paid_at,cancelled_at,created_at,paystack_refund_status,paystack_refunded_at,refund_error,billing_bill_id')
        .eq('user_id',id).eq('original_order_id',order.id).order('created_at',{ascending:false}).limit(20)
    ]);
    if(be) throw be; if(re) throw re;

    const stageMap:any = {
      pending:{label:'Order Received',description:'Your order has been received and is being processed.'},
      confirmed:{label:'Order Confirmed',description:'Your payment/order details have been confirmed.'},
      billed:{label:'At Consolidation Warehouse',description:'Your consolidation & shipping bill has been raised and your order is at the warehouse stage.'},
      to_review:{label:'Shipped to Nigeria',description:'Your shipment has left the consolidation warehouse and is on its way to Nigeria.'},
      ordered:{label:'Order Placed',description:'Your items have been placed with the supplier.'},
      ordered_and_closed:{label:'At Consolidation Warehouse',description:'Your consolidation & shipping bill has been raised and your order is at the warehouse stage.'},
      shipped_and_closed:{label:'Shipped to Nigeria',description:'Your shipment has left the consolidation warehouse and is on its way to Nigeria.'},
      clearance_and_closed:{label:'Nigeria Clearance',description:'Your shipment has arrived in Nigeria and is going through the clearance stage.'},
      received:{label:'Received',description:'Your order has been received and is ready for the final delivery or pickup step.'}
    };
    const stage = stageMap[order.status] ?? {label:order.status,description:'Current order stage recorded by QAfrica.'};
    const latestBill = (bills??[])[0] ?? null;
    const estimate = latestBill ? {
      start_at: latestBill.delivery_estimate_start_at,
      min_at: latestBill.delivery_estimate_min_at,
      max_at: latestBill.delivery_estimate_max_at,
      delay_notice_at: latestBill.delivery_delay_notice_at
    } : null;
    return {
      found:true,
      order,
      customer_facing_stage:stage,
      consolidation_shipping_bill:latestBill,
      delivery_estimate:estimate,
      refunds:refunds??[]
    };
  }
  if (name === 'get_my_refunds') {
    const {data,error}=await s.from('china_import_refunds')
      .select('id,original_order_id,code,total_ngn,cancel_reason,status,cancellation_type,refund_amount_ngn,cancellation_fee_ngn,refund_policy,refund_method,payment_method,payment_reference,bank_details_submitted_at,paid_at,cancelled_at,created_at,paystack_refund_status,paystack_refunded_at,refund_error,billing_bill_id')
      .eq('user_id',id).order('created_at',{ascending:false}).limit(50);
    if(error)throw error;
    return {refunds:data??[]};
  }
  if (name === 'get_my_bills') {
    const {data,error}=await s.from('china_import_consolidation_bills').select('id,order_id,amount_ngn,reason,kind,bank_account_number,bank_name,bank_account_name,status,line_items,created_at,customer_marked_paid_at,confirmed_paid_at,delivery_estimate_start_at,delivery_estimate_min_at,delivery_estimate_max_at').eq('user_id',id).eq('kind','consolidation_shipping').order('created_at',{ascending:false}).limit(100); if(error)throw error; return {bills:data??[]}
  }
  if (name === 'get_my_addresses') {
    const [{data:addresses,error:ae},{data:defaults,error:de}]=await Promise.all([
      s.from('import_customer_addresses').select('id,label,name,phone,address_line1,address_line2,city,state,landmark,is_default,preferred_pickup_station_id,created_at,updated_at').eq('customer_id',id).order('is_default',{ascending:false}).order('updated_at',{ascending:false}),
      s.from('customers').select('import_default_delivery_mode,import_default_pickup_station_id').eq('id',id).single()
    ]); if(ae)throw ae;if(de)throw de;return {addresses:addresses??[],defaults}
  }
  if (name === 'search_products') {
    const q=clean(a.query,120), limit=Math.min(Math.max(Number(a.limit??8),1),8)
    let query=s.from('china_import_products').select('id,name,description,image_url,image_urls,price_ngn,category,is_active,has_variants,variants,delivery_time,moq,is_trending,ship_only,volume_cbm,weight_grams,sea_shipping_cost_ngn,flight_shipping_cost_ngn').eq('is_active',true).ilike('name',`%${q}%`).order('is_trending',{ascending:false}).order('sort_order',{ascending:true}).limit(limit)
    if(a.category)query=query.ilike('category',`%${clean(a.category,80)}%`); const {data,error}=await query;if(error)throw error;return {products:data??[]}
  }
  if (name === 'get_product_from_url') {
    const pid=parseQafricaProductUrl(a.url); const {data,error}=await s.from('china_import_products').select('id,name,description,image_url,image_urls,price_ngn,category,is_active,has_variants,variants,delivery_time,moq,is_trending,ship_only,volume_cbm,weight_grams,sea_shipping_cost_ngn,flight_shipping_cost_ngn').eq('id',pid).eq('is_active',true).maybeSingle();
    if(error) throw error; if(!data) throw new Error('That QAfrica product is no longer available'); return {product:data,canonical_url:`https://qafrica.store/recommendations/${data.id}`};
  }
  if (name === 'get_my_cart') return await getImportCart(s,id);
  if (name === 'add_to_cart') {
    const pid=clean(a.product_id,80), quantity=Math.floor(Number(a.quantity)); if(!pid) throw new Error('product_id is required'); if(!Number.isInteger(quantity)||quantity<1||quantity>10000) throw new Error('Quantity must be between 1 and 10000');
    const {data:product,error:pe}=await s.from('china_import_products').select('id,name,description,image_url,image_urls,price_ngn,category,is_active,has_variants,variants,delivery_time,moq,is_trending,ship_only,volume_cbm,weight_grams,sea_shipping_cost_ngn,flight_shipping_cost_ngn').eq('id',pid).eq('is_active',true).maybeSingle(); if(pe) throw pe; if(!product) throw new Error('Product not found or inactive');
    const moq=Math.max(1,Number(product.moq??1)); if(quantity<moq) throw new Error(`Minimum order quantity for this product is ${moq}`); const checked=validateImportVariantSelection(product,a.variant_selection); const cart=await getImportCart(s,id); const cart_key=importCartKey(pid,checked.selection); const existing=cart.items.find((item:any)=>item.cart_key===cart_key);
    const next=existing?cart.items.map((item:any)=>item.cart_key===cart_key?{...item,quantity:Number(item.quantity??0)+quantity}:item):[...cart.items,{...product,price_ngn:checked.price,quantity,variant_selection:Object.keys(checked.selection).length?checked.selection:undefined,cart_key}]; const saved=await saveImportCart(s,id,next);
    return {success:true,added:{product_id:pid,name:product.name,quantity,variant_selection:checked.selection,unit_price_ngn:checked.price},cart:saved,cart_url:'https://qafrica.store/recommendations'};
  }
  if (name === 'update_cart_item') {
    const cartKey=clean(a.cart_key,500), quantity=Math.floor(Number(a.quantity)); if(!cartKey) throw new Error('cart_key is required'); if(!Number.isInteger(quantity)||quantity<0||quantity>10000) throw new Error('Quantity must be between 0 and 10000'); const cart=await getImportCart(s,id); if(!cart.items.some((item:any)=>item.cart_key===cartKey)) throw new Error('Cart item not found');
    const next=quantity===0?cart.items.filter((item:any)=>item.cart_key!==cartKey):cart.items.map((item:any)=>item.cart_key===cartKey?{...item,quantity}:item); const saved=await saveImportCart(s,id,next); return {success:true,cart:saved,cart_url:'https://qafrica.store/recommendations'};
  }
  if (name === 'remove_from_cart') {
    const cartKey=clean(a.cart_key,500); if(!cartKey) throw new Error('cart_key is required'); const cart=await getImportCart(s,id); const next=cart.items.filter((item:any)=>item.cart_key!==cartKey); if(next.length===cart.items.length) throw new Error('Cart item not found'); const saved=await saveImportCart(s,id,next); return {success:true,cart:saved,cart_url:'https://qafrica.store/recommendations'};
  }
  if (name === 'clear_import_cart') { const saved=await saveImportCart(s,id,[]); return {success:true,cart:saved,cart_url:'https://qafrica.store/recommendations'}; }
  if (name === 'submit_product_question') {
    const pid=clean(a.product_id,80), question=clean(a.question,1000); if(!pid||!question)throw new Error('product_id and question are required')
    const [{data:c},{data:p}]=await Promise.all([s.from('customers').select('full_name,email').eq('id',id).single(),s.from('china_import_products').select('id,name').eq('id',pid).eq('is_active',true).maybeSingle()])
    if(!p)throw new Error('Product not found or inactive')
    const {data,error}=await s.from('china_import_product_questions').insert({product_id:pid,user_id:id,customer_name:c?.full_name??null,customer_email:c?.email??null,question}).select('id,product_id,question,status,created_at').single();if(error)throw error;return {success:true,question:data}
  }
  throw new Error(`Unknown customer tool: ${name}`)
}

async function adminTool(s:any, token:string, name:string, a:any) {
  if (name === 'get_terms_of_service') return await fetchLegalPage('https://qafrica.store/terms-of-service')
  if (name === 'get_import_terms') return await fetchLegalPage('https://qafrica.store/import-terms')
  if(name==='search_customers'){
    await requireAdmin(s,token,'import.clients.view'); const search=clean(a.search,120),limit=Math.min(Math.max(Number(a.limit??25),1),25)
    let q=s.from('customers').select('id,full_name,email,phone,avatar_url,created_at').eq('signup_source','importation').order('created_at',{ascending:false}).limit(limit)
    if(search)q=q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    const {data:cs,error}=await q;if(error)throw error;const ids=(cs??[]).map((c:any)=>c.id);if(!ids.length)return {customers:[]}
    const [{data:orders},{data:favs},{data:failed}]=await Promise.all([
      s.from('china_import_orders').select('user_id,total_ngn,payment_status,created_at').in('user_id',ids),
      s.from('import_admin_favorite_customers').select('customer_id').in('customer_id',ids),
      s.from('china_import_failed_orders').select('user_id').in('user_id',ids)
    ])
    const fm=new Map<string,number>();for(const x of failed??[])fm.set(x.user_id,(fm.get(x.user_id)??0)+1);const fav=new Set((favs??[]).map((x:any)=>x.customer_id));const sm=new Map<string,any>()
    for(const o of orders??[]){const z=sm.get(o.user_id)??{order_count:0,total_spent_ngn:0,last_order_at:null,awaiting_confirmation_count:0};z.order_count++;if(o.payment_status==='paid')z.total_spent_ngn+=Number(o.total_ngn??0);if(o.payment_status==='awaiting_confirmation')z.awaiting_confirmation_count++;if(!z.last_order_at||o.created_at>z.last_order_at)z.last_order_at=o.created_at;sm.set(o.user_id,z)}
    return {customers:(cs??[]).map((c:any)=>({...c,joined_at:c.created_at,is_favorite:fav.has(c.id),failed_order_count:fm.get(c.id)??0,...(sm.get(c.id)??{order_count:0,total_spent_ngn:0,last_order_at:null,awaiting_confirmation_count:0})}))}
  }
  if(name==='get_customer_detail'){
    await requireAdmin(s,token,'import.clients.view');const id=clean(a.customer_id,80)
    const [c,o,b,f,fa]=await Promise.all([
      s.from('customers').select('id,full_name,email,phone,avatar_url,created_at').eq('id',id).single(),
      s.from('china_import_orders').select('*').eq('user_id',id).order('created_at',{ascending:false}),
      s.from('china_import_consolidation_bills').select('*').eq('user_id',id).order('created_at',{ascending:false}),
      s.from('china_import_failed_orders').select('*').eq('user_id',id).order('failed_at',{ascending:false}),
      s.from('import_admin_favorite_customers').select('id').eq('customer_id',id).maybeSingle()
    ]);if(c.error)throw c.error;return {customer:{...c.data,is_favorite:!!fa.data},orders:o.data??[],bills:b.data??[],failed_orders:f.data??[]}
  }
  if(name==='get_import_analytics'){
    await requireAdmin(s,token,'import.analytics.view');const from=a.date_from??null,to=a.date_to??null
    const [{data,error},{count,countError}]=await Promise.all([
      s.rpc('get_import_analytics',{p_date_from:from,p_date_to:to}),
      s.from('customers').select('id',{count:'exact',head:true}).eq('signup_source','importation').gte('created_at',from??'1970-01-01T00:00:00Z').lte('created_at',to??new Date().toISOString())
    ]);if(error)throw error;if(countError)throw countError;return {analytics:{...(data??{}),new_customers_count:count??0}}
  }
  if(name==='get_batch_breakdown'){
    await requireAdmin(s,token,'import.orders.view');const key=clean(a.batch_key,100),kind=a.kind==='clearance'?'clearance':'consolidation_shipping'
    const [r,ad,l,po,st]=await Promise.all([
      s.rpc('get_batch_customer_breakdown',{p_batch_key:key}),
      s.from('import_batch_customer_adjustments').select('*').eq('batch_key',key).order('created_at'),
      s.rpc('get_batch_bill_ledger',{p_batch_key:key,p_kind:kind}),
      s.from('import_batch_customer_item_prices').select('*').eq('batch_key',key).eq('kind',kind),
      s.from('import_batch_bill_status').select('customer_id,status,sent_at,admin_note').eq('batch_key',key).eq('kind',kind)
    ]);if(r.error)throw r.error;return {rows:r.data??[],adjustments:ad.data??[],ledger:l.data??[],price_overrides:po.data??[],customer_status:st.data??[]}
  }
  if(name==='get_customer_questions'){
    await requireAdmin(s,token,'import.questions.view');const status=a.status??'open',limit=Math.min(Math.max(Number(a.limit??50),1),50);let q=s.from('china_import_product_questions').select('id,product_id,user_id,customer_name,customer_email,question,status,admin_reply,reply_template,replied_at,created_at,china_import_products!inner(id,name,image_url)').order('created_at',{ascending:false}).limit(limit);if(status!=='all')q=q.eq('status',status);const {data,error}=await q;if(error)throw error;return {questions:data??[]}
  }
  if(name==='get_failed_orders'){
    await requireAdmin(s,token,'import.timed_out.view');const search=clean(a.search,120),limit=Math.min(Math.max(Number(a.limit??50),1),50);let q=s.from('china_import_failed_orders').select('*,customers(email,phone)').is('restored_at',null).order('failed_at',{ascending:false}).limit(limit);if(search)q=q.or(`code.ilike.%${search}%,customer_name.ilike.%${search}%`);const {data,error}=await q;if(error)throw error;return {failed_orders:(data??[]).map((x:any)=>({...x,customer_email:x.customers?.email??null,customer_phone:x.customers?.phone??null,customers:undefined}))}
  }
  throw new Error(`Unknown admin tool: ${name}`)
}

async function openai(key:string,input:any[],tools:any[]) {
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,input,tools})})
  const b=await r.json().catch(()=>({}))
  if(!r.ok){
    if(r.status===429) throw new Error('AI support is temporarily at its usage limit. Please try again later.')
    if(r.status===401||r.status===403) throw new Error('AI support is temporarily unavailable. Please try again later.')
    throw new Error('AI support is temporarily unavailable. Please try again later.')
  }
  return b
}
const textOut=(r:any)=>r.output_text??(r.output??[]).filter((x:any)=>x.type==='message').flatMap((x:any)=>x.content??[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('')

function prompt(actor:Actor, channel='website', isNewConversation=false){return `You are QAfrica Import Support. Use only verified tool data. Never invent order status, prices, payment status, customer details, delivery dates or policy. If data is missing, say so. Do not expose internal IDs, supplier URLs, admin notes or session tokens to customers. Do not claim an action happened unless a tool says success. Currency is NGN (₦). Do not use Markdown bold syntax (double asterisks) in customer-facing answers; write order codes, names, amounts and statuses as normal text. For general QAfrica account/platform rules, use get_terms_of_service. For import-order policy questions such as refunds, cancellations, billing, shipping, delivery, pickup, defects, or damaged items, use get_import_terms and rely on its current text rather than guessing. When counting a customer’s orders or listing their order codes, check both get_my_orders and get_my_failed_orders so expired/removed orders are not omitted. Treat failed/expired records as separate from currently active orders. If the customer asks for “my order code” and there is more than one record, list the codes with their current/expired status instead of arbitrarily choosing one. If a customer uses an ambiguous word such as "reactive" or "reactivate", use the surrounding conversation to understand whether they mean reactivating an order; if still unclear, ask a short clarification instead of guessing a different topic such as materials or chemicals. Ask focused follow-up questions whenever the customer’s request is missing information needed to answer safely or accurately. Use the conversation history before asking for information the customer has already provided. Examples: if a cancellation/refund request has no identifiable order, ask for the order code; if multiple orders could match, ask which order; if a payment problem depends on how they paid, ask whether they used Paystack or manual transfer; if the customer asks for an arrival time but no order can be identified, ask which order. Do not ask a question when the available records already provide enough information to answer. You can also manage the authenticated customer's import cart with controlled cart tools. Only add, update, remove, or clear cart items when the customer explicitly asks to do so. If a customer only shares a product URL or asks for product information, inspect the product first and do not change the cart. A product URL is supported only when it is an official https://qafrica.store/recommendations/<product-id> link; never fetch arbitrary URLs. Always validate required variants and current prices from the database before changing the cart. Do not create an order, mark anything paid, or bypass the normal checkout/payment flow through chat. A conversation marked resolved has been closed by support; if a customer later starts a new support request, treat the new request as active again rather than assuming the old issue is still unresolved. Official QAfrica import information that may be used for general customer questions: QAfrica helps customers import goods from China's wholesale markets and sources from verified manufacturers on the customer's behalf. Customers can browse the recommended import catalog at https://qafrica.store/recommendations. The normal import flow is: Browse & Pick, Add to Cart, Sign In, Check Out, QAfrica consolidates the order, Choose Fulfillment (ship to the customer's address or to QAfrica's China warehouse for Jumia selling), then Track Your Order. If a customer asks for a specific product and search_products returns no matching active product, do not pretend the product is available and do not simply say QAfrica does not have it. Tell the customer that the requested product is not currently in the available catalog and direct them to submit a custom request at https://qafrica.store/custom-order. Explain briefly that they should submit the product details/request there and QAfrica will review it and get back to them. Use this custom-order route whenever the requested product is not found in the active catalog. If the customer has not clearly identified a product yet, ask what product they want before directing them to the custom-order page. Checkout supports Paystack/card payment or manual bank transfer. Orders are consolidated with other customers' shipments to reduce shipping costs. Customers can track their orders at https://qafrica.store/track. QAfrica handles sourcing, quality control and shipping for eligible items from start to finish. If a customer asks whether QAfrica can receive goods purchased from different Chinese sites and ship them to Nigeria, explain that the service can act as the customer's sourcing/importation agent and can consolidate eligible goods from independent vendors/factories for shipment to Nigeria. Do not invent or provide a warehouse street address unless the address is returned by a verified account-specific tool or official support record. If the customer asks where to find or copy the current warehouse address, explain that the exact current address must come from the customer's verified QAfrica import account/order instructions or a human support agent; do not say QAfrica cannot provide warehouse shipping as a service. After a successful cart change, provide the cart link returned by the tool when useful. ${isNewConversation ? 'This is the beginning of a new WhatsApp conversation. Start your reply with a brief, warm welcome to QAfrica Support before helping with the customer’s request.' : ''} For WhatsApp, this number is already the official QAfrica support channel. Never tell a WhatsApp customer to contact QAfrica through WhatsApp, another WhatsApp number, or a different support channel. You have a controlled request_human_support tool. On the website, use it automatically when the customer explicitly asks for a human/agent, when a payment dispute or account issue cannot be verified with the available tools, when the customer needs an action you cannot perform, or when a genuine issue remains unresolved after focused troubleshooting. On WhatsApp, use the same rule for the current WhatsApp conversation. Do not escalate ordinary questions that you can answer from verified data. After a successful website handoff, tell the customer that you are handing this same website conversation to QAfrica Support and that an agent will reply here. After a successful WhatsApp handoff, tell the customer you are handing this same WhatsApp conversation to QAfrica Support. Do not claim a human has already joined unless the conversation state confirms it. If asked to reactivate an order, explain that you can check its status and relevant records but cannot reactivate it through this support chat. For any specific order lifecycle, delivery timing, payment-confirmation, shipping-fee, cancellation/refund, or "where is my order" question, use get_my_order_context with the order code when available; do not rely on generic lifecycle knowledge when customer-specific records exist. Explain the customer-facing tracking stages using the verified stage returned by the tool. A consolidation & shipping bill is the customer-facing post-order bill. Do not tell customers they need a separate clearance bill. If a sea_freight order has no recorded delivery estimate yet, you may explain the general sea-freight window as 60–90 days from ship date, but never turn that general window into a promised arrival date. For expected delivery, prefer the recorded delivery_estimate fields from the bill. The checkout flow states that expected delivery is estimated from the date payment is confirmed and includes the 3-day processing period; use this only as a general explanation when it matches the order context. ${actor==='customer'?'You are assisting an authenticated import customer and may only access that customer’s records.':actor==='guest'?'You are assisting an unverified WhatsApp user. You may answer general QAfrica/import questions and search public import products, but you must not reveal or infer private customer information. If the user asks about their own order, bill, payment, refund, address, saved data, or other account-specific information, ask them to send the email address used for their QAfrica import account so the WhatsApp verification flow can send a one-time code. Do not ask for the code yourself unless the WhatsApp system has already sent one.':'You are assisting an authenticated QAfrica Import Admin and must respect every tool permission.'}`}

serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const s=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'')
  let body:any;try{body=await req.json()}catch{return json({error:'Invalid JSON body'},400)}
  const actor:Actor=body.actor==='admin'?'admin':body.actor==='guest'?'guest':'customer'
  if (actor === 'admin' && body.action) {
    try { return json(await adminSupportAction(s, clean(body.manager_token, 500), String(body.action), body)) }
    catch(e) { return json({error:e instanceof Error?e.message:'Support action failed'},400) }
  }
  const channel=clean(body.channel,40) || 'website'
  const conversationId=clean(body.conversation_id,80) || null
  if (actor==='customer' && channel==='website' && body.action==='get_state') {
    try {
      const id = await customerId(s, req)
      const websiteConversation = await s.from('import_ai_whatsapp_conversations')
        .select('id,status')
        .eq('customer_id',id).eq('channel','website').maybeSingle()
      if (websiteConversation.error) throw websiteConversation.error
      return json({
        conversation_id: websiteConversation.data?.id ?? null,
        status: websiteConversation.data?.status ?? 'ai'
      })
    } catch(e) {
      return json({error:e instanceof Error?e.message:'Could not load support state'},400)
    }
  }
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return json({error:'AI support is not configured: OPENAI_API_KEY is missing'},503)
  const message=clean(body.message,4000);if(!message)return json({error:'message is required'},400)
  const isNewConversation=channel==='whatsapp' && body.is_new_conversation===true
  const token=actor==='admin'?clean(body.manager_token,500):null
  const history = Array.isArray(body.messages)
    ? body.messages
        .filter((m:any)=>m && (m.role==='user' || m.role==='assistant') && typeof m.content==='string')
        .slice(-12)
        .map((m:any)=>({role:m.role,content:clean(m.content,2000)}))
    : []
  try{
    if(actor==='admin')await requireAdmin(s,token,'import.clients.view')
    const tools=actor==='admin'?adminTools:actor==='guest'?guestTools:channel==='whatsapp'?whatsappCustomerTools:[...customerTools,requestHumanSupportTool]
    let websiteConversation:any = null
    if (actor==='customer' && channel==='website') {
      websiteConversation = conversationId
        ? await s.from('import_ai_whatsapp_conversations').select('id,status,customer_id,channel').eq('id',conversationId).eq('customer_id',await customerId(s,req)).eq('channel','website').maybeSingle().then((x:any)=>x.data)
        : await getOrCreateWebsiteConversation(s, req)
      if (!websiteConversation) throw new Error('Website support conversation not found')
      if (['human_requested','human_assigned','human_active'].includes(websiteConversation.status)) {
        return json({answer:'Your conversation is currently with a QAfrica Support agent. Please send your message here and the agent will reply in this chat.',conversation_id:websiteConversation.id,status:websiteConversation.status,handed_off:true,human_active:true})
      }
      if (websiteConversation.status === 'resolved') {
        await s.from('import_ai_whatsapp_conversations').update({
          status: 'ai', human_agent_id: null, updated_at: new Date().toISOString()
        }).eq('id', websiteConversation.id)
        websiteConversation.status = 'ai'
      }
      await appendSupportMessage(s, websiteConversation.id, 'inbound', 'customer', message)
    }
    let input:any[]=[{role:'system',content:prompt(actor, channel, isNewConversation)},...history,{role:'user',content:message}]
    for(let turn=0;turn<5;turn++){
      const r=await openai(key,input,tools);const calls=(r.output??[]).filter((x:any)=>x.type==='function_call')
      if(!calls.length){
        const answer=textOut(r)
        if(actor==='customer' && channel==='website' && websiteConversation){
          await appendSupportMessage(s, websiteConversation.id, 'outbound', 'ai', answer)
          await s.from('import_ai_whatsapp_conversations').update({last_outbound_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',websiteConversation.id)
        }
        return json({answer,model:MODEL,conversation_id:channel==='website'?websiteConversation?.id:null,status:channel==='website'?websiteConversation?.status:null,handed_off:false})
      }
      input=[...input,...(r.output??[])]
      for(const c of calls){
        let a:any={};try{a=JSON.parse(c.arguments||'{}')}catch{a={}}
        let result:any
        try{result=actor==='admin'?await adminTool(s,token!,c.name,a):await customerTool(s,req,actor,c.name,a,{channel,conversationId})}catch(e){result={error:e instanceof Error?e.message:'Tool execution failed'}}
        input.push({type:'function_call_output',call_id:c.call_id,output:JSON.stringify(result)})
      }
    }
    return json({error:'AI tool loop exceeded the safety limit'},500)
  }catch(e){console.error('[import-ai-support]',e);return json({error:e instanceof Error?e.message:'AI support request failed'},500)}
})