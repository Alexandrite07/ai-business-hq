"use client";

/* eslint-disable @next/next/no-img-element -- Variety images are stored on a customer-configured Supabase host. */

import { FUNDING, PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BundleTier, ProductVariant } from "@/lib/products";

type CheckoutProduct = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  price_usd: number;
  compare_at_price_usd: number | null;
  benefits: string[];
  variants: ProductVariant[];
  bundle_tiers: BundleTier[];
  how_to_use: string[];
  materials_and_care: string | null;
  shipping_estimate: string;
  stock_status: string;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function ProductPurchase({
  product,
  selectedVariantId,
  onVariantChange,
}: {
  product: CheckoutProduct;
  selectedVariantId: string | null;
  onVariantChange: (variantId: string | null) => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [bundleQty, setBundleQty] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const selectedBundle = product.bundle_tiers.find((tier) => tier.qty === bundleQty);
  const soldOut =
    product.stock_status === "out_of_stock" || selectedVariant?.inStock === false;
  const basePriceCents = Math.round(
    (selectedVariant?.retailPriceUsd ?? product.price_usd) * 100,
  );
  const unitPriceCents = selectedBundle
    ? Math.round((basePriceCents * (10_000 - Math.round(selectedBundle.discountPercent * 100))) / 10_000)
    : basePriceCents;
  const compareAtPrice =
    selectedVariant?.compareAtPriceUsd ?? product.compare_at_price_usd;
  const savingsPercent =
    compareAtPrice && compareAtPrice > unitPriceCents / 100
      ? Math.round((1 - unitPriceCents / 100 / compareAtPrice) * 100)
      : 0;

  async function createOrder() {
    setCheckoutError("");
    const response = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        quantity,
        ...(selectedVariantId ? { variantId: selectedVariantId } : {}),
        ...(bundleQty ? { bundleQty } : {}),
      }),
    });
    const result = (await response.json()) as { orderID?: string; error?: string };
    if (!response.ok || !result.orderID) {
      throw new Error(result.error ?? "Could not start checkout.");
    }
    return result.orderID;
  }

  async function captureOrder(orderID: string) {
    const response = await fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderID,
        productId: product.id,
        quantity,
        ...(selectedVariantId ? { variantId: selectedVariantId } : {}),
        ...(bundleQty ? { bundleQty } : {}),
      }),
    });
    const result = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Could not confirm your payment.");
    }
    router.push(`/thank-you?orderId=${encodeURIComponent(orderID)}`);
  }

  async function handleCreateOrder() {
    try {
      return await createOrder();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout.");
      throw error;
    }
  }

  async function handleApprove(data: { orderID: string }) {
    try {
      await captureOrder(data.orderID);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not confirm your payment.");
    }
  }

  function changeQuantity(nextQuantity: number) {
    setQuantity(Math.max(1, Math.min(20, nextQuantity)));
    setBundleQty(null);
  }

  function selectBundle(tier: BundleTier) {
    setBundleQty(tier.qty);
    setQuantity(tier.qty);
  }

  function handlePayPalError(error: unknown) {
    console.error("PayPal checkout error:", error);
    setCheckoutError("PayPal checkout could not be completed. Please try again.");
  }

  return (
    <div className="product-purchase">
      <Link className="back-link" href="/#shop">
        <ArrowLeft aria-hidden="true" size={14} /> Back to the collection
      </Link>
      <span className="eyebrow">{product.subtitle ?? "A ROAM &amp; NEST FAVORITE"}</span>
      <div aria-label="Rated 4.9 out of 5" className="detail-rating">
        <span>★★★★★</span> 4.9 · loved by our community
      </div>
      <h1>{product.title}</h1>
      <p className="product-description">{product.description}</p>
      {product.variants.length > 0 && (
        <fieldset className="product-variety-picker">
          <legend>{product.variants[0]?.optionLabel ?? "Choose a style"}</legend>
          <div className="product-variety-grid">
            {product.variants.map((variant) => (
              <button
                aria-pressed={selectedVariantId === variant.id}
                className={`product-variety-card ${selectedVariantId === variant.id ? "is-selected" : ""}`}
                disabled={!variant.inStock}
                key={variant.id}
                onClick={() => onVariantChange(variant.id)}
                style={{ minHeight: 72 }}
                type="button"
              >
                <img alt="" loading="lazy" src={variant.swatchImageUrl} />
                <span>{variant.name}</span>
                <strong>
                  {currency.format(variant.retailPriceUsd ?? product.price_usd)}
                </strong>
                {!variant.inStock && <small>Sold Out</small>}
              </button>
            ))}
          </div>
          {selectedVariant?.sku && <small className="selected-variant-sku">SKU: {selectedVariant.sku}</small>}
        </fieldset>
      )}
      <div className="detail-price-row">
        <strong>{currency.format(unitPriceCents / 100)}</strong>
        {compareAtPrice && compareAtPrice > unitPriceCents / 100 && (
          <>
            <del>{currency.format(compareAtPrice)}</del>
            {savingsPercent > 0 && <span className="savings-pill">Save {savingsPercent}%</span>}
          </>
        )}
        {selectedBundle && <span>{selectedBundle.label} bundle savings</span>}
      </div>
      <div className="detail-benefits">
        {product.benefits.map((benefit) => (
          <div className="benefit-row" key={benefit}>
            <span className="benefit-check"><Check aria-hidden="true" size={13} strokeWidth={2.2} /></span>
            <span>{benefit}</span>
          </div>
        ))}
      </div>
      {product.bundle_tiers.length > 0 && (
        <fieldset className="bundle-picker">
          <legend>Bundle & save</legend>
          <div>
            {product.bundle_tiers.map((tier) => (
              <button
                aria-pressed={bundleQty === tier.qty}
                className={`bundle-tier-button ${bundleQty === tier.qty ? "is-selected" : ""}`}
                key={tier.qty}
                onClick={() => selectBundle(tier)}
                style={{ minHeight: 44 }}
                type="button"
              >
                {tier.label} · Save {tier.discountPercent}%
              </button>
            ))}
            {bundleQty !== null && (
              <button
                className="bundle-tier-button"
                onClick={() => {
                  setBundleQty(null);
                  setQuantity(1);
                }}
                style={{ minHeight: 44 }}
                type="button"
              >
                Single item
              </button>
            )}
          </div>
        </fieldset>
      )}
      <div className="quantity-row">
        <span>Quantity</span>
        <div aria-label="Quantity" className="quantity-control">
          <button
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || bundleQty !== null}
            onClick={() => changeQuantity(quantity - 1)}
            type="button"
          >
            <Minus aria-hidden="true" size={14} />
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            aria-label="Increase quantity"
            disabled={quantity >= 20 || bundleQty !== null}
            onClick={() => changeQuantity(quantity + 1)}
            type="button"
          >
            <Plus aria-hidden="true" size={14} />
          </button>
        </div>
      </div>
      <div className="delivery-note">
        <Truck aria-hidden="true" size={18} />
        <span>
          <strong>A little patience, a lot of good hair days.</strong>
          {product.shipping_estimate}
        </span>
      </div>
      <div className="paypal-checkout">
        {soldOut ? (
          <p className="checkout-unavailable" role="status">Variety Sold Out</p>
        ) : product.variants.length > 0 && !selectedVariant ? (
          <p className="checkout-unavailable" role="status">Choose a variety to continue to checkout.</p>
        ) : paypalClientId ? (
          <PayPalScriptProvider
            options={{
              clientId: paypalClientId,
              currency: "USD",
              intent: "capture",
              components: "buttons",
              enableFunding: "card",
            }}
          >
            <PayPalButtons
              fundingSource={FUNDING.PAYPAL}
              forceReRender={[product.id, selectedVariantId, quantity, bundleQty, unitPriceCents]}
              style={{ layout: "vertical", shape: "rect", label: "paypal", tagline: false }}
              createOrder={handleCreateOrder}
              onApprove={handleApprove}
              onError={handlePayPalError}
            />
            <PayPalButtons
              fundingSource={FUNDING.CARD}
              forceReRender={[product.id, selectedVariantId, quantity, bundleQty, unitPriceCents]}
              style={{ layout: "vertical", shape: "rect", label: "pay", tagline: false }}
              createOrder={handleCreateOrder}
              onApprove={handleApprove}
              onError={handlePayPalError}
            />
            <div className="card-checkout-note">
              <CreditCard aria-hidden="true" size={15} />
              <span>PayPal or guest card checkout, securely processed by PayPal.</span>
            </div>
          </PayPalScriptProvider>
        ) : (
          <div className="checkout-unavailable">
            <ShieldCheck aria-hidden="true" size={19} />
            <span>
              Checkout is getting ready. Add your PayPal client ID to <code>.env.local</code> to
              enable secure payment.
            </span>
          </div>
        )}
        {checkoutError && (
          <p aria-live="assertive" className="checkout-error" role="alert">{checkoutError}</p>
        )}
      </div>
      <div className="secure-note">
        <ShieldCheck aria-hidden="true" size={15} />
        Secure checkout · 30-day money-back guarantee
      </div>
      {product.how_to_use.length > 0 && (
        <details className="product-extra-details">
          <summary>How to Use</summary>
          <ol>{product.how_to_use.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>
        </details>
      )}
      {product.materials_and_care && (
        <details className="product-extra-details">
          <summary>Materials & Care</summary>
          <p>{product.materials_and_care}</p>
        </details>
      )}
      <p className="fine-print">
        By placing an order, you agree to our <Link href="/shipping-policy">shipping</Link> and{" "}
        <Link href="/refund-policy">refund policies</Link>.
      </p>
    </div>
  );
}
