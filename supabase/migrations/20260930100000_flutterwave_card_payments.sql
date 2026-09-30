-- Card payments + saved cards for store subscriptions, on Flutterwave (v4), alongside the
-- existing bank-transfer flow. Kept as its own table rather than reusing the legacy
-- `saved_cards` table, which stores Paystack authorization codes (a different provider,
-- different token shape) and is left untouched.
--
-- A saved card here stores Flutterwave's payment_method_id (pmd_...), never raw card
-- data — the card number/cvv are only ever held in memory for one encrypt-and-forward
-- request in the flutterwave edge function, never written to any table or log.
CREATE TABLE IF NOT EXISTS public.flutterwave_saved_cards (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_customer_id  text NOT NULL,                 -- Flutterwave cus_... this card belongs to
  payment_method_id     text NOT NULL,                 -- Flutterwave pmd_... (the card token)
  last4                 text NOT NULL,
  first6                text,
  network               text,                          -- visa | mastercard | verve | amex ...
  exp_month             integer NOT NULL,
  exp_year              integer NOT NULL,
  is_default            boolean NOT NULL DEFAULT false,
  is_active             boolean NOT NULL DEFAULT true,  -- false once removed by the owner
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flutterwave_saved_cards_user_idx ON public.flutterwave_saved_cards (user_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS flutterwave_saved_cards_pmd_idx ON public.flutterwave_saved_cards (payment_method_id);

ALTER TABLE public.flutterwave_saved_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read own flutterwave cards" ON public.flutterwave_saved_cards;
CREATE POLICY "Owners read own flutterwave cards" ON public.flutterwave_saved_cards
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
-- No insert/update/delete policy: only server code (service role) writes, same pattern as
-- subscription_payments. The owner "removes" a card via an edge function action, which
-- flips is_active rather than deleting, so past subscription_payments rows still resolve.

-- Which saved card a subscription auto-renews with, when auto_renew_method = 'card'.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew_card_id uuid REFERENCES public.flutterwave_saved_cards(id) ON DELETE SET NULL;

-- Auto-renewal bookkeeping so the hourly sweep never double-charges and can back off
-- after repeated failures instead of retrying forever.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_renew_last_error   text,
  ADD COLUMN IF NOT EXISTS auto_renew_fail_count   integer NOT NULL DEFAULT 0;

COMMENT ON TABLE public.flutterwave_saved_cards IS
  'Tokenized cards (Flutterwave v4 payment_method_id) for store-subscription card payments and auto-renewal. Never stores raw card data.';
