-- Safe-to-store card metadata (last4, network, expiry — never the PAN/CVV) captured at
-- tokenize time, held here until the charge actually succeeds and it's worth copying into
-- flutterwave_saved_cards.
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS provider_card_meta jsonb;
