import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicServerClient } from "@/lib/supabase/public";

export type Product = {
  id: string;
  store_brand: string;
  cj_sku: string | null;
  title: string;
  subtitle: string | null;
  category: string;
  badge_text: string | null;
  slug: string;
  description: string;
  benefits: string[];
  price_usd: number;
  compare_at_price_usd: number | null;
  supplier_cost_usd?: number;
  image_urls: string[];
  variants: ProductVariant[];
  bundle_tiers: BundleTier[];
  how_to_use: string[];
  materials_and_care: string | null;
  shipping_estimate: string;
  stock_status: string;
  low_stock_count: number | null;
  featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductVariant = {
  id: string;
  optionLabel: string;
  name: string;
  sku: string;
  retailPriceUsd: number | null;
  compareAtPriceUsd: number | null;
  supplierCostUsd?: number | null;
  swatchImageUrl: string;
  imageUrls: string[];
  inStock: boolean;
  stockNote?: string;
};

export type BundleTier = {
  qty: number;
  label: string;
  discountPercent: number;
  badge?: string;
};

type ProductRow = {
  id: string;
  store_brand: string;
  cj_sku?: string | null;
  title: string;
  slug: string;
  description: string | null;
  benefits: unknown;
  price_usd: number | string;
  subtitle?: string | null;
  category?: string | null;
  badge_text?: string | null;
  compare_at_price_usd?: number | string | null;
  variants?: unknown;
  bundle_tiers?: unknown;
  how_to_use?: unknown;
  materials_and_care?: string | null;
  shipping_estimate?: string | null;
  stock_status?: string | null;
  low_stock_count?: number | null;
  featured?: boolean | null;
  sort_order?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  image_urls: string[] | null;
  active: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export const SAMPLE_PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

export const SAMPLE_PRODUCT: Product = {
  id: SAMPLE_PRODUCT_ID,
  store_brand: "Roam & Nest",
  cj_sku: "CJ-RN-DOG-001",
  title: "CalmPaws Silicone Slow-Feeder Lick Mat & Bowl Set",
  subtitle: "A calmer mealtime and a cozy enrichment ritual",
  category: "Dog Enrichment",
  badge_text: "Bestseller",
  slug: "calmpaws-silicone-slow-feeder-lick-mat-set",
  description:
    "Turn everyday mealtime into a thoughtful enrichment moment with a flexible silicone slow-feeder lick mat and bowl set designed for easy, mess-conscious use.",
  benefits: [
    "Encourages slower, steadier mealtime pacing",
    "Flexible silicone is easy to position and clean",
    "Useful at home or neatly packed for calm trips",
  ],
  price_usd: 24.99,
  compare_at_price_usd: 34.99,
  supplier_cost_usd: 6.5,
  image_urls: [
    "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1200&q=85",
  ],
  variants: [],
  bundle_tiers: [],
  how_to_use: [],
  materials_and_care: null,
  shipping_estimate: "2–3 business days processing + 5–10 business days US delivery",
  stock_status: "in_stock",
  low_stock_count: null,
  featured: false,
  sort_order: 100,
  seo_title: null,
  seo_description: null,
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const PRODUCT_COLUMNS =
  "id, store_brand, cj_sku, title, subtitle, category, badge_text, slug, description, benefits, price_usd, compare_at_price_usd, image_urls, variants, bundle_tiers, how_to_use, materials_and_care, shipping_estimate, stock_status, low_stock_count, featured, sort_order, seo_title, seo_description, active, created_at, updated_at";
const LEGACY_PRODUCT_COLUMNS =
  "id, store_brand, title, slug, description, benefits, price_usd, image_urls, active, created_at";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMissingProductColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find .* column|schema cache/i.test(error.message ?? "")
  );
}

function mapVariants(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ProductVariant[] => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.optionLabel !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.sku !== "string" ||
      (entry.retailPriceUsd !== null && typeof entry.retailPriceUsd !== "number") ||
      (entry.compareAtPriceUsd !== null && typeof entry.compareAtPriceUsd !== "number") ||
      typeof entry.swatchImageUrl !== "string" ||
      !Array.isArray(entry.imageUrls) ||
      !entry.imageUrls.every((url) => typeof url === "string") ||
      typeof entry.inStock !== "boolean"
    ) {
      return [];
    }

    return [{
      id: entry.id,
      optionLabel: entry.optionLabel,
      name: entry.name,
      sku: entry.sku,
      retailPriceUsd: entry.retailPriceUsd,
      compareAtPriceUsd: entry.compareAtPriceUsd,
      ...(typeof entry.supplierCostUsd === "number" || entry.supplierCostUsd === null
        ? { supplierCostUsd: entry.supplierCostUsd }
        : {}),
      swatchImageUrl: entry.swatchImageUrl,
      imageUrls: entry.imageUrls,
      inStock: entry.inStock,
      ...(typeof entry.stockNote === "string" ? { stockNote: entry.stockNote } : {}),
    }];
  });
}

