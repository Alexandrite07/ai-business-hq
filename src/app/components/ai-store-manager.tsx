"use client";

/* eslint-disable @next/next/no-img-element -- Supplier image hosts are dynamic and previews load directly in the admin UI. */

import { Clipboard, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type StoreMetrics = {
  revenueUsd: number;
  supplierCostsUsd: number;
  estimatedPaypalFeesUsd: number;
  netProfitUsd: number;
  unfulfilledOrdersOver24Hours: number;
};

type ProductDraft = {
  title: string;
  slug: string;
  description: string;
  benefits: string[];
  recommendedPriceUsd: number;
  estimatedPaypalFeeUsd: number;
  estimatedNetProfitUsd: number;
};

type ProductRequest = {
  rawTitle: string;
  rawSpecs: string;
  supplierCostUsd: number;
  imageUrls: string[];
  cjSku: string;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type BriefResponse = { metrics: StoreMetrics; bullets: string[] };
let briefRequest: Promise<BriefResponse> | null = null;

async function responseJson<T>(response: Response): Promise<T & { error?: string }> {
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

function fetchBrief(): Promise<BriefResponse> {
  if (!briefRequest) {
    const pending = fetch("/api/admin/ai/ops-brief", { cache: "no-store" })
      .then((response) => responseJson<BriefResponse>(response))
      .finally(() => {
        if (briefRequest === pending) briefRequest = null;
      });
    briefRequest = pending;
  }
  return briefRequest;
}

export function AIStoreManager({
  onProductPublished,
}: {
  onProductPublished?: () => void;
} = {}) {
  const [mounted, setMounted] = useState(false);
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [briefError, setBriefError] = useState("");
  const [briefLoading, setBriefLoading] = useState(true);

  useEffect(() => {
    // Keep browser autofill scripts from seeing these forms before hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const refreshBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError("");
    try {
      const result = await fetchBrief();
      setMetrics(result.metrics);
      setBullets(result.bullets);
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : "Could not refresh the brief.");
    } finally {
      setBriefLoading(false);
    }
  }, []);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetchBrief()
      .then((result) => {
        if (active) {
          setMetrics(result.metrics);
          setBullets(result.bullets);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setBriefError(error instanceof Error ? error.message : "Could not load the brief.");
        }
      })
      .finally(() => {
        if (active) setBriefLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="ai-manager-title" className="ai-manager">
      <div className="ai-manager-header">
        <div>
          <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> AI-POWERED OPERATIONS</span>
          <h2 id="ai-manager-title">AI Store Manager</h2>
        </div>
      </div>
      {mounted && <AIURLProductImporter onPublished={() => {
        router.refresh();
        void refreshBrief();
        onProductPublished?.();
      }} />}
      <section aria-labelledby="ai-brief-title" className="ai-manager-brief">
        <div className="ai-manager-section-heading">
          <div>
            <h3 id="ai-brief-title">Today’s executive brief</h3>
            <p>Live store economics and three practical priorities.</p>
          </div>
          <button
            className="admin-refresh"
            disabled={briefLoading}
            onClick={() => void refreshBrief()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} /> {briefLoading ? "Refreshing…" : "Refresh Brief"}
          </button>
        </div>
        {metrics && (
          <div className="ai-metrics">
            <div><small>Revenue</small><strong>{money.format(metrics.revenueUsd)}</strong></div>
            <div><small>Supplier costs</small><strong>{money.format(metrics.supplierCostsUsd)}</strong></div>
            <div><small>Est. PayPal fees</small><strong>{money.format(metrics.estimatedPaypalFeesUsd)}</strong></div>
            <div><small>Net profit</small><strong>{money.format(metrics.netProfitUsd)}</strong></div>
          </div>
        )}
        {briefError ? (
          <p aria-live="polite" className="admin-form-error" role="alert">{briefError}</p>
        ) : bullets.length > 0 ? (
          <ol className="ai-brief-list">
            {bullets.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)}
          </ol>
        ) : briefLoading ? (
          <p className="ai-manager-hint">Preparing your brief…</p>
        ) : null}
        {metrics && (
          <p className="ai-manager-hint">
            Orders awaiting fulfillment for over 24 hours: {metrics.unfulfilledOrdersOver24Hours}
          </p>
        )}
      </section>
      {mounted && (
        <div className="ai-manager-tools">
          <AIProductLauncher />
          <AISupportDrafter />
        </div>
      )}
    </section>
  );
}

type ImportedProduct = {
  title: string;
  slug: string;
  description: string;
  benefits: string[];
  cjSku: string;
  selectedImageUrls: string[];
};

type ImportPricing = {
  detectedBaseCostUsd: number;
  totalSupplierCostUsd: number;
  recommendedPriceUsd: number;
  estimatedPaypalFeeUsd: number;
  estimatedNetProfitUsd: number;
  netMarginPercent: number;
};

type ImportResponse = {
  success: boolean;
  published: boolean;
  product: ImportedProduct;
  pricingBreakdown: ImportPricing;
  extractionMethod: string;
  draftToken?: string;
  error?: string;
  code?: string;
};

function AIURLProductImporter({ onPublished }: { onPublished: () => void }) {
  const [url, setUrl] = useState("");
  const [supplierCost, setSupplierCost] = useState("");
  const [fallbackRawText, setFallbackRawText] = useState("");
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [workingAction, setWorkingAction] = useState<"publish" | "preview" | "finalize" | null>(null);
  const [error, setError] = useState("");
  const [publishedProduct, setPublishedProduct] = useState<ImportedProduct | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function sendImport(payload: Record<string, unknown>): Promise<ImportResponse> {
    const response = await fetch("/api/admin/ai/import-from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as ImportResponse;
    if (!response.ok) {
      if (result.code === "EXTRACTION_BLOCKED") setFallbackOpen(true);
      throw new Error(result.error ?? "Could not import this product.");
    }
    return result;
  }

  async function importProduct(autoPublish: boolean) {
    setError("");
    setPreview(null);
    setPublishedProduct(null);
    setWorkingAction(autoPublish ? "publish" : "preview");
    try {
      const result = await sendImport({
        url: url.trim(),
        ...(supplierCost.trim() ? { supplierCostOverrideUsd: Number(supplierCost) } : {}),
        autoPublish,
        ...(fallbackRawText.trim() ? { fallbackRawText: fallbackRawText.trim() } : {}),
      });
      if (result.published) {
        setPublishedProduct(result.product);
        onPublished();
      } else {
        setPreview(result);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not import this product.");
    } finally {
      setWorkingAction(null);
    }
  }

  async function publishPreview() {
    if (!preview?.draftToken) return;
    setError("");
    setWorkingAction("finalize");
    try {
      const result = await sendImport({ autoPublish: true, draftToken: preview.draftToken });
      setPreview(null);
      setPublishedProduct(result.product);
      onPublished();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not publish this product.");
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <section aria-labelledby="ai-url-importer-title" className="ai-url-importer">
      <div className="ai-url-importer-heading">
        <div>
          <span className="eyebrow">ONE LINK, READY FOR YOUR STOREFRONT</span>
          <h3 id="ai-url-importer-title">1-Link AI Product Importer</h3>
          <p>Paste a supplier listing to extract product details, write polished copy, and price for your margin.</p>
        </div>
      </div>
      <form
        autoComplete="off"
        className="ai-url-importer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void importProduct(true);
        }}
        ref={formRef}
      >
        <label className="admin-field ai-field-wide">
          <span>Supplier product URL</span>
          <input
            autoCapitalize="none"
            autoComplete="url"
            className="ai-url-input"
            onChange={(event) => {
              setUrl(event.target.value);
              setPublishedProduct(null);
              setPreview(null);
            }}
            placeholder="Paste CJdropshipping or supplier product link..."
            required
            type="url"
            value={url}
          />
        </label>
        <div className="ai-url-importer-secondary">
          <label className="admin-field">
            <span>Exact US-Shipped Cost ($)</span>
            <input
              min="0.01"
              onChange={(event) => setSupplierCost(event.target.value)}
              placeholder="Auto-detect + $3.50 US shipping"
              step="0.01"
              type="number"
              value={supplierCost}
            />
          </label>
          <div className="ai-url-importer-actions">
            <button
              className="button button-dark"
              disabled={workingAction !== null}
              onClick={() => {
                if (formRef.current?.reportValidity()) void importProduct(true);
              }}
              type="button"
            >
              {workingAction === "publish" ? (
                <><LoaderCircle aria-hidden="true" className="is-spinning" size={15} /> Importing…</>
              ) : (
                "Import & Publish Live"
              )}
            </button>
            <button
              className="button button-outline"
              disabled={workingAction !== null}
              onClick={() => {
                if (formRef.current?.reportValidity()) void importProduct(false);
              }}
              type="button"
            >
              {workingAction === "preview" ? (
                <><LoaderCircle aria-hidden="true" className="is-spinning" size={15} /> Preparing…</>
              ) : (
                "Preview First"
              )}
            </button>
          </div>
        </div>
      </form>
      <details
        className="ai-url-fallback"
        onToggle={(event) => setFallbackOpen(event.currentTarget.open)}
        open={fallbackOpen}
      >
        <summary>Having trouble with a link? Paste page text fallback</summary>
        <label className="admin-field">
          <span>Product page text</span>
          <textarea
            maxLength={48_000}
            onChange={(event) => setFallbackRawText(event.target.value)}
            placeholder="Paste the product name, description, price, specifications, and image links..."
            rows={5}
            value={fallbackRawText}
          />
        </label>
      </details>
      {preview && (
        <div className="ai-url-preview">
          <span className="eyebrow">REVIEW BEFORE PUBLISHING</span>
          <h4>{preview.product.title}</h4>
          <p>{preview.product.description}</p>
          <ul>{preview.product.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
          <div className="ai-url-preview-images">
            {preview.product.selectedImageUrls.map((image) => (
              <img alt={preview.product.title} key={image} loading="lazy" src={image} />
            ))}
          </div>
          <dl className="ai-url-pricing">
            <div><dt>Retail price</dt><dd>{money.format(preview.pricingBreakdown.recommendedPriceUsd)}</dd></div>
            <div><dt>Supplier cost</dt><dd>{money.format(preview.pricingBreakdown.totalSupplierCostUsd)}</dd></div>
            <div><dt>Est. PayPal fee</dt><dd>{money.format(preview.pricingBreakdown.estimatedPaypalFeeUsd)}</dd></div>
            <div><dt>Est. net profit</dt><dd>{money.format(preview.pricingBreakdown.estimatedNetProfitUsd)}</dd></div>
          </dl>
          <button
            className="button button-dark"
            disabled={workingAction !== null}
            onClick={() => void publishPreview()}
            type="button"
          >
            {workingAction === "finalize" ? (
              <><LoaderCircle aria-hidden="true" className="is-spinning" size={15} /> Publishing…</>
            ) : (
              "Publish Now"
            )}
          </button>
        </div>
      )}
      {publishedProduct && (
        <p aria-live="polite" className="ai-success ai-url-published" role="status">
          “{publishedProduct.title}” is live.{" "}
          <a href={`/products/${encodeURIComponent(publishedProduct.slug)}`}>
            View Live Product Page →
          </a>
        </p>
      )}
      {error && <p aria-live="assertive" className="admin-form-error" role="alert">{error}</p>}
    </section>
  );
}

function AIProductLauncher() {
  const [rawTitle, setRawTitle] = useState("");
  const [rawSpecs, setRawSpecs] = useState("");
  const [supplierCostUsd, setSupplierCostUsd] = useState("");
  const [cjSku, setCjSku] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftToken, setDraftToken] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function getRequest(): ProductRequest {
    return {
      rawTitle,
      rawSpecs,
      supplierCostUsd: Number(supplierCostUsd),
      cjSku,
      imageUrls: imageUrls.split(/[,\r\n]+/).map((url) => url.trim()).filter(Boolean),
    };
  }

  async function submitProduct(publish: boolean) {
    setWorking(true);
    setError("");
    setMessage("");
    setDraft(null);
    setDraftToken("");
    try {
      const payload = getRequest();
      const response = await fetch("/api/admin/ai/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, autoPublish: publish }),
      });
      const result = await responseJson<{
        product: ProductDraft;
        draftToken?: string;
        createdProduct?: { id: string; slug: string };
      }>(response);
      setDraft(result.product);
      setDraftToken(result.draftToken ?? "");
      setMessage(
        result.createdProduct
          ? `Published “${result.product.title}” to the storefront.`
          : "Draft ready. Review it below, then publish when you’re happy.",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not generate this product.");
    } finally {
      setWorking(false);
    }
  }

  async function publishDraft() {
    if (!draft || !draftToken) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/ai/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPublish: true, draftToken }),
      });
      const result = await responseJson<{ product: ProductDraft; createdProduct?: { slug: string } }>(
        response,
      );
      setDraft(result.product);
      setDraftToken("");
      setMessage(`Published “${result.product.title}” to the storefront.`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not publish this product.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section aria-labelledby="ai-product-title" className="ai-tool-card">
      <h3 id="ai-product-title">1-Click AI Product Launcher</h3>
      <p>Turn a CJ supplier listing into a polished, priced product—without unsupported claims.</p>
      <form
        autoComplete="off"
        className="ai-tool-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitProduct(true);
        }}
        ref={formRef}
      >
        <label className="admin-field">
          <span>Raw CJ product title</span>
          <input maxLength={500} onChange={(event) => { setDraft(null); setDraftToken(""); setRawTitle(event.target.value); }} required value={rawTitle} />
        </label>
        <label className="admin-field">
          <span>Supplier cost (USD)</span>
          <input
            min="0"
            onChange={(event) => { setDraft(null); setDraftToken(""); setSupplierCostUsd(event.target.value); }}
            required
            step="0.01"
            type="number"
            value={supplierCostUsd}
          />
        </label>
        <label className="admin-field">
          <span>CJ SKU</span>
          <input maxLength={100} onChange={(event) => { setDraft(null); setDraftToken(""); setCjSku(event.target.value); }} value={cjSku} />
        </label>
        <label className="admin-field ai-field-wide">
          <span>Supplier specs <small>(optional)</small></span>
          <textarea maxLength={5000} onChange={(event) => { setDraft(null); setDraftToken(""); setRawSpecs(event.target.value); }} rows={3} value={rawSpecs} />
        </label>
        <label className="admin-field ai-field-wide">
          <span>Image URLs <small>(comma or newline separated; optional fallback image)</small></span>
          <textarea
            onChange={(event) => { setDraft(null); setDraftToken(""); setImageUrls(event.target.value); }}
            placeholder="https://..."
            rows={2}
            value={imageUrls}
          />
        </label>
        <div className="ai-product-actions">
          <button
            className="button button-outline"
            disabled={working}
            onClick={() => {
              if (formRef.current?.reportValidity()) void submitProduct(false);
            }}
            type="button"
          >
            {working ? "Working…" : "Preview with AI"}
          </button>
          <button className="button button-dark" disabled={working} type="submit">
            {working ? "Working…" : "Generate & Publish with AI"}
          </button>
        </div>
      </form>
      {draft && (
        <div className="ai-product-preview">
          <span className="eyebrow">PRODUCT PREVIEW</span>
          <h4>{draft.title}</h4>
          <p>{draft.description}</p>
          <ul>{draft.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
          <p className="ai-product-price">
            {money.format(draft.recommendedPriceUsd)} · est. {money.format(draft.estimatedNetProfitUsd)} net
          </p>
          {draftToken && (
            <button className="button button-dark" disabled={working} onClick={() => void publishDraft()} type="button">
              {working ? "Publishing…" : "Publish this draft"}
            </button>
          )}
        </div>
      )}
      {message && <p aria-live="polite" className="ai-success" role="status">{message}</p>}
      {error && <p aria-live="assertive" className="admin-form-error" role="alert">{error}</p>}
    </section>
  );
}

