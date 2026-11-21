import "server-only";

import { randomUUID } from "node:crypto";
import type { BundleTier, ProductVariant } from "@/lib/products";

export const DEFAULT_SHIPPING_ESTIMATE =
  "2–3 business days processing + 5–10 business days US delivery";

export const PRODUCT_ADMIN_COLUMNS =
  "id, store_brand, cj_sku, title, subtitle, category, badge_text, slug, description, benefits, price_usd, compare_at_price_usd, supplier_cost_usd, image_urls, variants, bundle_tiers, how_to_use, materials_and_care, shipping_estimate, stock_status, low_stock_count, featured, sort_order, seo_title, seo_description, active, created_at, updated_at";
export const LEGACY_PRODUCT_ADMIN_COLUMNS =
  "id, store_brand, cj_sku, title, slug, description, benefits, price_usd, supplier_cost_usd, image_urls, active, created_at";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isMissingProductColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find .* column|schema cache/i.test(error.message ?? "")
  );
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function normalizeVariants(value: unknown): ProductVariant[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const variants: ProductVariant[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const optionLabel =
      typeof entry.optionLabel === "string" ? entry.optionLabel.trim() : "Style";
    const imageUrls = entry.imageUrls;
    const swatchImageUrl = entry.swatchImageUrl;
    const sku = typeof entry.sku === "string" ? entry.sku.trim() : "";
    const retailPriceUsd = entry.retailPriceUsd;
    const compareAtPriceUsd = entry.compareAtPriceUsd;
    const supplierCostUsd = entry.supplierCostUsd;
    const inStock = entry.inStock === undefined ? true : entry.inStock;

    if (
      name.length < 1 ||
      name.length > 120 ||
      optionLabel.length > 60 ||
      sku.length > 100 ||
      !Array.isArray(imageUrls) ||
      imageUrls.length > 30 ||
      !imageUrls.every(isHttpUrl) ||
      !isHttpUrl(swatchImageUrl) ||
      !imageUrls.includes(swatchImageUrl) ||
      (retailPriceUsd !== null &&
        (typeof retailPriceUsd !== "number" ||
          !Number.isFinite(retailPriceUsd) ||
          retailPriceUsd <= 0 ||
          retailPriceUsd > 100_000)) ||
      (compareAtPriceUsd !== null &&
        (typeof compareAtPriceUsd !== "number" ||
          !Number.isFinite(compareAtPriceUsd) ||
          compareAtPriceUsd <= 0 ||
          compareAtPriceUsd > 100_000)) ||
      (supplierCostUsd !== null &&
        (typeof supplierCostUsd !== "number" ||
          !Number.isFinite(supplierCostUsd) ||
          supplierCostUsd < 0 ||
          supplierCostUsd > 100_000)) ||
      typeof inStock !== "boolean" ||
      (entry.stockNote !== undefined &&
        (typeof entry.stockNote !== "string" || entry.stockNote.length > 160))
    ) {
      return null;
    }

    variants.push({
      id:
        typeof entry.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(entry.id)
          ? entry.id
          : randomUUID(),
      optionLabel: optionLabel || "Style",
      name,
      sku,
      retailPriceUsd,
      compareAtPriceUsd,
      supplierCostUsd,
      swatchImageUrl,
      imageUrls,
      inStock,
      ...(typeof entry.stockNote === "string" ? { stockNote: entry.stockNote.trim() } : {}),
    });
  }

  const uniqueIds = new Set(variants.map((variant) => variant.id));
  const uniqueNames = new Set(variants.map((variant) => variant.name.toLowerCase()));
  return uniqueIds.size === variants.length && uniqueNames.size === variants.length
    ? variants
    : null;
}

export function normalizeBundleTiers(value: unknown): BundleTier[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const tiers: BundleTier[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.qty !== "number" ||
      !Number.isInteger(entry.qty) ||
      entry.qty < 2 ||
      entry.qty > 100 ||
      typeof entry.label !== "string" ||
      entry.label.trim().length < 1 ||
      entry.label.length > 80 ||
      typeof entry.discountPercent !== "number" ||
      !Number.isFinite(entry.discountPercent) ||
      entry.discountPercent < 0 ||
      entry.discountPercent > 90 ||
      (entry.badge !== undefined &&
        (typeof entry.badge !== "string" || entry.badge.length > 60))
    ) {
      return null;
    }
    tiers.push({
      qty: entry.qty,
      label: entry.label.trim(),
      discountPercent: entry.discountPercent,
      ...(typeof entry.badge === "string" ? { badge: entry.badge.trim() } : {}),
    });
  }
  return tiers;
}
