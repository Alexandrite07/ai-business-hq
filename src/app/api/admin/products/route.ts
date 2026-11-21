import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import {
  isHttpUrl,
  isMissingProductColumn,
  isRecord,
  LEGACY_PRODUCT_ADMIN_COLUMNS,
  normalizeBundleTiers,
  normalizeVariants,
  PRODUCT_ADMIN_COLUMNS,
} from "@/lib/product-management";
import { createAdminClient } from "@/lib/supabase/admin";

type NewProductInput = Record<string, unknown>;

function readField(input: NewProductInput, camel: string, snake: string): unknown {
  return input[camel] ?? input[snake];
}

function isValidText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}

function isValidImageList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 30 &&
    value.every(isHttpUrl)
  );
}

function migrationFieldsRequested(input: NewProductInput, variants: unknown[], tiers: unknown[]) {
  return (
    variants.length > 0 ||
    tiers.length > 0 ||
    Boolean(input.subtitle) ||
    Boolean(readField(input, "badgeText", "badge_text")) ||
    readField(input, "compareAtPriceUsd", "compare_at_price_usd") != null ||
    (Array.isArray(input.howToUse) && input.howToUse.length > 0) ||
    Boolean(readField(input, "materialsAndCare", "materials_and_care")) ||
    Boolean(readField(input, "featured", "featured")) ||
    (typeof readField(input, "sortOrder", "sort_order") === "number" &&
      readField(input, "sortOrder", "sort_order") !== 100) ||
    Boolean(readField(input, "seoTitle", "seo_title")) ||
    Boolean(readField(input, "seoDescription", "seo_description")) ||
    Boolean(readField(input, "category", "category"))
  );
}

