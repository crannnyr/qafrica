-- Premium storefront looks (Atelier, Noir) — Growth plan and above.
-- Only widens the allowed values; existing stores are untouched.
-- Curated collections live in stores.look_settings.collections (jsonb), so no new table.
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_storefront_look_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_storefront_look_check
  CHECK (storefront_look = ANY (ARRAY['classic','clean','boutique','catalog','social','bento','atelier','noir']::text[]));
