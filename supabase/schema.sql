 extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_brand text not null default 'Sunday Rituals',
  cj_sku text,
  title text not null,
  subtitle text,
  category text not null default 'Beauty Rituals',
  badge_text text,
  slug text unique not null,
  description text,
  benefits jsonb default '[]'::jsonb,
  price_usd numeric(10, 2) not null,
  compare_at_price_usd numeric(10, 2),
  supplier_cost_usd numeric(10, 2) not null,
  image_urls text[] default '{}',
  variants jsonb not null default '[]'::jsonb,
  bundle_tiers jsonb not null default '[]'::jsonb,
  how_to_use jsonb not null default '[]'::jsonb,
  materials_and_care text,
  shipping_estimate text not null default '2–3 business days processing + 5–10 business days US delivery',
  stock_status text not null default 'in_stock',
  low_stock_count integer,
  featured boolean not null default false,
  sort_order integer not null default 100,
  seo_title text,
  seo_description text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  paypal_order_id text unique not null,
  customer_name text not null,
  customer_email text not null,
  shipping_address jsonb not null,
  items jsonb not null,
  total_usd numeric(10, 2) not null,
  status text default 'paid_pending_fulfillment',
  cj_tracking_number text,
  created_at timestamptz default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products for select
  using (active = true);

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
grant usage on schema public to anon, authenticated, service_role;

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
grant select on public.storefront_products to anon, authenticated;
grant select on public.storefront_products to service_role;

insert into public.products (
  store_brand,
  cj_sku,
  title,
  category,
  slug,
  description,
  benefits,
  price_usd,
  supplier_cost_usd,
  image_urls,
  active
)
values (
  'Sunday Rituals',
  'CJ-BEAUTY-SILK-001',
  'Silk Heatless Curling Rod Set',
  'Beauty Rituals',
  'silk-heatless-curling-rod-set',
  'Wake up to soft, defined curls with a comfortable, no-heat styling ritual. Wrap, rest, and reveal a polished look without turning on your hot tools.',
  '[
    "Create soft curls without heat damage",
    "Smooth satin finish helps reduce friction overnight",
    "Easy wrap-and-go styling for your evening routine"
  ]'::jsonb,
  27.99,
  8.50,
  array[
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1200&q=85'
  ],
  true
)
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
