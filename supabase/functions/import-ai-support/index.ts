import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna'
type Actor = 'customer' | 'admin'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
})
const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const bearer = (req: Request) => {
  const h = req.headers.get('authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

async function customerId(s: any, req: Request) {
  const token = bearer(req)
  if (!token) throw new Error('Customer authentication required')
  const { data: auth, error } = await s.auth.getUser(token)
  if (error || !auth.user) throw new Error('Invalid customer authentication')
  const { data, error: ce } = await s.from('customers').select('id').eq('id', auth.user.id).maybeSingle()
  if (ce || !data) throw new Error('Authenticated user is not an import customer')
  return data.id
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
  { type:'function', name:'get_my_bills', description:'Get the authenticated customer consolidation and clearance bills.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_refunds', description:'Get refund records belonging only to the authenticated customer, including refund status and verified refund details.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'get_my_addresses', description:'Get the authenticated customer import address book and defaults.', parameters:{type:'object',properties:{},additionalProperties:false}},
  { type:'function', name:'search_products', description:'Search active QAfrica import products. Never expose supplier source URLs.', parameters:{type:'object',properties:{query:{type:'string'},category:{type:'string'},limit:{type:'integer',minimum:1,maximum:8}},required:['query'],additionalProperties:false}},
  { type:'function', name:'submit_product_question', description:'Submit a product question only when the customer explicitly asks to send it to QAfrica support.', parameters:{type:'object',properties:{product_id:{type:'string'},question:{type:'string',maxLength:1000}},required:['product_id','question'],additionalProperties:false}},
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
  if (!r.ok) throw new Error(`Terms of Service could not be fetched (HTTP ${r.status})`);
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

async function customerTool(s:any, req:Request, name:string, a:any) {
  if (name === 'get_terms_of_service') return await fetchLegalPage('https://qafrica.store/terms-of-service')
  if (name === 'get_import_terms') return await fetchLegalPage('https://qafrica.store/import-terms')
  const id = await customerId(s, req)
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
  if (name === 'get_my_refunds') {
    const {data,error}=await s.from('china_import_refunds')
      .select('id,original_order_id,code,total_ngn,cancel_reason,status,cancellation_type,refund_amount_ngn,cancellation_fee_ngn,refund_policy,refund_method,payment_method,payment_reference,bank_details_submitted_at,paid_at,cancelled_at,created_at,paystack_refund_status,paystack_refunded_at,refund_error,billing_bill_id')
      .eq('user_id',id).order('created_at',{ascending:false}).limit(50);
    if(error)throw error;
    return {refunds:data??[]};
  }
  if (name === 'get_my_bills') {
    const {data,error}=await s.from('china_import_consolidation_bills').select('id,order_id,amount_ngn,reason,kind,bank_account_number,bank_name,bank_account_name,status,line_items,created_at,customer_marked_paid_at,confirmed_paid_at,delivery_estimate_start_at,delivery_estimate_min_at,delivery_estimate_max_at').eq('user_id',id).order('created_at',{ascending:false}).limit(100); if(error)throw error; return {bills:data??[]}
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
  const b=await r.json();if(!r.ok)throw new Error(b?.error?.message??'OpenAI request failed');return b
}
const textOut=(r:any)=>r.output_text??(r.output??[]).filter((x:any)=>x.type==='message').flatMap((x:any)=>x.content??[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('')

function prompt(actor:Actor){return `You are QAfrica Import Support. Use only verified tool data. Never invent order status, prices, payment status, customer details, delivery dates or policy. If data is missing, say so. Do not expose internal IDs, supplier URLs, admin notes or session tokens to customers. Do not claim an action happened unless a tool says success. Currency is NGN (₦). Do not use Markdown bold syntax (double asterisks) in customer-facing answers; write order codes, names, amounts and statuses as normal text. For general QAfrica account/platform rules, use get_terms_of_service. For import-order policy questions such as refunds, cancellations, billing, shipping, delivery, pickup, defects, or damaged items, use get_import_terms and rely on its current text rather than guessing. When counting a customer’s orders or listing their order codes, check both get_my_orders and get_my_failed_orders so expired/removed orders are not omitted. Treat failed/expired records as separate from currently active orders. If the customer asks for “my order code” and there is more than one record, list the codes with their current/expired status instead of arbitrarily choosing one. If a customer uses an ambiguous word such as "reactive" or "reactivate", use the surrounding conversation to understand whether they mean reactivating an order; if still unclear, ask a short clarification instead of guessing a different topic such as materials or chemicals. You currently have read-only support tools: never promise to reactivate, cancel, change, or otherwise modify an order. If asked to reactivate an order, explain that you can check its status and relevant records but cannot reactivate it through this support chat. ${actor==='customer'?'You are assisting an authenticated import customer and may only access that customer’s records.':'You are assisting an authenticated QAfrica Import Admin and must respect every tool permission.'}`}

serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return json({error:'AI support is not configured: OPENAI_API_KEY is missing'},503)
  const s=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'')
  let body:any;try{body=await req.json()}catch{return json({error:'Invalid JSON body'},400)}
  const message=clean(body.message,4000);const actor:Actor=body.actor==='admin'?'admin':'customer';if(!message)return json({error:'message is required'},400)
  const token=actor==='admin'?clean(body.manager_token,500):null
  try{
    if(actor==='admin')await requireAdmin(s,token,'import.clients.view')
    const tools=actor==='admin'?adminTools:customerTools
    let input:any[]=[{role:'system',content:prompt(actor)},{role:'user',content:message}]
    for(let turn=0;turn<5;turn++){
      const r=await openai(key,input,tools);const calls=(r.output??[]).filter((x:any)=>x.type==='function_call')
      if(!calls.length)return json({answer:textOut(r),model:MODEL})
      input=[...input,...(r.output??[])]
      for(const c of calls){
        let a:any={};try{a=JSON.parse(c.arguments||'{}')}catch{a={}}
        let result:any
        try{result=actor==='admin'?await adminTool(s,token!,c.name,a):await customerTool(s,req,c.name,a)}catch(e){result={error:e instanceof Error?e.message:'Tool execution failed'}}
        input.push({type:'function_call_output',call_id:c.call_id,output:JSON.stringify(result)})
      }
    }
    return json({error:'AI tool loop exceeded the safety limit'},500)
  }catch(e){console.error('[import-ai-support]',e);return json({error:e instanceof Error?e.message:'AI support request failed'},500)}
})