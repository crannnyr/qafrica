// Shared Nomba API client for edge functions.
// Auth: OAuth2 client_credentials (developer.nomba.com/docs/getting-started/authentication).
// Tokens last 30 minutes; we renew 5 minutes early and reuse them within a function instance.

const ENV = (Deno.env.get('NOMBA_ENV') ?? 'live').toLowerCase();
export const NOMBA_BASE = ENV === 'sandbox' ? 'https://sandbox.nomba.com' : 'https://api.nomba.com';

const ACCOUNT_ID = Deno.env.get('NOMBA_ACCOUNT_ID') ?? '';
const CLIENT_ID = Deno.env.get('NOMBA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('NOMBA_CLIENT_SECRET') ?? '';

export const nombaConfigured = () => ({
  env: ENV,
  has_account_id: !!ACCOUNT_ID,
  has_client_id: !!CLIENT_ID,
  has_client_secret: !!CLIENT_SECRET,
  has_webhook_secret: !!Deno.env.get('NOMBA_WEBHOOK_SECRET'),
});

export class NombaError extends Error {
  constructor(message: string, public status: number, public code?: string, public description?: string) {
    super(message);
  }
}

let cached: { token: string; expiresAt: number } | null = null;

export async function nombaToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;
  if (!ACCOUNT_ID || !CLIENT_ID || !CLIENT_SECRET) throw new NombaError('Nomba secrets missing', 500);
  const res = await fetch(`${NOMBA_BASE}/v1/auth/token/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accountId: ACCOUNT_ID },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.code !== '00' || !body?.data?.access_token) {
    throw new NombaError('Nomba authentication failed', res.status, body?.code, body?.description);
  }
  const exp = Date.parse(body.data.expiresAt ?? '') || Date.now() + 30 * 60_000;
  cached = { token: body.data.access_token, expiresAt: exp };
  return cached.token;
}

/** Authenticated call. Pass idempotencyKey for anything that moves money. */
// deno-lint-ignore no-explicit-any
export async function nombaFetch(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<any> {
  const token = await nombaToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    accountId: ACCOUNT_ID,
    'Content-Type': 'application/json',
  };
  if (init.idempotencyKey) headers['X-Idempotent-key'] = init.idempotencyKey;
  const res = await fetch(`${NOMBA_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body?.code && body.code !== '00')) {
    if (res.status === 401) cached = null; // force re-login next time
    throw new NombaError(`Nomba ${init.method ?? 'GET'} ${path} failed`, res.status, body?.code, body?.description);
  }
  return body;
}
