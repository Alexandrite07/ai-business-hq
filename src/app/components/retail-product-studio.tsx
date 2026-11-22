"use client";

/* eslint-disable @next/next/no-img-element -- Supabase public image URLs are configured per store. */

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { BundleTier, ProductVariant } from "@/lib/products";

type StudioProduct = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  badge_text: string | null;
  slug: string;
  description: string;
  benefits: string[];
  price_usd: number | string;
  compare_at_price_usd: number | string | null;
  supplier_cost_usd: number | string;
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
  cj_sku: string | null;
  created_at?: string;
};

type EditorDraft = {
  id?: string;
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  optionLabel: string;
  badgeText: string;
  stockStatus: string;
  lowStockCount: string;
  featured: boolean;
  sortOrder: string;
  active: boolean;
  priceUsd: string;
  compareAtPriceUsd: string;
  supplierCostUsd: string;
  cjSku: string;
  description: string;
  benefits: string[];
  imageUrls: string[];
  variants: ProductVariant[];
  bundleTiers: BundleTier[];
  howToUse: string[];
  materialsAndCare: string;
  shippingEstimate: string;
  seoTitle: string;
  seoDescription: string;
};

type StudioMode = "catalog" | "link" | "batch" | "concept" | "editor";
type CatalogFilter = "all" | "live" | "drafts" | "featured" | "low-stock";

const CATEGORIES = [
  "All Gear",
  "Dog Enrichment",
  "Walk & Travel",
  "Cozy Cat",
  "Home & Sanctuary",
  "Holiday Gift Sets",
];
const BADGES = ["Bestseller", "New Arrival", "Limited Batch", "TikTok Viral"];
const DEFAULT_SHIPPING = "2–3 business days processing + 5–10 business days US delivery";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function blankDraft(): EditorDraft {
  return {
    title: "",
    subtitle: "",
    slug: "",
    category: "Dog Enrichment",
    optionLabel: "Color",
    badgeText: "",
    stockStatus: "in_stock",
    lowStockCount: "",
    featured: false,
    sortOrder: "100",
    active: false,
    priceUsd: "",
    compareAtPriceUsd: "",
    supplierCostUsd: "",
    cjSku: "",
    description: "",
    benefits: ["", "", ""],
    imageUrls: [],
    variants: [],
    bundleTiers: [],
    howToUse: [],
    materialsAndCare: "",
    shippingEstimate: DEFAULT_SHIPPING,
    seoTitle: "",
    seoDescription: "",
  };
}

function toDraft(product: Partial<StudioProduct> & Record<string, unknown>): EditorDraft {
  const variants = Array.isArray(product.variants) ? product.variants as ProductVariant[] : [];
  return {
    ...blankDraft(),
    id: typeof product.id === "string" ? product.id : undefined,
    title: typeof product.title === "string" ? product.title : "",
    subtitle: typeof product.subtitle === "string" ? product.subtitle : "",
    slug: typeof product.slug === "string" ? product.slug : "",
    category: typeof product.category === "string" ? product.category : "Dog Enrichment",
    optionLabel: variants[0]?.optionLabel ?? "Color",
    badgeText: typeof product.badge_text === "string" ? product.badge_text : "",
    stockStatus: typeof product.stock_status === "string" ? product.stock_status : "in_stock",
    lowStockCount: product.low_stock_count == null ? "" : String(product.low_stock_count),
    featured: product.featured === true,
    sortOrder: String(typeof product.sort_order === "number" ? product.sort_order : 100),
    active: product.active === true,
    priceUsd: product.price_usd == null ? "" : String(product.price_usd),
    compareAtPriceUsd:
      product.compare_at_price_usd == null ? "" : String(product.compare_at_price_usd),
    supplierCostUsd: product.supplier_cost_usd == null ? "" : String(product.supplier_cost_usd),
    cjSku: typeof product.cj_sku === "string" ? product.cj_sku : "",
    description: typeof product.description === "string" ? product.description : "",
    benefits: Array.isArray(product.benefits)
      ? product.benefits.filter((benefit): benefit is string => typeof benefit === "string")
      : ["", "", ""],
    imageUrls: Array.isArray(product.image_urls)
      ? product.image_urls.filter((url): url is string => typeof url === "string")
      : [],
    variants,
    bundleTiers: Array.isArray(product.bundle_tiers) ? product.bundle_tiers as BundleTier[] : [],
    howToUse: Array.isArray(product.how_to_use)
      ? product.how_to_use.filter((step): step is string => typeof step === "string")
      : [],
    materialsAndCare:
      typeof product.materials_and_care === "string" ? product.materials_and_care : "",
    shippingEstimate:
      typeof product.shipping_estimate === "string" ? product.shipping_estimate : DEFAULT_SHIPPING,
    seoTitle: typeof product.seo_title === "string" ? product.seo_title : "",
    seoDescription: typeof product.seo_description === "string" ? product.seo_description : "",
  };
}

