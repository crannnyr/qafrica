-- One row per subscription payment attempt through Flutterwave (v4).
-- The server prices the plan, starts the charge, and activates the plan only after Flutterwave
-- confirms it (webhook or status check). Owners can read their own rows; only server code writes.
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id            uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  provider            text NOT NULL DEFAULT 'flutterwave',
  method              text NOT NULL,                        -- bank_transfer
  tier                text NOT NULL,
  duration_months     integer NOT NULL,                     -- 0 = lifetime
  is_lifetime         boolean NOT NULL DEFAULT false,
  is_starter_pack     boolean NOT NULL DEFAULT false,
  niches              text[] NOT NULL DEFAULT '{}',
  amount              numeric(12,2) NOT NULL,               -- naira we asked for
  paid_amount         numeric(12,2),                        -- naira Flutterwave confirmed
  reference           text NOT NULL UNIQUE,
  provider_charge_id  text,
  status              text NOT NULL DEFAULT 'pending',      -- pending | activating | paid | review | failed
  next_action         jsonb,                                -- what the payer must do (account number, redirect)
  raw_init            jsonb,                                -- Flutterwave's response when the charge started
  raw_confirm         jsonb,                                -- Flutterwave's charge when confirmed
  subscription_id     uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz,
  expires_at          timestamptz
);
CREATE INDEX IF NOT EXISTS subscription_payments_user_idx   ON public.subscription_payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_payments_charge_idx ON public.subscription_payments (provider_charge_id);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read own subscription payments" ON public.subscription_payments;
CREATE POLICY "Owners read own subscription payments" ON public.subscription_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Flutterwave customer (cus_…) the one-time transfer account belongs to; used to match
-- incoming transfers when the webhook doesn't carry our reference.
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS provider_customer_id text;
CREATE INDEX IF NOT EXISTS subscription_payments_customer_idx ON public.subscription_payments (provider_customer_id, created_at DESC);
