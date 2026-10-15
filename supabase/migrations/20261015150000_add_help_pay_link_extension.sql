-- Allow the owner to extend their own unpaid Help Pay links without losing contributions.
CREATE OR REPLACE FUNCTION public.extend_shared_cart(p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sc public.shared_carts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to extend this payment link' USING ERRCODE = '42501';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'Choose an expiry date in the future' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at > now() + interval '90 days' THEN
    RAISE EXCEPTION 'A payment link can be extended up to 90 days ahead' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO sc FROM public.shared_carts WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR sc.created_by IS NULL OR sc.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the account that created this link can extend it' USING ERRCODE = '42501';
  END IF;
  IF sc.status = 'paid' OR sc.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Paid links cannot be extended' USING ERRCODE = '22023';
  END IF;
  UPDATE public.shared_carts SET expires_at = p_expires_at, status = 'active' WHERE id = sc.id;
END;
$$;
REVOKE ALL ON FUNCTION public.extend_shared_cart(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_shared_cart(text, timestamptz) TO authenticated;
