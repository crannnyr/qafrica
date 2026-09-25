-- Applied live 2026-09-25 (name: bank_change_server_side_otp). Verified (rolled back): first-time payout account set ok;
-- direct change blocked; writing the code field blocked; balances still blocked. Codes now issued by bank-change edge fn.
-- Payout bank changes must go through the server-side code (bank-change edge function).
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS bank_change_attempts int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.guard_wallet_money()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.balance, 0) <> 0 OR COALESCE(NEW.total_earned, 0) <> 0 OR COALESCE(NEW.total_withdrawn, 0) <> 0
       OR COALESCE(NEW.pending_balance, 0) <> 0 OR COALESCE(NEW.escrow_balance, 0) <> 0 THEN
      RAISE EXCEPTION 'New wallets must start at zero' USING ERRCODE = '42501';
    END IF;
    IF NEW.bank_change_otp IS NOT NULL THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance OR NEW.total_earned IS DISTINCT FROM OLD.total_earned
     OR NEW.total_withdrawn IS DISTINCT FROM OLD.total_withdrawn OR NEW.pending_balance IS DISTINCT FROM OLD.pending_balance
     OR NEW.escrow_balance IS DISTINCT FROM OLD.escrow_balance OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Wallet balances can only be changed by QAFRICA' USING ERRCODE = '42501';
  END IF;
  -- Verification code fields are server-only
  IF NEW.bank_change_otp IS DISTINCT FROM OLD.bank_change_otp
     OR NEW.bank_change_otp_expires_at IS DISTINCT FROM OLD.bank_change_otp_expires_at
     OR NEW.bank_change_attempts IS DISTINCT FROM OLD.bank_change_attempts THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Payout account: the owner may set it the first time; changing it needs the emailed code (server)
  IF OLD.withdrawal_account_number IS NOT NULL AND (
       NEW.withdrawal_account_number IS DISTINCT FROM OLD.withdrawal_account_number
    OR NEW.withdrawal_bank_name IS DISTINCT FROM OLD.withdrawal_bank_name
    OR NEW.withdrawal_account_name IS DISTINCT FROM OLD.withdrawal_account_name) THEN
    RAISE EXCEPTION 'To change your payout account, confirm the code we email you' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Clear any codes created the old (browser-generated, readable) way
UPDATE public.wallets SET bank_change_otp = NULL, bank_change_otp_expires_at = NULL WHERE bank_change_otp IS NOT NULL;
