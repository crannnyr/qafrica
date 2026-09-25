-- Applied live 2026-09-25 (names: reviews_rebuild_verified_buyers, reviews_customer_fk_to_customers).
-- Verified (rolled back): delivered buyer reviews + edits, undelivered/stranger/direct-fake blocked, phone + foreign photo
-- blocked, seller cannot edit ratings, one seller reply, public summary correct.
-- Reviews rebuild: verified buyers only, written via RPC; sellers reply but can't edit; admins can hide.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seller_reply text,
  ADD COLUMN IF NOT EXISTS seller_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_order_product ON public.reviews (order_id, product_id) WHERE order_id IS NOT NULL;

-- Close the old holes: no direct inserts/updates from browsers
DROP POLICY IF EXISTS "Authenticated customers can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Store owners can update reviews in their store" ON public.reviews;

CREATE OR REPLACE FUNCTION public.submit_review(p_order_id uuid, p_product_id uuid, p_rating int, p_content text, p_tags text[] DEFAULT '{}', p_images text[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; c customers%ROWTYPE; v_id uuid; v_text text := left(trim(COALESCE(p_content, '')), 1000);
  allowed text[] := ARRAY['True to size','Runs small','Runs large','Good quality','Looks like the photos','Fast delivery','Great value','Well packaged','Would buy again'];
BEGIN
  SELECT * INTO c FROM customers WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Sign in to write a review' USING ERRCODE = '42501'; END IF;
  SELECT * INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR o.customer_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '42501'; END IF;
  IF NOT (o.status = 'delivered' OR COALESCE(o.is_escrow_released, false)) THEN
    RAISE EXCEPTION 'You can review once your order is delivered' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id AND COALESCE(original_product_id, product_id) = p_product_id) THEN
    RAISE EXCEPTION 'This item is not in that order' USING ERRCODE = '22023';
  END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Choose 1 to 5 stars' USING ERRCODE = '22023'; END IF;
  IF v_text ~ '\d[\d\s\-]{8,}\d' OR v_text ~* '(https?://|www\.|wa\.me|t\.me)' THEN
    RAISE EXCEPTION 'Please remove phone numbers and links from your review' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(array_length(p_images, 1), 0) > 3 THEN RAISE EXCEPTION 'Up to 3 photos' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_images, '{}')) i WHERE i !~ '^https://bahiqhpypapvktpxrths\.supabase\.co/storage/v1/object/public/review-images/') THEN
    RAISE EXCEPTION 'Invalid photo' USING ERRCODE = '22023';
  END IF;
  INSERT INTO reviews (product_id, store_id, order_id, customer_id, customer_name, customer_email, rating, content, tags, images,
                       is_verified_purchase, is_approved, created_at, updated_at)
  VALUES (p_product_id, (SELECT store_id FROM products WHERE id = p_product_id), o.id, c.id,  -- supplier's store for resold items
          split_part(c.full_name, ' ', 1) || COALESCE(' ' || left(split_part(c.full_name, ' ', 2), 1) || '.', ''),
          c.email, p_rating, v_text,
          ARRAY(SELECT DISTINCT t FROM unnest(COALESCE(p_tags, '{}')) t WHERE t = ANY (allowed)),
          COALESCE(p_images, '{}'), true, true, now(), now())
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET rating = EXCLUDED.rating, content = EXCLUDED.content, tags = EXCLUDED.tags, images = EXCLUDED.images, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_review(uuid, uuid, int, text, text[], text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, uuid, int, text, text[], text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_to_review(p_review_id uuid, p_reply text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_text text := left(trim(COALESCE(p_reply, '')), 500);
BEGIN
  IF length(v_text) < 2 THEN RAISE EXCEPTION 'Write a reply' USING ERRCODE = '22023'; END IF;
  UPDATE reviews r SET seller_reply = v_text, seller_replied_at = now()
  WHERE r.id = p_review_id AND r.seller_reply IS NULL
    AND EXISTS (SELECT 1 FROM stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'You can reply once to reviews of your own products' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reply_to_review(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_review(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_review_visible(p_review_id uuid, p_visible boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501'; END IF;
  UPDATE reviews SET is_approved = p_visible, hidden_reason = CASE WHEN p_visible THEN NULL ELSE p_reason END, updated_at = now() WHERE id = p_review_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_review_visible(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_review_visible(uuid, boolean, text) TO authenticated;

-- Public summary + page of reviews for a product
CREATE OR REPLACE FUNCTION public.product_reviews(p_product_id uuid, p_stars int DEFAULT NULL, p_with_photos boolean DEFAULT false, p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (SELECT * FROM reviews WHERE product_id = p_product_id AND is_approved)
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM base),
    'average', (SELECT round(avg(rating)::numeric, 1) FROM base),
    'breakdown', (SELECT jsonb_object_agg(s, (SELECT count(*) FROM base WHERE rating = s)) FROM generate_series(1, 5) s),
    'with_photos', (SELECT count(*) FROM base WHERE COALESCE(array_length(images, 1), 0) > 0),
    'tags', COALESCE((SELECT jsonb_agg(jsonb_build_object('tag', t, 'count', n) ORDER BY n DESC)
                      FROM (SELECT t, count(*) n FROM base, unnest(tags) t GROUP BY t ORDER BY count(*) DESC LIMIT 6) x), '[]'::jsonb),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', COALESCE(customer_name, 'Customer'), 'rating', rating, 'content', content, 'tags', tags, 'images', images,
        'verified', COALESCE(is_verified_purchase, false), 'created_at', created_at, 'seller_reply', seller_reply) ORDER BY created_at DESC)
      FROM (SELECT * FROM base
            WHERE (p_stars IS NULL OR rating = p_stars) AND (NOT p_with_photos OR COALESCE(array_length(images, 1), 0) > 0)
            ORDER BY (COALESCE(array_length(images, 1), 0) > 0) DESC, created_at DESC
            LIMIT LEAST(GREATEST(p_limit, 1), 30) OFFSET GREATEST(p_offset, 0)) page), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.product_reviews(uuid, int, boolean, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.product_reviews(uuid, int, boolean, int, int) TO anon, authenticated;

-- Which delivered items in my orders I can still review
CREATE OR REPLACE FUNCTION public.my_reviewable_items(p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', COALESCE(oi.original_product_id, oi.product_id), 'name', oi.product_name,
            'review', (SELECT jsonb_build_object('rating', r.rating, 'content', r.content, 'tags', r.tags)
                       FROM reviews r WHERE r.order_id = o.id AND r.product_id = COALESCE(oi.original_product_id, oi.product_id)))), '[]'::jsonb)
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.id = p_order_id AND o.customer_id = auth.uid() AND (o.status = 'delivered' OR COALESCE(o.is_escrow_released, false));
$$;
REVOKE ALL ON FUNCTION public.my_reviewable_items(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_reviewable_items(uuid) TO authenticated;

-- Review photos: public bucket; customers upload only into their own folder, images only, 5 MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-images', 'review-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS "Customers upload own review images" ON storage.objects;
CREATE POLICY "Customers upload own review images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-images' AND (storage.foldername(name))[1] = auth.uid()::text
              AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = auth.uid()));

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_customer_id_fkey;
UPDATE public.reviews SET customer_id = NULL WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM public.customers);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
