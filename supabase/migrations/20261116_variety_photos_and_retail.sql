alter table public.products add column if not exists subtitle text;
alter table public.products add column if not exists category text not null default 'Beauty Rituals';
alter table public.products add column if not exists badge_text text;
alter table public.products add column if not exists compare_at_price_usd numeric(10, 2);
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists bundle_tiers jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists how_to_use jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists materials_and_care text;
alter table public.products add column if not exists shipping_estimate text not null default '2–3 business days processing + 5–10 business days US delivery';
alter table public.products add column if not exists stock_status text not null default 'in_stock';
alter table public.products add column if not exists low_stock_count integer;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists sort_order integer not null default 100;
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
alter table public.products add column if not exists updated_at timestamptz not null default now();

revoke all on public.products, public.orders from public, anon, authenticated;
grant select (
  id,
  store_brand,
  cj_sku,
  title,
  subtitle,
  category,
  badge_text,
  slug,
  description,
  benefits,
  price_usd,
  compare_at_price_usd,
  image_urls,
  bundle_tiers,
  how_to_use,
  materials_and_care,
  shipping_estimate,
  stock_status,
  low_stock_count,
  featured,
  sort_order,
  seo_title,
  seo_description,
  active,
  created_at,
  updated_at
) on public.products to anon, authenticated;
grant all on public.products, public.orders to service_role;

create or replace view public.storefront_products
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
  created_at,
  subtitle,
  category,
  badge_text,
  compare_at_price_usd,
  case
    when jsonb_typeof(variants) = 'array' then (
      select coalesce(jsonb_agg(item - 'supplierCostUsd'), '[]'::jsonb)
      from jsonb_array_elements(variants) as variant(item)
    )
    else '[]'::jsonb
  end as variants,
  bundle_tiers,
  how_to_use,
  materials_and_care,
  shipping_estimate,
  stock_status,
  low_stock_count,
  featured,
  sort_order,
  seo_title,
  seo_description,
  updated_at,
  cj_sku
from public.products
where active is true;

revoke all on public.storefront_products from public, anon, authenticated;
grant select on public.storefront_products to anon, authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
