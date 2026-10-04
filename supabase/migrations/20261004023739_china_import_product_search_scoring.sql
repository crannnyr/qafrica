-- Applied to production on 2026-10-04 (already live; committed so git matches the database).
-- How well one search word matches one product (0 = no match).
-- Word-start matches rank highest; a light stem ("clothes" ~ "clothing", "shirts" ~ "shirt")
-- and mid-word matches ("bag" in "handbag" needs 4+ letters) rank lower.
create or replace function public.china_import_search_token_score(h text, c text, pc text, t text)
returns numeric language sql immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when h ~ ('\m' || t) then 3.0
    when c ~ ('\m' || t) then 2.8
    when pc ~ ('\m' || t) then 2.6
    when length(t) >= 6 and (h || ' ' || c || ' ' || pc) ~ ('\m' || left(t, length(t) - 2)) then 2.0
    when length(t) >= 4 and (h || ' ' || c || ' ' || pc) like '%' || t || '%' then 1.5
    else 0 end;
$$;

create or replace function public.search_china_import_products(
  p_query text,
  p_parent text default null,
  p_category text default null,
  p_price_max numeric default null,
  p_exclude uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
) returns jsonb
language plpgsql stable
set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare
  v_norm text := btrim(regexp_replace(lower(replace(replace(coalesce(p_query, ''), '''', ''), '’', '')), '[^a-z0-9]+', ' ', 'g'));
  v_tokens text[];
  v_fixed text[] := '{}';
  v_weight numeric[] := '{}';
  v_changed boolean := false;
  t text; w text; maxd int;
  v_result jsonb;
begin
  if v_norm = '' then
    return jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'corrected', null);
  end if;
  v_tokens := (select array_agg(x) from (select distinct x from unnest(string_to_array(v_norm, ' ')) x where x <> '' limit 8) d);

  foreach t in array v_tokens loop
    if exists (
      select 1 from public.china_import_search_haystack(p_parent, p_category, p_price_max, p_exclude) y
      where public.china_import_search_token_score(y.h, y.c, y.pc, t) > 0
    ) then
      v_fixed := v_fixed || t; v_weight := v_weight || 1.0;
    else
      -- No product matches this word: correct it to the nearest catalogue word
      -- (typos rarely change the first letter, so those candidates win ties).
      maxd := case when length(t) <= 3 then 0 when length(t) <= 5 then 1 else 2 end;
      w := null;
      if maxd > 0 then
        select v.word into w
        from (
          select word, count(*) freq
          from public.china_import_search_haystack(p_parent, p_category, p_price_max, p_exclude) y,
               regexp_split_to_table(y.h || ' ' || y.c || ' ' || y.pc, ' ') word
          where length(word) >= 3 and abs(length(word) - length(t)) <= 3
          group by word
        ) v
        where least(levenshtein(t, v.word), levenshtein(t, left(v.word, length(t)))) <= maxd
        order by (left(v.word, 1) <> left(t, 1)),
                 least(levenshtein(t, v.word), levenshtein(t, left(v.word, length(t)))),
                 v.freq desc, v.word
        limit 1;
      end if;
      if w is not null then
        v_fixed := v_fixed || w; v_weight := v_weight || 0.8; v_changed := true;
      else
        v_fixed := v_fixed || t; v_weight := v_weight || 1.0;
      end if;
    end if;
  end loop;

  with tok as (
    select f.t, f.wt from unnest(v_fixed, v_weight) as f(t, wt)
  ), scored as (
    select y.id,
           sum(public.china_import_search_token_score(y.h, y.c, y.pc, tok.t) * tok.wt)
             + case when y.h like '%' || v_norm || '%' then 2 else 0 end as score,
           count(*) filter (where public.china_import_search_token_score(y.h, y.c, y.pc, tok.t) > 0) as matched
    from public.china_import_search_haystack(p_parent, p_category, p_price_max, p_exclude) y cross join tok
    group by y.id, y.h
  ), need as (
    -- Prefer products matching every word; if there are none, fall back to any word.
    select case when exists (select 1 from scored where matched = cardinality(v_fixed)) then cardinality(v_fixed) else 1 end as n
  ), hits as (
    select s.id, s.score from scored s, need where s.matched >= need.n and s.matched > 0
  ), page as (
    select p.id, p.name, p.description, p.image_url, p.image_urls, p.price_cny, p.price_ngn, p.price_usd,
           p.category, p.parent_category, p.moq, p.has_variants, p.variants, p.delivery_time, p.ship_only,
           p.sort_order, p.units_sold, p.is_trending, p.trending_order, p.created_at, p.volume_cbm,
           p.weight_grams, p.sea_shipping_cost_ngn, p.flight_shipping_cost_ngn, h.score
    from hits h join public.china_import_products p on p.id = h.id
    order by h.score desc, p.units_sold desc, p.created_at desc, p.id
    limit greatest(least(coalesce(p_limit, 20), 50), 1) offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(page) - 'score' order by page.score desc, page.units_sold desc, page.created_at desc, page.id) from page), '[]'::jsonb),
    'total', (select count(*) from hits),
    'corrected', case when v_changed then array_to_string(v_fixed, ' ') else null end
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.china_import_search_token_score(text, text, text, text) from public, anon, authenticated;
grant execute on function public.china_import_search_token_score(text, text, text, text) to service_role;
