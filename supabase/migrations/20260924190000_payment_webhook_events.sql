-- Applied live via apply_migration on 2026-09-24 (name: payment_webhook_events).
-- Every payment-provider webhook, stored once (idempotent on provider + request id).
-- Written only by edge functions (service role); admins can read.
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,                 -- 'nomba' | 'flutterwave'
  request_id text NOT NULL,               -- provider's unique event id
  event_type text,
  signature_valid boolean NOT NULL,
  payload jsonb NOT NULL,
  headers jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  process_error text,
  UNIQUE (provider, request_id)
);
CREATE INDEX IF NOT EXISTS payment_webhook_events_unprocessed
  ON public.payment_webhook_events (provider, received_at) WHERE processed_at IS NULL AND signature_valid;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read webhook events" ON public.payment_webhook_events
  FOR SELECT TO authenticated USING (public.is_admin());
