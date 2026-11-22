import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import {
  DEFAULT_SHIPPING_ESTIMATE,
  isHttpUrl,
  isMissingProductColumn,
  isRecord,
  LEGACY_PRODUCT_ADMIN_COLUMNS,
  normalizeBundleTiers,
  normalizeVariants,
  PRODUCT_ADMIN_COLUMNS,
} from "@/lib/product-management";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

const FIELD_MAP: Record<string, string> = {
  title: "title",
  subtitle: "subtitle",
  category: "category",
  badgeText: "badge_text",
  badge_text: "badge_text",
  cjSku: "cj_sku",
  cj_sku: "cj_sku",
  slug: "slug",
  description: "description",
  benefits: "benefits",
  priceUsd: "price_usd",
  price_usd: "price_usd",
  compareAtPriceUsd: "compare_at_price_usd",
  compare_at_price_usd: "compare_at_price_usd",
  supplierCostUsd: "supplier_cost_usd",
  supplier_cost_usd: "supplier_cost_usd",
  imageUrls: "image_urls",
  image_urls: "image_urls",
  variants: "variants",
  bundleTiers: "bundle_tiers",
  bundle_tiers: "bundle_tiers",
  howToUse: "how_to_use",
  how_to_use: "how_to_use",
  materialsAndCare: "materials_and_care",
  materials_and_care: "materials_and_care",
  shippingEstimate: "shipping_estimate",
  shipping_estimate: "shipping_estimate",
  stockStatus: "stock_status",
  stock_status: "stock_status",
  lowStockCount: "low_stock_count",
  low_stock_count: "low_stock_count",
  featured: "featured",
  sortOrder: "sort_order",
  sort_order: "sort_order",
  seoTitle: "seo_title",
  seo_title: "seo_title",
  seoDescription: "seo_description",
  seo_description: "seo_description",
  active: "active",
};

function isMoney(value: unknown, allowZero = false): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= (allowZero ? 0 : 0.01) &&
    value <= 100_000
  );
}

function isString(value: unknown, max: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.trim().length > 0)
  );
}

function withLegacyDefaults(product: Record<string, unknown>) {
  return {
    ...product,
    subtitle: null,
    category: "Dog Enrichment",
    badge_text: null,
    compare_at_price_usd: null,
    variants: [],
    bundle_tiers: [],
    how_to_use: [],
    materials_and_care: null,
    shipping_estimate: DEFAULT_SHIPPING_ESTIMATE,
    stock_status: "in_stock",
    low_stock_count: null,
    featured: false,
    sort_order: 100,
    seo_title: null,
    seo_description: null,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "A valid product ID is required." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) throw new Error("Request body must be a JSON object.");
    body = parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request body must be valid JSON.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(body)) {
    const column = FIELD_MAP[field];
    if (!column) {
      return NextResponse.json({ error: `Unsupported product field: ${field}.` }, { status: 400 });
    }

    if (
      ["title", "category", "badge_text", "slug", "description", "materials_and_care", "shipping_estimate", "seo_title", "seo_description"].includes(column)
    ) {
      const max = column === "description" || column === "materials_and_care" ? 5000 : 500;
      if (value !== null && !isString(value, max, column === "description")) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      if (column === "slug" && typeof value === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        return NextResponse.json({ error: "Slug must contain lowercase letters, numbers, and hyphens." }, { status: 400 });
      }
      updates[column] = typeof value === "string" ? value.trim() : value;
      continue;
    }

    if (column === "cj_sku") {
      if (value !== null && (typeof value !== "string" || value.length > 100)) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      updates[column] = typeof value === "string" ? value.trim() || null : null;
      continue;
    }

    if (column === "benefits" || column === "how_to_use") {
      if (
        !Array.isArray(value) ||
        value.length > 30 ||
        !value.every((item) => typeof item === "string" && item.length <= 500)
      ) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      updates[column] = value;
      continue;
    }

    if (column === "price_usd" || column === "compare_at_price_usd" || column === "supplier_cost_usd") {
      if (value === null && column === "compare_at_price_usd") {
        updates[column] = null;
        continue;
      }
      if (!isMoney(value, column === "supplier_cost_usd")) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      updates[column] = value.toFixed(2);
      continue;
    }

    if (column === "image_urls") {
      if (!Array.isArray(value) || value.length > 30 || !value.every(isHttpUrl)) {
        return NextResponse.json({ error: "Product photos must be HTTP(S) URLs." }, { status: 400 });
      }
      updates[column] = value;
      continue;
    }

    if (column === "variants") {
      const variants = normalizeVariants(value);
      if (!variants) {
        return NextResponse.json({ error: "One or more product varieties are invalid." }, { status: 400 });
      }
      updates[column] = variants;
      continue;
    }

    if (column === "bundle_tiers") {
      const tiers = normalizeBundleTiers(value);
      if (!tiers) {
        return NextResponse.json({ error: "One or more bundle tiers are invalid." }, { status: 400 });
      }
      updates[column] = tiers;
      continue;
    }

    if (column === "active" || column === "featured") {
      if (typeof value !== "boolean") {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      updates[column] = value;
      continue;
    }

    if (column === "low_stock_count" || column === "sort_order") {
      if (
        value !== null &&
        (typeof value !== "number" ||
          !Number.isInteger(value) ||
          (column === "low_stock_count" && value < 0))
      ) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      updates[column] = value;
      continue;
    }

    if (column === "stock_status") {
      if (
        typeof value !== "string" ||
        !["in_stock", "low_stock", "out_of_stock", "preorder"].includes(value)
      ) {
        return NextResponse.json({ error: "Invalid stock status." }, { status: 400 });
      }
      updates[column] = value;
    }
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Provide at least one product field to update." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server credentials are not configured." }, { status: 503 });
  }
  updates.updated_at = new Date().toISOString();
  const extended = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select(PRODUCT_ADMIN_COLUMNS)
    .maybeSingle();

  if (extended.error && isMissingProductColumn(extended.error)) {
    const legacyColumns = new Set([
      "cj_sku",
      "title",
      "slug",
      "description",
      "benefits",
      "price_usd",
      "supplier_cost_usd",
      "image_urls",
      "active",
    ]);
    if (Object.keys(updates).some((column) => column !== "updated_at" && !legacyColumns.has(column))) {
      return NextResponse.json(
        { error: "Apply the product varieties migration before editing these fields.", migrationRequired: true },
        { status: 409 },
      );
    }
    const legacyUpdates = Object.fromEntries(
      Object.entries(updates).filter(([column]) => legacyColumns.has(column)),
    );
    const legacy = await supabase
      .from("products")
      .update(legacyUpdates)
      .eq("id", id)
      .select(LEGACY_PRODUCT_ADMIN_COLUMNS)
      .maybeSingle();
    if (legacy.error) {
      console.error("Legacy admin product update failed:", legacy.error);
      return NextResponse.json({ error: "Could not update the product." }, { status: 500 });
    }
    if (!legacy.data) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ product: withLegacyDefaults(legacy.data), migrationRequired: true });
  }

  if (extended.error) {
    console.error("Admin product update failed:", extended.error);
    return NextResponse.json({ error: "Could not update the product." }, { status: 500 });
  }
  if (!extended.data) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product: extended.data, migrationRequired: false });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "A valid product ID is required." }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server credentials are not configured." }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Admin product deletion failed:", error);
    return NextResponse.json({ error: "Could not delete the product." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
