import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'https://qafrica.store',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const clean=(v:unknown,max=8000)=>String(v??'').trim().slice(0,max)
async function requireAdmin(s:any,token:string,action:string){
  if(!token)throw new Error('Admin authentication required')
  const {data:session,error:se}=await s.from('import_admin_sessions').select('manager_id').eq('token',token).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(se||!session)throw new Error('Invalid or expired admin session')
  const {data:roles,error:re}=await s.from('import_admin_manager_roles').select('role_id').eq('manager_id',session.manager_id)
  if(re)throw re
  const roleIds=(roles??[]).map((x:any)=>x.role_id)
  const {data:links,error:le}=await s.from('import_admin_role_permissions').select('permission_id').in('role_id',roleIds)
  if(le)throw le
  const permissionIds=(links??[]).map((x:any)=>x.permission_id)
  const {data:perms,error:pe}=await s.from('import_admin_permissions').select('key').in('id',permissionIds)
  if(pe)throw pe
  const keys=new Set((perms??[]).map((p:any)=>p.key))
  const required=action==='list'?'import.ai_learning.view':'import.ai_learning.manage'
  if(!keys.has(required))throw new Error(`Missing permission: ${required}`)
  return session.manager_id
}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const s=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'')
  try{
    const b=await req.json()
    const action=clean(b.action,50)||'list'
    const managerId=await requireAdmin(s,clean(b.manager_token,500),action)
    if(action==='list'){
      const status=['pending','approved','rejected'].includes(b.review_status)?b.review_status:null
      let q=s.from('import_ai_resolution_examples').select('id,conversation_id,customer_id,category,issue_summary,resolution_summary,transcript,approved,review_status,approved_by,approved_at,created_at').order('created_at',{ascending:false}).limit(100)
      if(status)q=q.eq('review_status',status)
      const {data,error}=await q;if(error)throw error
      return json({examples:data??[]})
    }
    const id=clean(b.id,80);if(!id)throw new Error('Example id is required')
    if(action==='approve'||action==='reject'){
      const status=action==='approve'?'approved':'rejected'
      const {data,error}=await s.from('import_ai_resolution_examples').update({approved:action==='approve',review_status:status,approved_by:action==='approve'?managerId:null,approved_at:action==='approve'?new Date().toISOString():null}).eq('id',id).select('id,approved,review_status,approved_by,approved_at').single()
      if(error)throw error;return json({example:data})
    }
    if(action==='update'){
      const issue=clean(b.issue_summary,1000),resolution=clean(b.resolution_summary,4000),category=clean(b.category,100)
      if(!issue||!resolution)throw new Error('Issue and resolution are required')
      const {data,error}=await s.from('import_ai_resolution_examples').update({category:category||'general',issue_summary:issue,resolution_summary:resolution}).eq('id',id).select('id,category,issue_summary,resolution_summary,approved,review_status,approved_by,approved_at,created_at').single()
      if(error)throw error;return json({example:data})
    }
    throw new Error('Unknown learning action')
  }catch(e){return json({error:e instanceof Error?e.message:'Learning action failed'},400)}
})