function mapBundleTiers(value: unknown): BundleTier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): BundleTier[] =>
    isRecord(entry) &&
    typeof entry.qty === "number" &&
    Number.isInteger(entry.qty) &&
    entry.qty > 0 &&
    typeof entry.label === "string" &&
    typeof entry.discountPercent === "number" &&
    Number.isFinite(entry.discountPercent)
      ? [{
          qty: entry.qty,
          label: entry.label,
          discountPercent: entry.discountPercent,
          ...(typeof entry.badge === "string" ? { badge: entry.badge } : {}),
        }]
      : [],
  );
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    store_brand: row.store_brand,
    cj_sku: row.cj_sku ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    category: row.category ?? "Dog Enrichment",
    badge_text: row.badge_text ?? null,
    slug: row.slug,
    description: row.description ?? "",
    benefits: Array.isArray(row.benefits)
      ? row.benefits.filter((benefit): benefit is string => typeof benefit === "string")
      : [],
    price_usd: Number(row.price_usd),
    compare_at_price_usd: row.compare_at_price_usd == null
      ? null
      : Number(row.compare_at_price_usd),
    image_urls: row.image_urls ?? [],
    variants: mapVariants(row.variants),
    bundle_tiers: mapBundleTiers(row.bundle_tiers),
    how_to_use: Array.isArray(row.how_to_use)
      ? row.how_to_use.filter((step): step is string => typeof step === "string")
      : [],
    materials_and_care: row.materials_and_care ?? null,
    shipping_estimate:
      row.shipping_estimate ?? "2–3 business days processing + 5–10 business days US delivery",
    stock_status: row.stock_status ?? "in_stock",
    low_stock_count: row.low_stock_count ?? null,
    featured: row.featured ?? false,
    sort_order: row.sort_order ?? 100,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    active: row.active ?? true,
    ...(row.created_at ? { created_at: row.created_at } : {}),
    ...(row.updated_at ? { updated_at: row.updated_at } : {}),
  };
}