function withLegacyDefaults(product: Record<string, unknown>) {
  return {
    ...product,
    subtitle: null,
    category: "Beauty Rituals",
    badge_text: null,
    compare_at_price_usd: null,
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
  };
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 503 },
    );
  }

  let migrationRequired = false;
  const extendedResult = await supabase
    .from("products")
    .select(PRODUCT_ADMIN_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  let data: Array<Record<string, unknown>> = extendedResult.data ?? [];
  let error = extendedResult.error;
  if (error && isMissingProductColumn(error)) {
    migrationRequired = true;
    const legacyResult = await supabase
      .from("products")
      .select(LEGACY_PRODUCT_ADMIN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    data = (legacyResult.data ?? []) as Array<Record<string, unknown>>;
    error = legacyResult.error;
  }
  if (error) {
    console.error("Admin product list lookup failed:", error);
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }

  return NextResponse.json(
    {
      products: data.map((product) =>
        migrationRequired ? withLegacyDefaults(product) : product,
      ),
      migrationRequired,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  let input: NewProductInput;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    input = body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const title = input.title;
  const cjSku = readField(input, "cjSku", "cj_sku");
  const priceUsd = readField(input, "priceUsd", "price_usd");
  const supplierCostUsd = readField(input, "supplierCostUsd", "supplier_cost_usd");
  const imageUrls = readField(input, "imageUrls", "image_urls");
  const benefits = input.benefits;
  const variants = input.variants === undefined ? [] : normalizeVariants(input.variants);
  const bundleTiers =
    input.bundleTiers === undefined && input.bundle_tiers === undefined
      ? []
      : normalizeBundleTiers(readField(input, "bundleTiers", "bundle_tiers"));
  const howToUse = readField(input, "howToUse", "how_to_use");

  if (
    !isValidText(title, 3, 120) ||
    typeof cjSku !== "string" ||
    cjSku.trim().length > 100 ||
    typeof priceUsd !== "number" ||
    !Number.isFinite(priceUsd) ||
    priceUsd <= 0 ||
    priceUsd > 100_000 ||
    typeof supplierCostUsd !== "number" ||
    !Number.isFinite(supplierCostUsd) ||
    supplierCostUsd < 0 ||
    supplierCostUsd > 100_000 ||
    (imageUrls !== undefined && !isValidImageList(imageUrls)) ||
    !Array.isArray(benefits) ||
    benefits.length > 20 ||
    !benefits.every((benefit) => typeof benefit === "string" && benefit.length <= 300) ||
    variants === null ||
    bundleTiers === null ||
    (howToUse !== undefined &&
      (!Array.isArray(howToUse) ||
        howToUse.length > 20 ||
        !howToUse.every((step) => typeof step === "string" && step.length <= 500)))
  ) {
    return NextResponse.json(
      { error: "Provide valid product details, photos, varieties, and retail pricing." },
      { status: 400 },
    );
  }

  const normalizedVariants = variants;
  const normalizedTiers = bundleTiers;
  const galleryUrls = isValidImageList(imageUrls)
    ? imageUrls
    : [...new Set(normalizedVariants.flatMap((variant) => variant.imageUrls))];
  if (!galleryUrls.length) {
    return NextResponse.json({ error: "Add at least one valid product image." }, { status: 400 });
  }

  const category = readField(input, "category", "category");
  const subtitle = readField(input, "subtitle", "subtitle");
  const badgeText = readField(input, "badgeText", "badge_text");
  const compareAtPriceUsd = readField(input, "compareAtPriceUsd", "compare_at_price_usd");
  const materialsAndCare = readField(input, "materialsAndCare", "materials_and_care");
  const shippingEstimate = readField(input, "shippingEstimate", "shipping_estimate");
  const stockStatus = readField(input, "stockStatus", "stock_status");
  const lowStockCount = readField(input, "lowStockCount", "low_stock_count");
  const featured = readField(input, "featured", "featured");
  const sortOrder = readField(input, "sortOrder", "sort_order");
  const seoTitle = readField(input, "seoTitle", "seo_title");
  const seoDescription = readField(input, "seoDescription", "seo_description");

  if (
    (category !== undefined && !isValidText(category, 1, 80)) ||
    (subtitle !== undefined && subtitle !== null && !isValidText(subtitle, 1, 200)) ||
    (badgeText !== undefined && badgeText !== null && !isValidText(badgeText, 1, 60)) ||
    (compareAtPriceUsd !== undefined &&
      compareAtPriceUsd !== null &&
      (typeof compareAtPriceUsd !== "number" ||
        !Number.isFinite(compareAtPriceUsd) ||
        compareAtPriceUsd <= 0 ||
        compareAtPriceUsd > 100_000)) ||
    (materialsAndCare !== undefined &&
      materialsAndCare !== null &&
      !isValidText(materialsAndCare, 1, 3000)) ||
    (shippingEstimate !== undefined && !isValidText(shippingEstimate, 1, 200)) ||
    (stockStatus !== undefined &&
      (typeof stockStatus !== "string" ||
        !["in_stock", "low_stock", "out_of_stock", "preorder"].includes(stockStatus))) ||
    (lowStockCount !== undefined &&
      lowStockCount !== null &&
      (typeof lowStockCount !== "number" ||
        !Number.isInteger(lowStockCount) ||
        lowStockCount < 0 ||
        lowStockCount > 1_000_000)) ||
    (featured !== undefined && typeof featured !== "boolean") ||
    (sortOrder !== undefined &&
      (typeof sortOrder !== "number" || !Number.isInteger(sortOrder))) ||
    (seoTitle !== undefined && seoTitle !== null && !isValidText(seoTitle, 1, 180)) ||
    (seoDescription !== undefined &&
      seoDescription !== null &&
      !isValidText(seoDescription, 1, 500))
  ) {
    return NextResponse.json({ error: "One or more product fields are invalid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 503 },
    );
  }

  const baseSlug = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug || "sunday-rituals-product"}-${randomUUID().slice(0, 8)}`;
  const legacyPayload = {
    store_brand: "Sunday Rituals",
    cj_sku: cjSku.trim() || null,
    title: title.trim(),
    slug,
    description:
      typeof input.description === "string" ? input.description.trim().slice(0, 5000) : "",
    benefits,
    price_usd: priceUsd.toFixed(2),
    supplier_cost_usd: supplierCostUsd.toFixed(2),
    image_urls: galleryUrls,
    active: typeof input.active === "boolean" ? input.active : true,
  };
  const extendedPayload = {
    ...legacyPayload,
    subtitle: typeof subtitle === "string" ? subtitle.trim() : null,
    category: typeof category === "string" ? category.trim() : "Beauty Rituals",
    badge_text: typeof badgeText === "string" ? badgeText.trim() : null,
    compare_at_price_usd:
      typeof compareAtPriceUsd === "number" ? compareAtPriceUsd.toFixed(2) : null,
    variants: normalizedVariants,
    bundle_tiers: normalizedTiers,
    how_to_use: howToUse ?? [],
    materials_and_care: typeof materialsAndCare === "string" ? materialsAndCare.trim() : null,
    shipping_estimate:
      typeof shippingEstimate === "string"
        ? shippingEstimate.trim()
        : "2–3 business days processing + 5–10 business days US delivery",
    stock_status: typeof stockStatus === "string" ? stockStatus : "in_stock",
    low_stock_count: typeof lowStockCount === "number" ? lowStockCount : null,
    featured: typeof featured === "boolean" ? featured : false,
    sort_order: typeof sortOrder === "number" ? sortOrder : 100,
    seo_title: typeof seoTitle === "string" ? seoTitle.trim() : null,
    seo_description: typeof seoDescription === "string" ? seoDescription.trim() : null,
    updated_at: new Date().toISOString(),
  };
  const result = await supabase
    .from("products")
    .insert(extendedPayload)
    .select(PRODUCT_ADMIN_COLUMNS)
    .single();

  if (result.error && isMissingProductColumn(result.error)) {
    if (migrationFieldsRequested(input, normalizedVariants, normalizedTiers)) {
      return NextResponse.json(
        {
          error: "Apply the product varieties migration before saving these fields.",
          migrationRequired: true,
        },
        { status: 409 },
      );
    }
    const legacyResult = await supabase
      .from("products")
      .insert(legacyPayload)
      .select(LEGACY_PRODUCT_ADMIN_COLUMNS)
      .single();
    if (legacyResult.error) {
      console.error("Legacy admin product creation failed:", legacyResult.error);
      return NextResponse.json({ error: "Could not save the new product." }, { status: 500 });
    }
    return NextResponse.json(
      { product: withLegacyDefaults(legacyResult.data), migrationRequired: true },
      { status: 200 },
    );
  }
  if (result.error) {
    console.error("Admin product creation failed:", result.error);
    return NextResponse.json({ error: "Could not save the new product." }, { status: 500 });
  }
  return NextResponse.json({ product: result.data, migrationRequired: false }, { status: 200 });
}
