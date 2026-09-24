-- Applied live via apply_migration on 2026-09-24 (name: stores_domain_status_allow_processing).
-- AdminDomainRequests sets domain_status = 'processing' (and the Store type allows it),
-- but the check constraint rejected it, so that admin step always failed.
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_domain_status_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_domain_status_check
  CHECK (domain_status IN ('none', 'pending', 'processing', 'connected', 'failed'));
