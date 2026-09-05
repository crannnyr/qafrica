import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// ── Single sending identity ─────────────────────────────────────────────────
// Every path that talks to Resend uses this one FROM. Previously send-email
// used hello@ while process-email-queue used noreply@, which split the
// domain's sending reputation across two identities depending on whether a
// message went out on the first try or via the queue. Reply-To is set so
// replies reach a real inbox -- no-reply addresses suppress exactly the
// engagement signals Gmail uses to decide a sender is legitimate.
const FROM_ADDRESS = 'QAFRICA <hello@qafrica.store>';
const REPLY_TO     = 'hello@qafrica.store';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// supabase.rpc() returns a PostgrestFilterBuilder. It is thenable but has NO
// .catch() method, so `supabase.rpc(...).catch(...)` throws a TypeError every
// single time it runs. Where that happened after a successful send, the throw
// was swallowed by an outer catch that then marked the message failed and
// requeued it -- delivering the same email up to 3x while the database
// recorded a failure. This helper is the safe form; never call .catch() on an
// rpc() result.
async function safeRpc(sb: ReturnType<typeof getSupabase>, fn: string, args: Record<string, unknown>) {
  try {
    const { error } = await sb.rpc(fn, args);
    if (error) console.warn(`[send-email] rpc ${fn} failed:`, error.message);
  } catch (e) {
    console.warn(`[send-email] rpc ${fn} threw:`, e instanceof Error ? e.message : String(e));
  }
}

// ── Auto-detect email type from subject + html ──────────────────────────────────
function detectEmailType(subject: string, html: string): string {
  const s = subject.toLowerCase();
  const h = html.toLowerCase();
  if (s.includes('reset') || s.includes('password'))                          return 'password_reset';
  if (s.includes('welcome') || h.includes('welcome to qafrica'))              return 'welcome';
  if (s.includes('new dropship order') || h.includes('dropship order'))       return 'dropship_order';
  if (s.includes('ship now') || h.includes('ship to:'))                       return 'dropship_order';
  if (s.includes('order shipped') || s.includes('has been shipped'))          return 'order_shipped';
  if (s.includes('order delivered') || s.includes('has been delivered'))      return 'order_delivered';
  if (s.includes('order confirmed') || s.includes('has been confirmed') || s.includes('is confirmed')) return 'order_confirmed';
  if (s.includes('new order') || h.includes('new order received'))            return 'order_placed';
  if (s.includes('payment released') || h.includes('escrow released'))        return 'escrow_released';
  if (s.includes('withdrawal') && s.includes('paid'))                         return 'withdrawal_approved';
  if (s.includes('withdrawal') && s.includes('reject'))                       return 'withdrawal_rejected';
  if (s.includes('withdrawal request'))                                        return 'withdrawal_request';
  if (s.includes('trial') && s.includes('expir'))                             return 'trial_reminder';
  if (s.includes('subscription') && s.includes('expir'))                      return 'subscription_expired';
  if (s.includes('domain') && (s.includes('live') || s.includes('approved'))) return 'domain_approved';
  if (s.includes('domain') && s.includes('reject'))                           return 'domain_rejected';
  if (s.includes('domain') && s.includes('revert'))                           return 'domain_rejected';
  if (s.includes('out of stock'))                                              return 'out_of_stock';
  if (s.includes('low stock'))                                                 return 'low_stock';
  if (s.includes('is now selling') || h.includes('new seller for your'))      return 'new_importer';
  if (s.includes('new') && s.includes('product') && h.includes('import'))    return 'new_product_in_niche';
  if (s.includes('price update') || h.includes('supplier price update'))      return 'price_change';
  if (s.includes('fee is due') || s.includes('fee due'))                      return 'bill_due';
  if (s.includes('ready for review'))                                          return 'order_to_review';
  if (s.includes('we answered your question'))                                return 'question_answered';
  return 'generic';
}

// ── Address validation, before anything reaches Resend ──────────────────────
// 26 messages in the last 30 days were rejected by Resend with a 422 "invalid
// `to` field". Those should never have left the building -- rejecting them
// here keeps malformed addresses out of the queue and off the rate counter.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/;
function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

// ── Check daily limit + domain throttle + suppression ─────────────────────────
async function checkLimit(sb: ReturnType<typeof getSupabase>, emailType: string, toEmail: string) {
  const { data, error } = await sb.rpc('can_send_email_now', { p_email_type: emailType, p_to_email: toEmail });
  if (error) {
    console.warn('[send-email] can_send_email_now failed:', error.message);
    return { canSend: true, scheduledFor: null, reason: 'rpc_error' };
  }
  return {
    canSend:      data?.can_send      === true,
    scheduledFor: data?.scheduled_for ?? null,
    reason:       data?.reason        ?? 'ok',
  };
}

// ── Schedule in queue (all required columns present) ────────────────────────────────
async function scheduleEmail(
  sb: ReturnType<typeof getSupabase>,
  to: string, subject: string, html: string,
  emailType: string, scheduledFor: string, priority: number,
) {
  const { error } = await sb.from('email_queue').insert({
    to_email:              to,
    subject,
    html_body:             html,
    template_name:         emailType,
    template_data:         {},
    email_type:            emailType,
    status:                'pending',
    priority,
    scheduled_for:         scheduledFor,
    is_manually_triggered: false,
    attempts:              0,
  });
  if (error) console.error('[send-email] schedule failed:', error.message);
  return !error;
}

// ── Send via Resend ───────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, reply_to: REPLY_TO, to: [to], subject, html }),
  });
}