function parseMoney(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function marginPercent(price: number, cost: number): number {
  const priceCents = Math.round(price * 100);
  const costCents = Math.round(cost * 100);
  const feeCents = Math.round(priceCents * 0.044 + 30);
  return priceCents > 0 ? ((priceCents - costCents - feeCents) / priceCents) * 100 : 0;
}

function autoPrice(cost: number, margin = 60): number {
  const costCents = Math.round(cost * 100);
  let cents = 99;
  while (cents - costCents - Math.round(cents * 0.044 + 30) < cents * (margin / 100)) {
    cents += 100;
  }
  return cents / 100;
}

async function responseJson<T>(response: Response): Promise<T & { error?: string; migrationRequired?: boolean }> {
  const result = await response.json() as T & { error?: string; migrationRequired?: boolean };
  if (!response.ok) {
    const error = new Error(result.error ?? "The request could not be completed.");
    Object.assign(error, { migrationRequired: result.migrationRequired });
    throw error;
  }
  return result;
}

export function RetailProductStudio({ initialMode = "catalog" }: { initialMode?: "catalog" | "link" }) {
  const [mode, setMode] = useState<StudioMode>(initialMode);
  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<EditorDraft>(blankDraft);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [migrationCopied, setMigrationCopied] = useState(false);
  const [bulkAction, setBulkAction] = useState("activate");
  const [bulkValue, setBulkValue] = useState("");
  const [url, setUrl] = useState("");
  const [supplierCost, setSupplierCost] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [concept, setConcept] = useState("");
  const [conceptCost, setConceptCost] = useState("");
  const [conceptImages, setConceptImages] = useState("");
  const [urlPhoto, setUrlPhoto] = useState("");
  const [variantPhotoInputs, setVariantPhotoInputs] = useState<Record<number, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    const result = await responseJson<{ products?: StudioProduct[]; migrationRequired?: boolean }>(
      await fetch("/api/admin/products", { cache: "no-store" }),
    );
    setProducts(result.products ?? []);
    setMigrationRequired(result.migrationRequired === true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (response) => {
        const result = await responseJson<{
          products?: StudioProduct[];
          migrationRequired?: boolean;
        }>(response);
        if (active) {
          setProducts(result.products ?? []);
          setMigrationRequired(result.migrationRequired === true);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load products.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const queryMatch = !search ||
      `${product.title} ${product.slug} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    const filterMatch =
      filter === "all" ||
      (filter === "live" && product.active) ||
      (filter === "drafts" && !product.active) ||
      (filter === "featured" && product.featured) ||
      (filter === "low-stock" && (product.stock_status === "low_stock" || product.stock_status === "out_of_stock"));
    return queryMatch && filterMatch;
  }), [filter, products, search]);

  function updateDraft<K extends keyof EditorDraft>(field: K, value: EditorDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function openEditor(product?: StudioProduct) {
    setError("");
    setDraft(product ? toDraft(product) : blankDraft());
    setMode("editor");
  }

  async function copyMigration() {
    setError("");
    try {
      const { sql } = await responseJson<{ sql: string }>(
        await fetch("/api/admin/products/migration-sql", { cache: "no-store" }),
      );
      await navigator.clipboard.writeText(sql);
      setMigrationCopied(true);
      window.setTimeout(() => setMigrationCopied(false), 3500);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Could not copy migration SQL.");
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const data = new FormData();
    data.set("file", file);
    const result = await responseJson<{ url: string }>(
      await fetch("/api/admin/products/upload-image", { method: "POST", body: data }),
    );
    return result.url;
  }

  async function submitUrlImport(autoPublish: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await responseJson<{
        product: {
          title: string;
          slug: string;
          description: string;
          benefits: string[];
          cjSku: string;
          selectedImageUrls: string[];
          variants: ProductVariant[];
        };
        pricingBreakdown: { recommendedPriceUsd: number; totalSupplierCostUsd: number };
        published: boolean;
      }>(
        await fetch("/api/admin/ai/import-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            autoPublish,
            ...(supplierCost.trim() ? { supplierCostOverrideUsd: Number(supplierCost) } : {}),
          }),
        }),
      );
      if (autoPublish) {
        setNotice("Product imported and published.");
        await loadProducts();
        return;
      }
      setDraft(toDraft({
        ...result.product,
        cj_sku: result.product.cjSku,
        image_urls: result.product.selectedImageUrls,
        variants: result.product.variants,
        price_usd: result.pricingBreakdown.recommendedPriceUsd,
        supplier_cost_usd: result.pricingBreakdown.totalSupplierCostUsd,
        active: false,
      }));
      setMode("editor");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import this URL.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBatchImport() {
    const urls = batchUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await responseJson<{
        succeeded: number;
        failed: number;
        results: Array<{ url: string; status: number; result: { error?: string } }>;
      }>(
        await fetch("/api/admin/ai/batch-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls, autoPublish: true }),
        }),
      );
      setNotice(`Batch complete: ${result.succeeded} succeeded, ${result.failed} failed.`);
      const failures = result.results.filter((item) => item.status >= 300);
      if (failures.length) setError(failures.map((item) => `${item.url}: ${item.result.error ?? "Import failed"}`).join(" · "));
      await loadProducts();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "Batch import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitConcept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const images = conceptImages.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      const result = await responseJson<{
        product: {
          title: string;
          slug: string;
          description: string;
          benefits: string[];
          optionLabel: string;
          variants: ProductVariant[];
          bundleTiers: BundleTier[];
          recommendedPriceUsd: number;
        };
      }>(
        await fetch("/api/admin/ai/generate-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawTitle: concept,
            rawSpecs: "Roam & Nest pet, travel, or home gear concept. Create warm, practical copy with no unsupported health, veterinary, or disease claims.",
            supplierCostUsd: Number(conceptCost),
            imageUrls: images,
            cjSku: "",
            autoPublish: false,
          }),
        }),
      );
      const imageUrls = images.length
        ? images
        : ["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85"];
      const retail = result.product.recommendedPriceUsd;
      setDraft({
        ...blankDraft(),
        title: result.product.title,
        slug: result.product.slug,
        optionLabel: result.product.optionLabel,
        description: result.product.description,
        benefits: result.product.benefits,
        priceUsd: String(retail),
        supplierCostUsd: String(Number(conceptCost)),
        cjSku: "",
        imageUrls,
        active: false,
        variants: result.product.variants,
        bundleTiers: result.product.bundleTiers,
      });
      setMode("editor");
    } catch (conceptError) {
      setError(conceptError instanceof Error ? conceptError.message : "Could not build this concept.");
    } finally {
      setBusy(false);
    }
  }

  function addVariant() {
    const image = draft.imageUrls[0] ?? "";
    updateDraft("variants", [
      ...draft.variants,
      {
        id: crypto.randomUUID(),
        optionLabel: draft.optionLabel,
        name: "",
        sku: "",
        retailPriceUsd: null,
        compareAtPriceUsd: null,
        supplierCostUsd: null,
        swatchImageUrl: image,
        imageUrls: image ? [image] : [],
        inStock: true,
      },
    ]);
  }

  function updateVariant(index: number, changes: Partial<ProductVariant>) {
    updateDraft(
      "variants",
      draft.variants.map((variant, itemIndex) =>
        itemIndex === index ? { ...variant, ...changes } : variant,
      ),
    );
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim() || null,
      slug: draft.slug.trim(),
      category: draft.category,
      badgeText: draft.badgeText.trim() || null,
      stockStatus: draft.stockStatus,
      lowStockCount: draft.lowStockCount ? Number(draft.lowStockCount) : null,
      featured: draft.featured,
      sortOrder: Number(draft.sortOrder),
      active: draft.active,
      priceUsd: Number(draft.priceUsd),
      compareAtPriceUsd: parseMoney(draft.compareAtPriceUsd),
      supplierCostUsd: Number(draft.supplierCostUsd),
      cjSku: draft.cjSku.trim(),
      description: draft.description.trim(),
      benefits: draft.benefits.map((benefit) => benefit.trim()).filter(Boolean),
      imageUrls: draft.imageUrls,
      variants: draft.variants,
      bundleTiers: draft.bundleTiers,
      howToUse: draft.howToUse,
      materialsAndCare: draft.materialsAndCare.trim() || null,
      shippingEstimate: draft.shippingEstimate,
      seoTitle: draft.seoTitle.trim() || null,
      seoDescription: draft.seoDescription.trim() || null,
    };
    try {
      const result = await responseJson<{ product: StudioProduct; migrationRequired?: boolean }>(
        await fetch(
          draft.id ? `/api/admin/products/${encodeURIComponent(draft.id)}` : "/api/admin/products",
          {
            method: draft.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        ),
      );
      if (result.migrationRequired) setMigrationRequired(true);
      setNotice(draft.id ? "Product changes saved live." : "Draft saved to your product catalog.");
      await loadProducts();
      if (result.product?.id) setDraft(toDraft(result.product));
    } catch (saveError) {
      const migrationMissing =
        saveError instanceof Error &&
        "migrationRequired" in saveError &&
        saveError.migrationRequired === true;
      if (migrationMissing) setMigrationRequired(true);
      setError(saveError instanceof Error ? saveError.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  }

  async function runOptimize(product: StudioProduct) {
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ product: StudioProduct; aiSource: string }>(
        await fetch("/api/admin/ai/optimize-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        }),
      );
      if (draft.id === result.product.id) setDraft(toDraft(result.product));
      setNotice("Copy and variety photo matches optimized.");
      await loadProducts();
    } catch (optimizeError) {
      setError(optimizeError instanceof Error ? optimizeError.message : "Could not optimize product.");
    } finally {
      setBusy(false);
    }
  }

  async function cloneProduct(product: StudioProduct) {
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ product: StudioProduct }>(
        await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/duplicate`, { method: "POST" }),
      );
      await loadProducts();
      openEditor(result.product);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : "Could not clone product.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(product: StudioProduct) {
    try {
      await responseJson<{ product: StudioProduct }>(
        await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !product.active }),
        }),
      );
      await loadProducts();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update product status.");
    }
  }

  async function deleteProduct(product: StudioProduct) {
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    try {
      await responseJson<{ success: boolean }>(
        await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" }),
      );
      setProducts((current) => current.filter((entry) => entry.id !== product.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete product.");
    }
  }

  async function runBulkAction() {
    if (!selectedIds.length) return;
    setBusy(true);
    setError("");
    try {
      await responseJson<{ affected: number }>(
        await fetch("/api/admin/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: selectedIds,
            action: bulkAction,
            ...(bulkAction === "set_category" ? { category: bulkValue } : {}),
            ...(bulkAction === "set_badge" ? { badgeText: bulkValue || null } : {}),
            ...(bulkAction === "adjust_price" ? { adjustPercent: Number(bulkValue) } : {}),
          }),
        }),
      );
      setSelectedIds([]);
      setNotice("Bulk product action completed.");
      await loadProducts();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  function addPhotoToGallery(image: string) {
    if (!image || draft.imageUrls.includes(image)) return;
    updateDraft("imageUrls", [...draft.imageUrls, image]);
  }

  function moveGalleryImage(index: number, direction: -1 | 1) {
    const next = [...draft.imageUrls];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    updateDraft("imageUrls", next);
  }

  function renderTabs() {
    const tabs: Array<[StudioMode, string]> = [
      ["link", "1-Link AI Importer"],
      ["batch", "Batch Multi-Link"],
      ["concept", "AI Concept Builder"],
      ["editor", "Retail & Variety Editor"],
      ["catalog", "Live Catalog"],
    ];
    return (
      <div aria-label="Retail product studio modes" className="studio-mode-tabs" role="tablist">
        {tabs.map(([tab, label]) => (
          <button
            aria-selected={mode === tab}
            className={mode === tab ? "is-active" : ""}
            key={tab}
            onClick={() => setMode(tab)}
            role="tab"
            style={{ minHeight: 44 }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="retail-product-studio">
      <div className="studio-heading">
        <div>
          <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> ROAM &amp; NEST</span>
          <h2>Retail Product Studio</h2>
          <p>Build, price, photograph, and publish every product variety from one place.</p>
        </div>
      </div>
      {migrationRequired && (
        <aside className="migration-banner" role="status">
          <div>
            <strong>Product varieties migration required</strong>
            <span>Run this SQL once in Supabase to enable variety photos, prices, and live editing.</span>
          </div>
          <button className="button button-dark" onClick={() => void copyMigration()} type="button">
            {migrationCopied ? "SQL copied" : "Copy Migration SQL"}
          </button>
        </aside>
      )}
      {renderTabs()}
      {(error || notice) && (
        <p aria-live="polite" className={error ? "admin-notice is-error" : "admin-notice"} role={error ? "alert" : "status"}>
          {error || notice}
        </p>
      )}
      {mode === "link" && (
        <section className="studio-panel">
          <h3>Import one supplier listing</h3>
          <p>Load varieties, photos, and margin-aware prices into the editor or publish immediately.</p>
          <label className="admin-field">
            <span>Supplier URL</span>
            <input onChange={(event) => setUrl(event.target.value)} placeholder="https://..." required type="url" value={url} />
          </label>
          <label className="admin-field">
            <span>Exact US-shipped supplier cost (optional)</span>
            <input min="0.01" onChange={(event) => setSupplierCost(event.target.value)} step="0.01" type="number" value={supplierCost} />
          </label>
          <div className="studio-actions">
            <button className="button button-outline" disabled={busy || !url} onClick={() => void submitUrlImport(false)} style={{ minHeight: 44 }} type="button">
              {busy ? "Importing…" : "Load Into Editor"}
            </button>
            <button className="button button-dark" disabled={busy || !url} onClick={() => void submitUrlImport(true)} style={{ minHeight: 44 }} type="button">
              {busy ? "Importing…" : "Import & Publish Live"}
            </button>
          </div>
        </section>
      )}
      {mode === "batch" && (
        <section className="studio-panel">
          <h3>Batch multi-link importer</h3>
          <p>Paste up to 10 supplier URLs, one per line. Successful imports publish live.</p>
          <label className="admin-field">
            <span>Supplier URLs (up to 10)</span>
            <textarea maxLength={24_000} onChange={(event) => setBatchUrls(event.target.value)} rows={6} value={batchUrls} />
          </label>
          <button className="button button-dark" disabled={busy} onClick={() => void submitBatchImport()} style={{ minHeight: 44 }} type="button">
            {busy ? "Importing batch…" : "Batch Import All"}
          </button>
        </section>
      )}
      {mode === "concept" && (
        <form className="studio-panel studio-form" onSubmit={(event) => void submitConcept(event)}>
          <h3>AI concept builder</h3>
          <label className="admin-field"><span>Product idea</span><textarea maxLength={500} onChange={(event) => setConcept(event.target.value)} required rows={3} value={concept} /></label>
          <div className="studio-form-grid">
            <label className="admin-field"><span>Supplier cost (USD)</span><input min="0" onChange={(event) => setConceptCost(event.target.value)} required step="0.01" type="number" value={conceptCost} /></label>
            <label className="admin-field"><span>Photo URLs, one per line</span><textarea onChange={(event) => setConceptImages(event.target.value)} rows={2} value={conceptImages} /></label>
          </div>
          <button className="button button-dark" disabled={busy} style={{ minHeight: 44 }} type="submit">{busy ? "Building…" : "Generate Product & Varieties"}</button>
        </form>
      )}
      {mode === "editor" && (
        <form className="studio-editor" onSubmit={(event) => void saveProduct(event)}>
          <div className="studio-panel-heading">
            <div><h3>{draft.id ? "Edit live product" : "Rich retail & variety editor"}</h3><p>All changes save directly to the catalog.</p></div>
            <label className="studio-toggle"><input checked={draft.active} onChange={(event) => updateDraft("active", event.target.checked)} type="checkbox" /> Active (Live)</label>
          </div>
          <div className="studio-editor-grid">
            <label className="admin-field"><span>Product title</span><input maxLength={120} onChange={(event) => updateDraft("title", event.target.value)} required value={draft.title} /></label>
            <label className="admin-field"><span>Subtitle</span><input maxLength={200} onChange={(event) => updateDraft("subtitle", event.target.value)} value={draft.subtitle} /></label>
            <div className="admin-field studio-slug-field"><span>Slug</span><div><input maxLength={120} onChange={(event) => updateDraft("slug", event.target.value)} required value={draft.slug} /><button className="button button-outline" onClick={() => updateDraft("slug", draft.title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))} style={{ minHeight: 44 }} type="button">Regenerate</button></div></div>
            <label className="admin-field"><span>Category</span><select onChange={(event) => updateDraft("category", event.target.value)} value={draft.category}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="admin-field"><span>Merchandising badge</span><input list="studio-badges" onChange={(event) => updateDraft("badgeText", event.target.value)} placeholder="Bestseller or custom" value={draft.badgeText} /><datalist id="studio-badges">{BADGES.map((badge) => <option key={badge} value={badge} />)}</datalist></label>
            <label className="admin-field"><span>Stock status</span><select onChange={(event) => updateDraft("stockStatus", event.target.value)} value={draft.stockStatus}><option value="in_stock">In Stock</option><option value="low_stock">Low Stock</option><option value="out_of_stock">Out of Stock</option><option value="preorder">Preorder</option></select></label>
            {draft.stockStatus === "low_stock" && <label className="admin-field"><span>Low stock count</span><input min="0" onChange={(event) => updateDraft("lowStockCount", event.target.value)} type="number" value={draft.lowStockCount} /></label>}
            <label className="admin-field"><span>Sort order</span><input onChange={(event) => updateDraft("sortOrder", event.target.value)} type="number" value={draft.sortOrder} /></label>
            <label className="studio-toggle"><input checked={draft.featured} onChange={(event) => updateDraft("featured", event.target.checked)} type="checkbox" /> Featured</label>
            <label className="admin-field"><span>CJ product SKU</span><input onChange={(event) => updateDraft("cjSku", event.target.value)} value={draft.cjSku} /></label>
          </div>
          <section className="studio-panel">
            <h4>Base pricing & live profit calculator</h4>
            <div className="studio-form-grid">
              <label className="admin-field"><span>Retail price ($)</span><input min="0.01" onChange={(event) => updateDraft("priceUsd", event.target.value)} required step="0.01" type="number" value={draft.priceUsd} /></label>
              <label className="admin-field"><span>Compare-at price ($)</span><input min="0.01" onChange={(event) => updateDraft("compareAtPriceUsd", event.target.value)} step="0.01" type="number" value={draft.compareAtPriceUsd} /></label>
              <label className="admin-field"><span>Supplier cost ($)</span><input min="0" onChange={(event) => updateDraft("supplierCostUsd", event.target.value)} required step="0.01" type="number" value={draft.supplierCostUsd} /></label>
            </div>
            {(() => {
              const price = Number(draft.priceUsd) || 0;
              const cost = Number(draft.supplierCostUsd) || 0;
              const margin = marginPercent(price, cost);
              const fee = Math.round(Math.round(price * 100) * 0.044 + 30) / 100;
              return <div className="studio-profit-summary"><span>PayPal fee {money.format(fee)}</span><strong>Net profit {money.format(price - cost - fee)}</strong><span className={margin >= 55 ? "margin-pill" : "margin-pill is-low"}>Net margin {margin.toFixed(1)}%</span><button className="button button-outline" onClick={() => updateDraft("priceUsd", String(autoPrice(cost)))} style={{ minHeight: 44 }} type="button">Auto-Price for 60% Margin (.99)</button></div>;
            })()}
          </section>
          <section className="studio-panel">
            <h4>Main product media gallery</h4>
            <div className="studio-inline-entry"><input aria-label="Product image URL" onChange={(event) => setUrlPhoto(event.target.value)} placeholder="Paste an image URL" value={urlPhoto} /><button className="button button-outline" onClick={() => { addPhotoToGallery(urlPhoto.trim()); setUrlPhoto(""); }} style={{ minHeight: 44 }} type="button">Add URL</button><button className="button button-outline" onClick={() => fileInput.current?.click()} style={{ minHeight: 44 }} type="button"><Upload size={15} /> Upload Photo</button><input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { addPhotoToGallery(await uploadImage(file)); } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Upload failed."); } finally { event.target.value = ""; } }} ref={fileInput} type="file" /></div>
            <div className="studio-photo-grid">{draft.imageUrls.map((image, index) => <article className="studio-photo-card" key={`${image}-${index}`}><img alt={`Product gallery photo ${index + 1}`} src={image} /><div><button aria-label="Move photo left" className="icon-button" disabled={index === 0} onClick={() => moveGalleryImage(index, -1)} type="button"><ChevronLeft size={15} /></button><button aria-label="Move photo right" className="icon-button" disabled={index === draft.imageUrls.length - 1} onClick={() => moveGalleryImage(index, 1)} type="button"><ChevronRight size={15} /></button><button className="icon-button" onClick={() => { const next = [...draft.imageUrls]; next.splice(index, 1); updateDraft("imageUrls", next); }} type="button"><Trash2 size={15} /></button></div><button className="cover-photo-button" disabled={index === 0} onClick={() => moveGalleryImage(index, -1)} type="button">{index === 0 ? "Cover photo" : "Set Cover"}</button></article>)}</div>
          </section>
          <section className="studio-panel variety-builder">
            <div className="studio-panel-heading"><div><h4>Varieties & photos</h4><p>Assign unique photos, SKUs, stock, and retail economics to every option.</p></div><div className="studio-actions"><button className="button button-outline" disabled={!draft.id || busy} onClick={() => { const product = products.find((entry) => entry.id === draft.id); if (product) void runOptimize(product); }} style={{ minHeight: 44 }} type="button"><Sparkles size={15} /> AI Auto-Match Photos</button><button className="button button-dark" onClick={addVariant} style={{ minHeight: 44 }} type="button"><Plus size={15} /> Add Variety</button></div></div>
            <label className="admin-field studio-option-label"><span>Shared Option Label</span><input maxLength={60} onChange={(event) => { const optionLabel = event.target.value; updateDraft("optionLabel", optionLabel); updateDraft("variants", draft.variants.map((variant) => ({ ...variant, optionLabel }))); }} placeholder="Color, Shade, Style, Set Size" value={draft.optionLabel} /></label>
            {draft.variants.length === 0 && <p className="studio-empty">No varieties yet. Add a color, shade, style, or set size.</p>}
            {draft.variants.map((variant, index) => <article className="studio-variant-card" key={variant.id}>
              <div className="studio-variant-header"><strong>Variety {index + 1}</strong><label className="studio-toggle"><input checked={variant.inStock} onChange={(event) => updateVariant(index, { inStock: event.target.checked })} type="checkbox" /> In Stock</label><button aria-label="Delete variety" className="icon-button danger" onClick={() => updateDraft("variants", draft.variants.filter((_, variantIndex) => variantIndex !== index))} type="button"><Trash2 size={16} /> Delete Variety</button></div>
              <div className="studio-form-grid">
                <label className="admin-field"><span>Variety name</span><input maxLength={120} onChange={(event) => updateVariant(index, { name: event.target.value })} required value={variant.name} /></label>
                <label className="admin-field"><span>CJ Variant SKU</span><input onChange={(event) => updateVariant(index, { sku: event.target.value })} value={variant.sku} /></label>
                <label className="admin-field"><span>Variety retail price ($, blank = base)</span><input min="0.01" onChange={(event) => updateVariant(index, { retailPriceUsd: event.target.value ? Number(event.target.value) : null })} step="0.01" type="number" value={variant.retailPriceUsd ?? ""} /></label>
                <label className="admin-field"><span>Compare-at price ($)</span><input min="0.01" onChange={(event) => updateVariant(index, { compareAtPriceUsd: event.target.value ? Number(event.target.value) : null })} step="0.01" type="number" value={variant.compareAtPriceUsd ?? ""} /></label>
                <label className="admin-field"><span>Variety supplier cost ($)</span><input min="0" onChange={(event) => updateVariant(index, { supplierCostUsd: event.target.value ? Number(event.target.value) : null })} step="0.01" type="number" value={variant.supplierCostUsd ?? ""} /></label>
              </div>
              {(() => {
                const price = variant.retailPriceUsd ?? (Number(draft.priceUsd) || 0);
                const cost = variant.supplierCostUsd ?? (Number(draft.supplierCostUsd) || 0);
                const margin = marginPercent(price, cost);
                return <p className="studio-variant-margin">Net {money.format(price - cost - Math.round(Math.round(price * 100) * 0.044 + 30) / 100)} · {margin.toFixed(1)}% margin</p>;
              })()}
              <div className="studio-photo-grid variety-photo-strip">{variant.imageUrls.map((image) => <div className="studio-photo-card" key={image}><img alt={`${variant.name} photo`} src={image} /><button aria-label="Set primary swatch" aria-pressed={variant.swatchImageUrl === image} className="icon-button" onClick={() => updateVariant(index, { swatchImageUrl: image })} type="button"><Star fill={variant.swatchImageUrl === image ? "currentColor" : "none"} size={15} /></button><button aria-label="Remove variety photo" className="icon-button danger" onClick={() => { const next = variant.imageUrls.filter((url) => url !== image); updateVariant(index, { imageUrls: next, swatchImageUrl: next[0] ?? "" }); }} type="button"><Trash2 size={15} /></button></div>)}</div>
              <div className="studio-gallery-attach"><span>Attach from product gallery:</span>{draft.imageUrls.map((image) => <button aria-pressed={variant.imageUrls.includes(image)} className="studio-gallery-thumb" key={image} onClick={() => { const next = variant.imageUrls.includes(image) ? variant.imageUrls.filter((url) => url !== image) : [...variant.imageUrls, image]; updateVariant(index, { imageUrls: next, swatchImageUrl: next.includes(variant.swatchImageUrl) ? variant.swatchImageUrl : (next[0] ?? "") }); }} style={{ backgroundImage: `url("${image}")`, minHeight: 44, minWidth: 44 }} type="button" />)}</div>
              <div className="studio-inline-entry"><input aria-label="Variety photo URL" onChange={(event) => setVariantPhotoInputs((current) => ({ ...current, [index]: event.target.value }))} placeholder="Paste variety photo URL" value={variantPhotoInputs[index] ?? ""} /><button className="button button-outline" onClick={() => { const photo = (variantPhotoInputs[index] ?? "").trim(); if (photo) { const next = [...new Set([...variant.imageUrls, photo])]; updateVariant(index, { imageUrls: next, swatchImageUrl: variant.swatchImageUrl || photo }); setVariantPhotoInputs((current) => ({ ...current, [index]: "" })); } }} style={{ minHeight: 44 }} type="button">Add URL</button><label className="button button-outline upload-label" style={{ minHeight: 44 }}><Upload size={15} /> Upload Variety Photo<input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const photo = await uploadImage(file); const next = [...new Set([...variant.imageUrls, photo])]; updateVariant(index, { imageUrls: next, swatchImageUrl: variant.swatchImageUrl || photo }); } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Upload failed."); } finally { event.target.value = ""; } }} type="file" /></label></div>
            </article>)}
          </section>
          <section className="studio-panel">
            <h4>Copy, bundles, care & SEO</h4>
            <label className="admin-field"><span>Description</span><textarea maxLength={5000} onChange={(event) => updateDraft("description", event.target.value)} rows={4} value={draft.description} /></label>
            <label className="admin-field"><span>Benefits (one per line)</span><textarea onChange={(event) => updateDraft("benefits", event.target.value.split(/\r?\n/))} rows={3} value={draft.benefits.join("\n")} /></label>
            <label className="admin-field"><span>How to Use (one step per line)</span><textarea onChange={(event) => updateDraft("howToUse", event.target.value.split(/\r?\n/).filter(Boolean))} rows={3} value={draft.howToUse.join("\n")} /></label>
            <label className="admin-field"><span>Materials & Care</span><textarea onChange={(event) => updateDraft("materialsAndCare", event.target.value)} rows={2} value={draft.materialsAndCare} /></label>
            <div className="studio-bundle-list"><strong>Bundle tiers</strong>{draft.bundleTiers.map((tier, index) => <div className="studio-bundle-row" key={`${tier.qty}-${index}`}><input aria-label="Bundle quantity" min="2" onChange={(event) => updateDraft("bundleTiers", draft.bundleTiers.map((entry, tierIndex) => tierIndex === index ? { ...entry, qty: Number(event.target.value) } : entry))} type="number" value={tier.qty} /><input aria-label="Bundle label" onChange={(event) => updateDraft("bundleTiers", draft.bundleTiers.map((entry, tierIndex) => tierIndex === index ? { ...entry, label: event.target.value } : entry))} value={tier.label} /><input aria-label="Bundle discount percent" max="90" min="0" onChange={(event) => updateDraft("bundleTiers", draft.bundleTiers.map((entry, tierIndex) => tierIndex === index ? { ...entry, discountPercent: Number(event.target.value) } : entry))} type="number" value={tier.discountPercent} /><button aria-label="Remove bundle tier" className="icon-button danger" onClick={() => updateDraft("bundleTiers", draft.bundleTiers.filter((_, tierIndex) => tierIndex !== index))} type="button"><Trash2 size={14} /></button></div>)}<button className="button button-outline" onClick={() => updateDraft("bundleTiers", [...draft.bundleTiers, { qty: 2, label: "Ritual duo", discountPercent: 5 }])} style={{ minHeight: 44 }} type="button"><Plus size={14} /> Add bundle tier</button></div>
            <label className="admin-field"><span>SEO title</span><input maxLength={180} onChange={(event) => updateDraft("seoTitle", event.target.value)} value={draft.seoTitle} /></label>
            <label className="admin-field"><span>SEO description</span><textarea maxLength={500} onChange={(event) => updateDraft("seoDescription", event.target.value)} rows={2} value={draft.seoDescription} /></label>
            <div className="seo-preview"><small>SEARCH PREVIEW</small><strong>{draft.seoTitle || draft.title || "Product title"} | Roam &amp; Nest</strong><span>{draft.seoDescription || draft.description || "Product description preview"}</span></div>
          </section>
          <div className="studio-actions"><button className="button button-outline" onClick={() => setMode("catalog")} style={{ minHeight: 44 }} type="button">Cancel</button><button className="button button-dark" disabled={busy} style={{ minHeight: 44 }} type="submit">{busy ? "Saving…" : draft.id ? "Save Live Changes" : "Save Product Draft"}</button></div>
        </form>
      )}
      {mode === "catalog" && (
        <section className="studio-panel studio-catalog">
          <div className="studio-panel-heading"><div><h3>Live catalog</h3><p>Edit, optimize, clone, and manage your product varieties.</p></div><button className="button button-dark" onClick={() => setMode("link")} style={{ minHeight: 44 }} type="button"><Plus size={15} /> Add Product</button></div>
          <div className="studio-catalog-controls"><input aria-label="Search products" onChange={(event) => setSearch(event.target.value)} placeholder="Search title, slug, category" value={search} /><select aria-label="Filter products" onChange={(event) => setFilter(event.target.value as CatalogFilter)} value={filter}><option value="all">All products</option><option value="live">Live</option><option value="drafts">Drafts</option><option value="featured">Featured</option><option value="low-stock">Low / out of stock</option></select></div>
          <div className="studio-bulk-bar"><label><input checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.includes(product.id))} onChange={(event) => setSelectedIds(event.target.checked ? visibleProducts.map((product) => product.id) : [])} type="checkbox" /> Select visible</label><select aria-label="Bulk action" onChange={(event) => setBulkAction(event.target.value)} value={bulkAction}><option value="activate">Activate</option><option value="deactivate">Deactivate</option><option value="set_category">Set category</option><option value="set_badge">Set badge</option><option value="adjust_price">Adjust retail price (%)</option><option value="delete">Delete</option></select>{["set_category", "set_badge", "adjust_price"].includes(bulkAction) && (bulkAction === "set_category" ? <select aria-label="Bulk category" onChange={(event) => setBulkValue(event.target.value)} value={bulkValue}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select> : <input aria-label={bulkAction === "adjust_price" ? "Price adjustment percent" : "Bulk badge text"} onChange={(event) => setBulkValue(event.target.value)} placeholder={bulkAction === "adjust_price" ? "e.g. 10" : "Badge text"} type={bulkAction === "adjust_price" ? "number" : "text"} value={bulkValue} />)}<button className="button button-outline" disabled={!selectedIds.length || busy} onClick={() => void runBulkAction()} style={{ minHeight: 44 }} type="button">Apply to {selectedIds.length}</button></div>
          {visibleProducts.length === 0 ? <p className="studio-empty">No matching products.</p> : visibleProducts.map((product) => {
            const price = Number(product.price_usd);
            const cost = Number(product.supplier_cost_usd);
            const margin = marginPercent(price, cost);
            return <article className="studio-catalog-row" key={product.id}>
              <input aria-label={`Select ${product.title}`} checked={selectedIds.includes(product.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} type="checkbox" />
              <img alt="" className="studio-catalog-cover" src={product.image_urls[0] ?? ""} />
              <div className="studio-catalog-main"><strong>{product.title}</strong><span>/{product.slug} · {product.category}</span><div className="studio-catalog-swatches">{product.variants.slice(0, 6).map((variant) => <img alt={variant.name} key={variant.id} src={variant.swatchImageUrl} title={variant.name} />)}</div></div>
              <div className="studio-catalog-price"><strong>{money.format(price)}</strong>{product.compare_at_price_usd && <del>{money.format(Number(product.compare_at_price_usd))}</del>}<span className={margin >= 55 ? "margin-pill" : "margin-pill is-low"}>{margin.toFixed(1)}% net</span></div>
              <div className="studio-catalog-actions"><button className="button button-outline" onClick={() => openEditor(product)} style={{ minHeight: 44 }} type="button">Edit Live</button><button aria-label={`AI optimize ${product.title}`} className="icon-button" disabled={busy} onClick={() => void runOptimize(product)} type="button"><Sparkles size={15} /></button><button aria-label={`Clone ${product.title}`} className="icon-button" disabled={busy} onClick={() => void cloneProduct(product)} type="button"><Copy size={15} /></button><button className="button button-outline" onClick={() => void toggleActive(product)} style={{ minHeight: 44 }} type="button">{product.active ? "Live" : "Draft"}</button><button aria-label={`Delete ${product.title}`} className="icon-button danger" onClick={() => void deleteProduct(product)} type="button"><Trash2 size={15} /></button></div>
            </article>;
          })}
        </section>
      )}
    </section>
  );
}
