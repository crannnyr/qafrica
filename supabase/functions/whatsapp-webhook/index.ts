import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const clean = (v: unknown, max = 4000) => String(v ?? '').trim().slice(0, max)
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/
const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v)
function makeCode() {
  const max = 1_000_000
  const buf = new Uint32Array(1)
  let n = 0
  do { crypto.getRandomValues(buf); n = buf[0] } while (n >= Math.floor(0x1_0000_0000 / max) * max)
  return String(n % max).padStart(6, '0')
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifySignature(body: string, signature: string | null) {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''
  if (!secret) throw new Error('WHATSAPP_APP_SECRET is not configured')
  if (!signature?.startsWith('sha256=')) return false
  const expectedBytes = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(body)
  )
  const expected = Array.from(new Uint8Array(expectedBytes)).map(b => b.toString(16).padStart(2, '0')).join('')
  const actual = signature.slice(7)
  if (expected.length !== actual.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
  return diff === 0
}

async function sendText(to: string, body: string) {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
  const version = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v26.0'
  if (!token || !phoneNumberId) throw new Error('WhatsApp sending credentials are not configured')

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('[whatsapp-webhook] send failed', JSON.stringify(result))
    throw new Error('WhatsApp message could not be sent')
  }
  return result
}

async function requestEmailVerification(s:any, conversation:any, email:string) {
  const normalized = email.trim().toLowerCase()
  if (!isEmail(normalized)) return 'Please send the email address you used for your QAfrica import account.'

  const { data: customer, error: ce } = await s.from('customers')
    .select('id,full_name,email')
    .eq('signup_source','importation')
    .ilike('email', normalized)
    .maybeSingle()
  if (ce) throw ce

  // Do not reveal whether the address exists. If it does, issue a code.
  if (customer) {
    const { count: recentCount, error: rateError } = await s.from('import_ai_whatsapp_verification_codes')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    if (rateError) throw rateError
    if ((recentCount ?? 0) >= 3) {
      return 'You have requested several verification codes recently. Please wait a little before requesting another code.'
    }
    await s.from('import_ai_whatsapp_verification_codes')
      .delete().eq('conversation_id', conversation.id).is('consumed_at', null)

    const code = makeCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: insertError } = await s.from('import_ai_whatsapp_verification_codes').insert({
      conversation_id: conversation.id,
      email: normalized,
      customer_id: customer.id,
      code_hash: await sha256(code),
      expires_at: expiresAt,
    })
    if (insertError) throw insertError

    const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px"><h2 style="color:#111827">QAfrica WhatsApp verification</h2><p style="color:#4B5563">Hi ${String(customer.full_name || 'there').replace(/[<>]/g,'')},</p><p style="color:#4B5563">Use this code to securely connect your WhatsApp conversation to your QAfrica import account:</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:20px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;color:#F97316">${code}</div><p style="color:#6B7280;font-size:13px">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p></div>`
    const { error: sendError } = await s.functions.invoke('send-email', {
      body: {
        to: normalized,
        subject: 'Your QAfrica WhatsApp verification code',
        html: emailHtml,
        email_type: 'generic',
        priority: 1,
      },
    })
    if (sendError) {
      console.error('[whatsapp-webhook] verification email failed', sendError.message)
      throw new Error('We could not send the verification code right now. Please try again shortly.')
    }
  }

  return 'If that email belongs to a QAfrica import account, I sent a 6-digit verification code to it. Please reply here with the code within 10 minutes.'
}

