# Sunday Rituals

A mobile-first beauty accessories storefront built with Next.js, Supabase, and PayPal. The starter catalog includes the Silk Heatless Curling Rod Set, so the storefront can be previewed before database credentials are configured.

## Set up the database

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the product and order tables, enables row-level security, creates the public-safe `storefront_products` view, and seeds the sample product. For an existing project, run [`supabase/migrations/20261115214600_storefront_products_view.sql`](./supabase/migrations/20261115214600_storefront_products_view.sql) instead. Run SQL against the Supabase project matching `.env.local`; the scripts refresh the REST schema cache.
3. In **Project Settings → API**, copy the project URL, anon/public key, and service-role key into the matching fields in the root `.env.local` file. Keep the service-role key private; it is only used by server-side routes.

## Set up PayPal

1. Create a PayPal developer app and copy its sandbox client ID and secret.
2. Add the client ID to `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and the secret to `PAYPAL_CLIENT_SECRET` in `.env.local`. Keep `PAYPAL_MODE=sandbox` while testing.
3. Set `ADMIN_PASSWORD` to a unique, strong password before using the admin dashboard. The development-only default is `changeme123`; production rejects that default.

PayPal checkout is hidden until a client ID is configured. A completed payment is captured and saved to Supabase by server-side routes; checkout requires the Supabase service-role key so paid orders can be recorded.

Set `GEMINI_API_KEY` in `.env.local` to enable the AI tools. In `/admin`, the **1-Link AI Product Importer** can read a supplier product URL, use the free Jina reader when direct access is blocked, and accept pasted page text as a fallback. Preview pricing includes a $3.50 US shipping buffer unless an exact shipped cost is supplied. Publishing creates an active product in Supabase; the resulting product page is available at `/products/[slug]`.

## Run locally

From the project root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The shop is at `/`, and the protected fulfillment dashboard is at `/admin`.

To verify a production build:

```bash
npm run build
```

## Before launch

- Replace all sandbox PayPal credentials with live credentials and set `PAYPAL_MODE=live`.
- Use a unique production `ADMIN_PASSWORD`; never publish `.env.local` or the Supabase service-role key.
- Confirm product descriptions, image rights, delivery estimates, customer-support contact details, and return terms are accurate for your business.
- PayPal and supplier transaction, shipping, or other business fees may apply; “free shipping” is the store’s customer-facing offer, not a guarantee of zero operating costs.
