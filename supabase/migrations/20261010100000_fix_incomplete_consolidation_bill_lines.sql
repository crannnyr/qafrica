-- Fix consolidation bill generation when a customer-specific override exists
-- and the batch default price row is missing, and honor saved overrides.
--
-- Eligibility already treats coalesce(customer override, batch default) as a
-- valid price. The generator must use the same rule; an INNER JOIN to the
-- default-price table silently omitted otherwise-priced products.
DO $repair$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef(
    'public.close_batch_billing(text,text,text,text,uuid)'::regprocedure
  );

  IF position('left join import_batch_item_bills ib' IN v_def) = 0 THEN
    v_def := replace(
      v_def,
      'join import_batch_item_bills ib',
      'left join import_batch_item_bills ib'
    );
  END IF;

  v_def := replace(
    v_def,
    'then ib.unit_amount_ngn * b.qty',
    'then coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty'
  );
  v_def := replace(
    v_def,
    'round(ib.unit_amount_ngn * b.qty, 2)',
    'round(coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty, 2)'
  );
  v_def := replace(
    v_def,
    'and ib.unit_amount_ngn > 0',
    'and coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) > 0'
  );

  IF position('left join import_batch_item_bills ib' IN v_def) = 0
     OR position(
       'coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty',
       v_def
     ) = 0
     OR position(
       'and coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) > 0',
       v_def
     ) = 0 THEN
    RAISE EXCEPTION
      'Consolidation billing patch verification failed; refusing to install';
  END IF;

  EXECUTE v_def;
END
$repair$;
