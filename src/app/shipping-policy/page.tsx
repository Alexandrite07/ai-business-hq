import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";

export const metadata: Metadata = { title: "Shipping policy" };

export default function ShippingPolicyPage() {
  return (
    <article className="policy-page">
      <Link className="back-link" href="/">
        <ArrowLeft aria-hidden="true" size={14} /> Back to Sunday Rituals
      </Link>
      <span className="policy-icon">
        <Truck aria-hidden="true" size={20} />
      </span>
      <span className="eyebrow">THE DETAILS, MADE SIMPLE</span>
      <h1>Shipping policy</h1>
      <p className="policy-updated">Last updated: November 15, 2026</p>
      <p>
        We currently ship to addresses in the United States. Standard US shipping is free
        on every order.
      </p>
      <h2>Processing and delivery</h2>
      <p>
        Please allow 2–3 business days for order processing. After dispatch, delivery
        typically takes 5–10 business days. These are estimates, not guaranteed delivery
        dates; carrier delays, weather, and peak seasons may affect transit times.
      </p>
      <h2>Tracking and delivery details</h2>
      <p>
        When available, tracking information is sent to the email address provided at
        checkout once your order ships. Please check that your shipping address is
        complete and accurate before placing your order. Contact{" "}
        <a href="mailto:support@sundayrituals.com">support@sundayrituals.com</a> if you
        have a question about a shipment.
      </p>
      <h2>Shipping address</h2>
      <p>
        We can’t guarantee an address change after an order has been submitted. If you
        notice a mistake, contact us as soon as possible and we’ll do our best to help.
      </p>
      <div className="policy-callout">
        Need a hand? Email{" "}
        <a href="mailto:support@sundayrituals.com">support@sundayrituals.com</a>.
      </div>
    </article>
  );
}
