begin;

grant usage on schema public to anon, authenticated, service_role;

revoke all on public.products from public, anon, authenticated;
revoke select (
  id,
  store_brand,
  cj_sku,
  title,
  slug,
  description,
  benefits,
  price_usd,
  supplier_cost_usd,
  image_urls,
  active,
  created_at
) on public.products from anon, authenticated;

drop view if exists public.storefront_products;
create view public.storefront_products
with (security_barrier = true)
as
select
  id,
  store_brand,
  title,
  slug,
  description,
  benefits,
  price_usd,
  image_urls,
  active,
  created_at
from public.products
where active is true;

revoke all on public.storefront_products from public, anon, authenticated;
grant select on public.storefront_products to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
