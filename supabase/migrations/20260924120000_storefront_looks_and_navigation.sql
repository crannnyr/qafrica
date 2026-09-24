-- Applied live via apply_migration on 2026-09-24 (name: storefront_looks_and_navigation).
-- Storefront "look" (layout template) is separate from `theme` (colour/font palette).
-- 'classic' = the current layout, so all existing stores render unchanged until the owner opts in.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS storefront_look text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS nav_style text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS sidebar_side text NOT NULL DEFAULT 'left',
  ADD COLUMN IF NOT EXISTS category_images jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS look_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_storefront_look_check
    CHECK (storefront_look IN ('classic','clean','boutique','catalog','social','bento')),
  ADD CONSTRAINT stores_nav_style_check
    CHECK (nav_style IN ('auto','bottom','sidebar')),
  ADD CONSTRAINT stores_sidebar_side_check
    CHECK (sidebar_side IN ('left','right')),
  ADD CONSTRAINT stores_category_images_is_object
    CHECK (jsonb_typeof(category_images) = 'object'),
  ADD CONSTRAINT stores_look_settings_is_object
    CHECK (jsonb_typeof(look_settings) = 'object');

COMMENT ON COLUMN public.stores.storefront_look IS 'Layout template. classic = original layout; clean/boutique/catalog/social/bento = new looks.';
COMMENT ON COLUMN public.stores.nav_style IS 'auto = look default; bottom = bottom tab bar; sidebar = side rail (drawer on mobile).';
COMMENT ON COLUMN public.stores.sidebar_side IS 'Which side the sidebar/drawer sits on when nav_style = sidebar.';
COMMENT ON COLUMN public.stores.category_images IS 'Owner-picked circle image per category: {"<category>": "<image url>"}. Missing keys fall back to a product image.';
COMMENT ON COLUMN public.stores.look_settings IS 'Extra per-look details (e.g. wordmark split, hero slides). Shape validated in app code per look.';
