import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const clean = (v: unknown, max = 4000) => String(v ?? '').trim().slice(0, max)

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

async function linkWhatsApp(s:any, waId:string, phone:string, code:string) {
  const codeHash = await sha256(code.toUpperCase())
  const { data: link, error } = await s.from('import_ai_whatsapp_links')
    .select('id,customer_id,expires_at')
    .eq('code_hash', codeHash)
    .is('linked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) throw error
  if (!link) return false

  const { error: updateError } = await s.from('import_ai_whatsapp_links')
    .update({ whatsapp_wa_id: waId, whatsapp_phone: phone, linked_at: new Date().toISOString() })
    .eq('id', link.id)
  if (updateError) throw updateError

  const { error: convError } = await s.from('import_ai_whatsapp_conversations')
    .upsert({
      wa_id: waId,
      customer_id: link.customer_id,
      status: 'ai',
      updated_at: new Date().toISOString()
    }, { onConflict: 'wa_id' })
  if (convError) throw convError
  return true
}

async function callAi(customerId:string, message:string, history:any[]) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/import-ai-support`
  const secret = Deno.env.get('IMPORT_AI_INTERNAL_SECRET') ?? ''
  if (!secret) throw new Error('IMPORT_AI_INTERNAL_SECRET is not configured')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-import-ai-internal-secret': secret,
      'x-import-ai-customer-id': customerId,
    },
    body: JSON.stringify({
      actor: 'customer',
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

  const linkMatch = normalized.match(/^LINK(?:\s+|:)([A-Z0-9]{8})$/i)
  if (linkMatch) {
    const linked = await linkWhatsApp(s, waId, phone, linkMatch[1])
    if (linked) {
      const conversation = await getConversation(s, waId)
      await s.from('import_ai_whatsapp_messages').insert({
        conversation_id: conversation.id,
        direction: 'inbound',
        sender_type: 'customer',
        body: normalized,
        whatsapp_message_id: messageId,
      })
      const reply = 'Your WhatsApp account is now linked to your QAfrica import account. You can now ask me about your orders, tracking, bills and products.'
      await sendText(phone, reply)
      await s.from('import_ai_whatsapp_messages').insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        sender_type: 'ai',
        body: reply,
      })
      await s.from('import_ai_whatsapp_conversations').update({
        last_inbound_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', conversation.id)
      return
    }
  }

  const conversation = await getConversation(s, waId)
  if (!conversation.customer_id) {
    await sendText(phone, 'Hi! To protect your QAfrica account, please link this WhatsApp number to your import account first. In the QAfrica website AI Support panel, choose Connect WhatsApp, then send the 8-character code here as: LINK ABC12345')
    return
  }

  if (conversation.status !== 'ai' && conversation.status !== 'returned_to_ai') {
    await sendText(phone, 'This conversation is currently with QAfrica human support. Please wait for the support team to reply.')
    return
  }

  await s.from('import_ai_whatsapp_messages').insert({
    conversation_id: conversation.id,
    direction: 'inbound',
    sender_type: 'customer',
    body: normalized,
    whatsapp_message_id: messageId,
  })

  const { data: prior, error: pe } = await s.from('import_ai_whatsapp_messages')
    .select('direction,sender_type,body,created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(13)
  if (pe) throw pe

  const history = (prior ?? []).reverse().slice(0, 12).map((m:any) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: String(m.body).slice(0, 2000),
  })).filter((m:any) => m.content !== normalized)

  const answer = await callAi(conversation.customer_id, normalized, history)
  if (!answer) throw new Error('AI returned an empty response')

  await sendText(phone, answer)
  await s.from('import_ai_whatsapp_messages').insert({
    conversation_id: conversation.id,
    direction: 'outbound',
    sender_type: 'ai',
    body: answer,
  })
  await s.from('import_ai_whatsapp_conversations').update({
    last_inbound_at: new Date().toISOString(),
    last_outbound_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
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
  try {
    if (!(await verifySignature(raw, req.headers.get('x-hub-signature-256')))) {
      return json({ error: 'Invalid webhook signature' }, 401)
    }
    const payload = JSON.parse(raw)
    if (payload?.object !== 'whatsapp_business_account') return json({ received: true })

    const s = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value
        for (const message of value?.messages ?? []) {
          if (message.type !== 'text') {
            if (message.from) await sendText(message.from, 'I can currently process text messages. Please send your question as text.')
            continue
          }
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
