-- Card-payment bookkeeping on subscription_payments: whether the payer asked to save
-- the card, and the Flutterwave payment_method_id (pmd_...) once the card is tokenized
-- — the row that actually gets copied into flutterwave_saved_cards once the charge
-- succeeds (never before; we only keep a card that proved chargeable).
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS save_card boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_payment_method_id text;