// A synchronous rejection from the Resend API (as opposed to an async bounce
// reported later) usually means the address itself is malformed/invalid --
// safe to suppress immediately rather than retry.
function looksPermanentlyBad(status: number, message: string): boolean {
  const m = (message || '').toLowerCase();
  return status === 422 || /invalid|does not exist|not a valid|malformed/.test(m);
}

// Only 429 (rate limited) and 5xx (Resend-side fault) are worth another
// attempt. Every other 4xx is our mistake and will fail identically forever --
// retrying it just burns rate-limit budget that Gmail is actively measuring.
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

// Pulls new hard-bounce / complaint entries from Resend's own suppression
// list into our local cache, so every future send-cost check is a fast
// local lookup instead of an API round trip. Resend auto-suppresses hard
// bounces and complaints on its own; this just mirrors that locally.
// Paginates fully (bounded at 20 pages/origin = up to 2000 records) so a
// fresh deploy backfills the whole existing suppression history, not just
// whatever's most recent.
async function syncSuppressions(sb: ReturnType<typeof getSupabase>) {
  let synced = 0;
  for (const origin of ['bounce', 'complaint']) {
    let after: string | null = null;
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ limit: '100', origin });
      if (after) params.set('after', after);
      const res = await fetch(`https://api.resend.com/suppressions?${params}`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
      });
      if (!res.ok) break;
      const data = await res.json().catch(() => ({}));
      const rows = data?.data ?? [];
      for (const row of rows) {
        if (!row?.email) continue;
        const { error } = await sb.from('email_suppression_cache')
          .insert({ email: String(row.email).toLowerCase(), reason: `resend_${origin}` })
          .select().maybeSingle();
        if (!error) synced++;
      }
      if (rows.length < 100) break; // last page
      after = rows[rows.length - 1]?.id ?? null;
      if (!after) break;
    }
  }
  return synced;
}

// ── Main ────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!RESEND_API_KEY) {
    console.error('[send-email] RESEND_API_KEY not set');
    return json({ error: 'Email service not configured' }, 500);
  }

  const url = new URL(req.url);
  const sb = getSupabase();

  // Daily cron target: mirrors Resend's authoritative suppression list
  // locally so every send check is a fast local lookup.
  if (req.method === 'POST' && url.searchParams.get('action') === 'sync-suppressions') {
    const synced = await syncSuppressions(sb);
    return json({ success: true, synced });
  }

  let body: Record<string, any>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { to, subject, html, priority = 5 } = body;
  if (!to || !subject || !html)
    return json({ error: 'Missing required fields: to, subject, html' }, 400);

  if (!isValidEmail(to)) {
    console.log(`[send-email] rejecting malformed recipient: ${String(to).slice(0, 80)}`);
    return json({ error: 'Invalid recipient email address', rejected: true }, 400);
  }
  const recipient = String(to).trim();

  const emailType = (body.email_type as string) || detectEmailType(subject, html);

  console.log(`[send-email] type=${emailType} to=${recipient}`);

  const { canSend, scheduledFor, reason } = await checkLimit(sb, emailType, recipient);

  if (!canSend && reason === 'suppressed') {
    console.log(`[send-email] ${recipient} is suppressed — dropping silently`);
    return json({ success: false, scheduled: false, reason: 'suppressed' });
  }

  if (!canSend && reason === 'disabled') {
    console.log(`[send-email] ${emailType} disabled — dropping`);
    return json({ success: false, scheduled: false, reason: 'disabled' });
  }

  if (!canSend && (reason === 'limit_reached' || reason === 'domain_rate_limited') && scheduledFor) {
    console.log(`[send-email] ${emailType} to ${recipient} deferred (${reason}) — rescheduling for ${scheduledFor}`);
    const ok = await scheduleEmail(sb, recipient, subject, html, emailType, scheduledFor, priority);
    return json({ success: false, scheduled: ok, scheduled_for: scheduledFor, reason });
  }

  // Send now
  try {
    const res  = await sendViaResend(recipient, subject, html);
    const data = await res.json();

    if (!res.ok) {
      console.error('[send-email] Resend error:', data);
      if (looksPermanentlyBad(res.status, data?.message ?? '')) {
        await safeRpc(sb, 'record_email_permanent_failure', { p_email: recipient, p_reason: `send_rejected: ${data?.message ?? res.status}` });
        return json({ error: data.message || 'Resend rejected', suppressed: true }, res.status);
      }
      if (!isRetryable(res.status)) {
        // A non-retryable 4xx will fail the same way forever. Requeueing it
        // only spends rate-limit budget the domain cannot currently afford.
        console.error(`[send-email] permanent ${res.status} — not requeueing`);
        return json({ error: data.message || 'Resend rejected', scheduled: false }, res.status);
      }
      const retry = new Date(Date.now() + 5 * 60_000).toISOString();
      const ok    = await scheduleEmail(sb, recipient, subject, html, emailType, retry, priority);
      return json({ error: data.message || 'Resend rejected', scheduled: ok, message: 'Retry in 5 min' }, res.status);
    }

    await safeRpc(sb, 'record_email_sent', { p_email_type: emailType });

    console.log(`[send-email] Sent ✔ id=${data.id} type=${emailType}`);
    return json({ success: true, id: data.id, email_type: emailType });

  } catch (err: any) {
    console.error('[send-email] Unexpected error:', err.message);
    const retry = new Date(Date.now() + 5 * 60_000).toISOString();
    await scheduleEmail(sb, recipient, subject, html, emailType, retry, priority).catch(() => {});
    return json({ error: 'Unexpected error', scheduled: true, message: 'Retry in 5 min' }, 500);
  }
});
