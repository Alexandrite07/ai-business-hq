"use client";

import { FUNDING, PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { ArrowLeft, Check, CreditCard, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CheckoutProduct = {
  id: string;
  slug: string;
  title: string;
  price_usd: number;
  benefits: string[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function ProductPurchase({ product }: { product: CheckoutProduct }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [checkoutError, setCheckoutError] = useState("");
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();

  async function createOrder() {
    setCheckoutError("");
    const response = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, quantity }),
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
      body: JSON.stringify({ orderID, productId: product.id, quantity }),
    });
    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };
    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Could not confirm your payment.");
    }
    router.push(`/thank-you?orderId=${encodeURIComponent(orderID)}`);
  }

  async function handleCreateOrder() {
    try {
      return await createOrder();
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not start checkout.",
      );
      throw error;
    }
  }

  async function handleApprove(data: { orderID: string }) {
    try {
      await captureOrder(data.orderID);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not confirm your payment.",
      );
    }
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
      <span className="eyebrow">THE SUNDAY FAVORITE</span>
      <div aria-label="Rated 4.9 out of 5" className="detail-rating">
        <span>★★★★★</span> 4.9 · loved by our community
      </div>
      <h1>{product.title}</h1>
      <p className="product-description">
        Wake up to soft, defined curls with a comfortable, no-heat styling ritual.
        Wrap, rest, and reveal a polished look without turning on your hot tools.
      </p>
      <div className="detail-price-row">
        <strong>{currency.format(product.price_usd)}</strong>
        <span>Free US shipping</span>
      </div>
      <div className="detail-benefits">
        {product.benefits.map((benefit) => (
          <div className="benefit-row" key={benefit}>
            <span className="benefit-check">
              <Check aria-hidden="true" size={13} strokeWidth={2.2} />
            </span>
            <span>{benefit}</span>
          </div>
        ))}
      </div>
      <div className="quantity-row">
        <span>Quantity</span>
        <div aria-label="Quantity" className="quantity-control">
          <button
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            type="button"
          >
            <Minus aria-hidden="true" size={14} />
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            aria-label="Increase quantity"
            disabled={quantity >= 10}
            onClick={() => setQuantity((value) => Math.min(10, value + 1))}
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
          2–3 business days processing + 5–10 business days US delivery.
        </span>
      </div>
      <div className="paypal-checkout">
        {paypalClientId ? (
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
              forceReRender={[product.id, quantity]}
              style={{ layout: "vertical", shape: "rect", label: "paypal", tagline: false }}
              createOrder={handleCreateOrder}
              onApprove={handleApprove}
              onError={handlePayPalError}
            />
            <PayPalButtons
              fundingSource={FUNDING.CARD}
              forceReRender={[product.id, quantity]}
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
          <p aria-live="assertive" className="checkout-error" role="alert">
            {checkoutError}
          </p>
        )}
      </div>
      <div className="secure-note">
        <ShieldCheck aria-hidden="true" size={15} />
        Secure checkout · 30-day money-back guarantee
      </div>
      <p className="fine-print">
        By placing an order, you agree to our <Link href="/shipping-policy">shipping</Link> and{" "}
        <Link href="/refund-policy">refund policies</Link>.
      </p>
    </div>
  );
}