async function verifyEmailCode(s:any, conversation:any, code:string) {
  if (!/^\d{6}$/.test(code)) return false
  const { data: rows, error } = await s.from('import_ai_whatsapp_verification_codes')
    .select('id,customer_id,expires_at,attempts')
    .eq('conversation_id', conversation.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = rows?.[0]
  if (!row || new Date(row.expires_at).getTime() <= Date.now() || Number(row.attempts) >= 5) return false

  const hash = await sha256(code)
  if (hash !== row.code_hash) {
    await s.from('import_ai_whatsapp_verification_codes').update({ attempts: Number(row.attempts) + 1 }).eq('id', row.id)
    return false
  }

  const now = new Date().toISOString()
  const { error: consumeError } = await s.from('import_ai_whatsapp_verification_codes')
    .update({ consumed_at: now }).eq('id', row.id)
  if (consumeError) throw consumeError

  const { error: linkError } = await s.from('import_ai_whatsapp_conversations')
    .update({ customer_id: row.customer_id, status: 'ai', updated_at: now }).eq('id', conversation.id)
  if (linkError) throw linkError
  return true
}

async function getConversation(s: any, waId: string) {
  const { data, error } = await s.from('import_ai_whatsapp_conversations')
    .select('id,wa_id,customer_id,status')
    .eq('wa_id', waId)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  const { data: created, error: ce } = await s.from('import_ai_whatsapp_conversations')
    .insert({ wa_id: waId, status: 'ai' })
    .select('id,wa_id,customer_id,status')
    .single()
  if (ce) throw ce
  return created
}

async function callAi(actor:'customer'|'guest', customerId:string|null, message:string, history:any[]) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/import-ai-support`
  const secret = Deno.env.get('IMPORT_AI_INTERNAL_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!secret) throw new Error('IMPORT_AI_INTERNAL_SECRET is not configured')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-import-ai-internal-secret': secret,
      ...(customerId ? { 'x-import-ai-customer-id': customerId } : {}),
    },
    body: JSON.stringify({
      actor,
      channel: 'whatsapp',
      message,
      messages: history,
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(result?.error || 'AI support request failed'))
  return String(result?.answer || '')
}

async function handleText(s:any, waId:string, phone:string, messageId:string, text:string) {
  const normalized = clean(text, 4000)
  if (!normalized) return

  const conversation = await getConversation(s, waId)

  const codeVerified = await verifyEmailCode(s, conversation, normalized)
  if (codeVerified) {
    await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: conversation.id, direction: 'inbound', sender_type: 'customer',
      body: normalized, whatsapp_message_id: messageId,
    })
    const reply = 'Your QAfrica account is now verified and connected to this WhatsApp conversation. You can ask me about your orders, tracking, bills, refunds and products.'
    await sendText(phone, reply)
    await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: conversation.id, direction: 'outbound', sender_type: 'ai', body: reply,
    })
    await s.from('import_ai_whatsapp_conversations').update({
      last_inbound_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id)
    return
  }

  if (isEmail(normalized) && !conversation.customer_id) {
    const reply = await requestEmailVerification(s, conversation, normalized)
    await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: conversation.id, direction: 'inbound', sender_type: 'customer',
      body: normalized, whatsapp_message_id: messageId,
    })
    await sendText(phone, reply)
    await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: conversation.id, direction: 'outbound', sender_type: 'ai', body: reply,
    })
    await s.from('import_ai_whatsapp_conversations').update({
      last_inbound_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id)
    return
  }

  const wantsHuman = /\b(human|agent|real person|support person|customer service|representative)\b/i.test(normalized)
  if (wantsHuman) {
    const now = new Date().toISOString()
    await s.from('import_ai_whatsapp_conversations').update({
      status: 'human_requested', last_inbound_at: now, updated_at: now
    }).eq('id', conversation.id)
    await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: conversation.id, direction: 'inbound', sender_type: 'customer',
      body: normalized, whatsapp_message_id: messageId,
    })
    const reply = conversation.customer_id
      ? 'I’ve requested a QAfrica support agent for this same WhatsApp conversation. A human will take over here shortly.'
      : 'I’ve requested a QAfrica support agent for this same WhatsApp conversation. A human can reply here shortly. If your request needs private account information, I’ll ask you to verify your QAfrica email first.'
    await sendText(phone, reply)
    await s.from('import_ai_whatsapp_messages').insert({
      conversation_id: conversation.id, direction: 'outbound', sender_type: 'ai', body: reply,
    })
    await s.from('import_ai_whatsapp_conversations').update({
      last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id)
    return
  }

  if (conversation.status !== 'ai' && conversation.status !== 'returned_to_ai') {
    await sendText(phone, 'This conversation is currently with QAfrica human support. Please wait for the support team to reply.')
    return
  }

  await s.from('import_ai_whatsapp_messages').insert({
    conversation_id: conversation.id, direction: 'inbound', sender_type: 'customer',
    body: normalized, whatsapp_message_id: messageId,
  })

  const { data: prior, error: pe } = await s.from('import_ai_whatsapp_messages')
    .select('direction,sender_type,body,created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false }).limit(13)
  if (pe) throw pe

  const history = (prior ?? []).reverse().slice(0, 12).map((m:any) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant', content: String(m.body).slice(0, 2000),
  })).filter((m:any) => m.content !== normalized)

  const actor = conversation.customer_id ? 'customer' : 'guest'
  let answer = ''
  try {
    answer = await callAi(actor, conversation.customer_id, normalized, history)
    if (!answer) throw new Error('AI returned an empty response')
  } catch (error) {
    console.error('[whatsapp-webhook] AI processing failed', JSON.stringify({
      conversation_id: conversation.id,
      stage: 'call-ai',
      error: error instanceof Error ? error.message : String(error),
    }))
    answer = 'I received your message, but QAfrica AI support is temporarily unavailable. Please try again shortly, or reply HUMAN if you want a support agent to take over this WhatsApp conversation.'
  }

  await sendText(phone, answer)
  await s.from('import_ai_whatsapp_messages').insert({
    conversation_id: conversation.id, direction: 'outbound', sender_type: 'ai', body: answer,
  })
  await s.from('import_ai_whatsapp_conversations').update({
    last_inbound_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq('id', conversation.id)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return json({ error: 'Webhook verification failed' }, 403)
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const raw = await req.text()
  let stage = 'received'
  try {
    stage = 'signature'
    if (!(await verifySignature(raw, req.headers.get('x-hub-signature-256')))) {
      return json({ error: 'Invalid webhook signature' }, 401)
    }
    stage = 'parse'
    const payload = JSON.parse(raw)
    if (payload?.object !== 'whatsapp_business_account') return json({ received: true })

    stage = 'database-client'
    const s = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    stage = 'messages'
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value
        for (const message of value?.messages ?? []) {
          if (message.type !== 'text') {
            if (message.from) await sendText(message.from, 'I can currently process text messages. Please send your question as text.')
            continue
          }
          stage = 'handle-text'
          await handleText(
            s,
            String(message.from),
            String(message.from),
            String(message.id ?? ''),
            String(message.text?.body ?? '')
          )
        }
      }
    }

    return json({ received: true })
  } catch (error) {
    console.error('[whatsapp-webhook]', error)
    return json({ received: true })
  }
})
