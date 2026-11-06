-- China Import Nomba provider and payment intents.
-- Existing orders/bills and Paystack flows remain intact. Nomba starts disabled
-- until credentials and the webhook are configured in the QAfrica Supabase project.

ALTER TABLE public.import_admin_credentials
  ADD COLUMN IF NOT EXISTS nomba_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.china_import_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  intent_type text NOT NULL CHECK (intent_type IN ('order', 'bill')),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.china_import_orders(id) ON DELETE RESTRICT,
  bill_id uuid REFERENCES public.china_import_consolidation_bills(id) ON DELETE RESTRICT,
  amount_ngn numeric(14,2) NOT NULL CHECK (amount_ngn > 0),
  provider text NOT NULL CHECK (provider = 'nomba'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  checkout_url text,
  nomba_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT china_import_payment_intent_target_check CHECK (
    (intent_type = 'order' AND order_id IS NOT NULL AND bill_id IS NULL)
    OR (intent_type = 'bill' AND bill_id IS NOT NULL AND order_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS china_import_payment_intents_customer_created_idx
  ON public.china_import_payment_intents (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS china_import_payment_intents_status_created_idx
  ON public.china_import_payment_intents (status, created_at DESC);

ALTER TABLE public.china_import_payment_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.china_import_payment_intents FROM anon, authenticated;
GRANT ALL ON TABLE public.china_import_payment_intents TO service_role;
