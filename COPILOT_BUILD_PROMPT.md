Build a complete, production-ready, $0-cost US-targeted beauty accessories dropshipping storefront in this Next.js (App Router, TypeScript, Tailwind CSS) + Supabase + PayPal project.

Follow every requirement below and create all necessary files cleanly:

1. ENVIRONMENT & DATABASE SETUP FILES:
- Create `.env.example` (and create `.env.local` if it does not exist, without overwriting existing values) with:
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_PAYPAL_CLIENT_ID=
  PAYPAL_CLIENT_SECRET=
  PAYPAL_MODE=sandbox
  ADMIN_PASSWORD=changeme123
- Create `supabase/schema.sql` containing:
  - `products` table: `id` (uuid primary key default gen_random_uuid()), `store_brand` (text not null default 'Sunday Rituals'), `cj_sku` (text), `title` (text not null), `slug` (text unique not null), `description` (text), `benefits` (jsonb default '[]'::jsonb), `price_usd` (numeric(10,2) not null), `supplier_cost_usd` (numeric(10,2) not null), `image_urls` (text[] default '{}'), `active` (boolean default true), `created_at` (timestamptz default now()).
  - `orders` table: `id` (uuid primary key default gen_random_uuid()), `paypal_order_id` (text unique not null), `customer_name` (text not null), `customer_email` (text not null), `shipping_address` (jsonb not null), `items` (jsonb not null), `total_usd` (numeric(10,2) not null), `status` (text default 'paid_pending_fulfillment'), `cj_tracking_number` (text), `created_at` (timestamptz default now()).
  - Enable Row Level Security (RLS): allow public `SELECT` on `products` where `active = true`; keep `orders` and all writes restricted to service-role server routes.
  - Seed 1 realistic beauty product (`Silk Heatless Curling Rod Set`, slug `silk-heatless-curling-rod-set`, price `27.99`, supplier cost `8.50`, 3 benefit bullets, and clean placeholder images) so the UI renders immediately even before Supabase keys are added.

2. SUPABASE & PAYPAL SERVER UTILITIES (`src/lib/`):
- `src/lib/supabase/client.ts`: browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gracefully handles missing env vars during initial local preview).
- `src/lib/supabase/admin.ts`: server-only client using `SUPABASE_SERVICE_ROLE_KEY` for order insertion and admin CRUD.
- `src/lib/paypal.ts`: server helper to generate a PayPal REST API v2 OAuth access token (supporting `PAYPAL_MODE=sandbox` vs `live`) and verify/capture orders server-side so product prices cannot be manipulated on the frontend.

3. PAYPAL CHECKOUT API ROUTES (`src/app/api/paypal/`):
- `POST /api/paypal/create-order`: accepts `{ productId, quantity }`, fetches the authoritative `price_usd` and `title` from Supabase `products` (falling back to the sample product if Supabase is not configured yet), creates a PayPal v2 order in `USD` with shipping address collection enabled, and returns `{ orderID }`.
- `POST /api/paypal/capture-order`: accepts `{ orderID, productId, quantity }`, captures the payment via PayPal REST API v2, extracts the buyer's full name, email, and US shipping address from the capture payload, writes the confirmed order into Supabase `orders` with status `paid_pending_fulfillment`, and returns `{ success: true, order }`.

4. CUSTOMER-FACING STOREFRONT (`src/app/`):
- Brand identity: **Sunday Rituals** — clean, minimalist, high-converting US beauty aesthetic (`#FAF8F5` warm ivory background, `#1C1917` charcoal text, soft champagne/rose accents, mobile-first layout).
- `src/app/page.tsx`: High-converting landing page featuring:
  - Top announcement bar: "Free US Standard Shipping (5–10 Business Days) • 30-Day Money-Back Guarantee".
  - Hero section + featured product grid loaded from Supabase `products` (with automatic fallback to the sample product if DB is empty).
  - Trust badges (Secure PayPal & Guest Card Checkout, Fast US Dispatch, 30-Day Returns) and an interactive FAQ accordion.
- `src/app/products/[slug]/page.tsx`: Product detail & checkout page with:
  - Image gallery, product title, USD price, 3 benefit bullets, shipping timeline notice ("2–3 business days processing + 5–10 business days US delivery"), and quantity selector.
  - Embedded `@paypal/react-paypal-js` `<PayPalScriptProvider>` and `<PayPalButtons>` supporting both PayPal and Guest Credit/Debit Card checkout, wired to `/api/paypal/create-order` and `/api/paypal/capture-order`, redirecting to `/thank-you?orderId=...` after capture.
- `src/app/thank-you/page.tsx`: Order confirmation page displaying the order ID, estimated US delivery timeline, and customer support email.
- PayPal compliance legal pages (`src/app/shipping-policy/page.tsx` and `src/app/refund-policy/page.tsx`) linked in the global footer.

5. LIGHTWEIGHT ADMIN FULFILLMENT & AI PRODUCT DASHBOARD (`src/app/admin/page.tsx` + `src/app/api/admin/`):
- Protected by `ADMIN_PASSWORD` check.
- **Orders Tab:** Lists incoming orders with net profit calculation (Revenue minus Supplier Cost minus estimated PayPal 4.4% + $0.30 fee), a one-click **"Copy US Shipping Address"** button for fast pasting into CJdropshipping, and an input field to save `cj_tracking_number` and mark the order `shipped`.
- **Products Tab:** Form to add new CJdropshipping products (title, CJ SKU, retail price USD, supplier cost USD, image URLs, 3 benefit bullets) directly into Supabase without opening SQL Editor.

After creating all files, run `npm run build` to verify there are zero TypeScript or Next.js build errors, and list the exact steps I need to take next to run `supabase/schema.sql` and start `npm run dev`.