async function sampleIfDatabaseIsEmpty(
  supabase: SupabaseClient,
  product: Product | null,
  fallbackSlug?: string,
): Promise<Product | null> {
  if (product || !supabase) return product;

  const { count, error } = await supabase
    .from("storefront_products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  if (error) throw new Error(`Could not check the product catalog: ${error.message}`);
  if (count !== 0) return null;
  return fallbackSlug === SAMPLE_PRODUCT.slug || fallbackSlug === SAMPLE_PRODUCT_ID
    ? SAMPLE_PRODUCT
    : null;
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = createPublicServerClient();
  if (!supabase) return [SAMPLE_PRODUCT];

  const extendedResult = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .order("created_at", { ascending: false });

  let data: ProductRow[] | null = extendedResult.data as ProductRow[] | null;
  let error = extendedResult.error;
  if (error && isMissingProductColumn(error)) {
    const legacyResult = await supabase
      .from("storefront_products")
      .select(LEGACY_PRODUCT_COLUMNS)
      .eq("active", true)
      .order("created_at", { ascending: false });
    data = legacyResult.data as ProductRow[] | null;
    error = legacyResult.error;
  }
  if (error) throw new Error(`Could not load products: ${error.message}`);
  if (!data?.length) return [SAMPLE_PRODUCT];
  return data.map(mapProduct);
}

export async function getActiveProductById(id: string): Promise<Product | null> {
  const supabase = createPublicServerClient();
  if (!supabase) return id === SAMPLE_PRODUCT_ID ? SAMPLE_PRODUCT : null;

  const extendedResult = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  let data: ProductRow | null = extendedResult.data as ProductRow | null;
  let error = extendedResult.error;
  if (error && isMissingProductColumn(error)) {
    const legacyResult = await supabase
      .from("storefront_products")
      .select(LEGACY_PRODUCT_COLUMNS)
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();
    data = legacyResult.data as ProductRow | null;
    error = legacyResult.error;
  }
  if (error) throw new Error(`Could not load the requested product: ${error.message}`);
  const product = data ? mapProduct(data) : null;
  if (product) return product;
  return sampleIfDatabaseIsEmpty(supabase, null, id === SAMPLE_PRODUCT_ID ? SAMPLE_PRODUCT_ID : undefined);
}

export async function getActiveProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createPublicServerClient();
  if (!supabase) return slug === SAMPLE_PRODUCT.slug ? SAMPLE_PRODUCT : null;

  const extendedResult = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  let data: ProductRow | null = extendedResult.data as ProductRow | null;
  let error = extendedResult.error;
  if (error && isMissingProductColumn(error)) {
    const legacyResult = await supabase
      .from("storefront_products")
      .select(LEGACY_PRODUCT_COLUMNS)
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    data = legacyResult.data as ProductRow | null;
    error = legacyResult.error;
  }
  if (error) throw new Error(`Could not load the requested product: ${error.message}`);
  const product = data ? mapProduct(data) : null;
  if (product) return product;
  return sampleIfDatabaseIsEmpty(supabase, null, slug === SAMPLE_PRODUCT.slug ? SAMPLE_PRODUCT.slug : undefined);
}

export async function getSupplierCostForActiveProduct(
  id: string,
  variantId?: string,
): Promise<number | null> {
  const supabase = createAdminClient();
  if (!supabase) {
    if (variantId) return null;
    return id === SAMPLE_PRODUCT_ID ? SAMPLE_PRODUCT.supplier_cost_usd ?? null : null;
  }

  const extendedResult = await supabase
    .from("products")
    .select("supplier_cost_usd, variants")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  let data: { supplier_cost_usd: number | string; variants?: unknown } | null =
    extendedResult.data as { supplier_cost_usd: number | string; variants?: unknown } | null;
  let error = extendedResult.error;
  if (error && isMissingProductColumn(error)) {
    const legacyResult = await supabase
      .from("products")
      .select("supplier_cost_usd")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();
    data = legacyResult.data as { supplier_cost_usd: number | string } | null;
    error = legacyResult.error;
  }
  if (error) {
    throw new Error(`Could not load the product supplier cost: ${error.message}`);
  }
  if (data) {
    if (variantId) {
      if (!("variants" in data)) return null;
      const variant = mapVariants(data.variants).find((item) => item.id === variantId);
      if (!variant) return null;
      if (variant.supplierCostUsd != null) return variant.supplierCostUsd;
    }
    return Number(data.supplier_cost_usd);
  }

  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  if (countError) {
    throw new Error(`Could not check the product catalog: ${countError.message}`);
  }
  return count === 0 && id === SAMPLE_PRODUCT_ID
    ? SAMPLE_PRODUCT.supplier_cost_usd ?? null
    : null;
}