function AISupportDrafter() {
  const [customerMessage, setCustomerMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [draft, setDraft] = useState<{ subject: string; reply: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/admin/ai/support-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerMessage, ...(orderId.trim() ? { orderId: orderId.trim() } : {}) }),
      });
      const result = await responseJson<{ draft: { subject: string; reply: string } }>(response);
      setDraft(result.draft);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not draft a support reply.");
    } finally {
      setWorking(false);
    }
  }

  async function copyReply() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.reply}`);
      setCopied(true);
    } catch {
      setError("Clipboard access was denied. Copy the reply manually.");
    }
  }

  return (
    <section aria-labelledby="ai-support-title" className="ai-tool-card">
      <h3 id="ai-support-title">AI Customer Support Drafter</h3>
      <p>Prepare a kind, policy-grounded response for your customer.</p>
      <form
        autoComplete="off"
        className="ai-tool-form ai-support-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label className="admin-field">
          <span>Customer question</span>
          <textarea
            maxLength={5000}
            onChange={(event) => setCustomerMessage(event.target.value)}
            required
            rows={5}
            value={customerMessage}
          />
        </label>
        <label className="admin-field">
          <span>Order ID <small>(optional)</small></span>
          <input onChange={(event) => setOrderId(event.target.value)} value={orderId} />
        </label>
        <button className="button button-dark" disabled={working} type="submit">
          {working ? "Drafting…" : "Draft Reply"}
        </button>
      </form>
      {draft && (
        <div className="ai-reply-preview">
          <div className="ai-reply-heading">
            <strong>{draft.subject}</strong>
            <button aria-label="Copy reply" className="copy-address-button" onClick={() => void copyReply()} type="button">
              <Clipboard aria-hidden="true" size={14} /> {copied ? "Copied" : "Copy Reply"}
            </button>
          </div>
          <p>{draft.reply}</p>
        </div>
      )}
      {error && <p aria-live="assertive" className="admin-form-error" role="alert">{error}</p>}
    </section>
  );
}
