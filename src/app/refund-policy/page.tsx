import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, HeartHandshake } from "lucide-react";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  return (
    <article className="policy-page">
      <Link className="back-link" href="/">
        <ArrowLeft aria-hidden="true" size={14} /> Back to Sunday Rituals
      </Link>
      <span className="policy-icon">
        <HeartHandshake aria-hidden="true" size={20} />
      </span>
      <span className="eyebrow">WE WANT YOU TO FEEL GOOD ABOUT IT</span>
      <h1>30-day refund policy</h1>
      <p className="policy-updated">Last updated: November 15, 2026</p>
      <p>
        We want your Sunday Rituals order to feel right for you. If it doesn’t, contact us
        within 30 days of delivery and we’ll help with the return and refund process.
      </p>
      <h2>How to request help</h2>
      <p>
        Email{" "}
        <a href="mailto:support@sundayrituals.com">support@sundayrituals.com</a> with
        your order reference and a short description of the issue. We’ll reply with the
        next steps and any return instructions. Please contact us before sending anything
        back.
      </p>
      <h2>Refunds</h2>
      <p>
        Once an approved return is received or otherwise resolved with our support team,
        eligible refunds are issued to the original payment method. Your bank or payment
        provider may take additional time to post the credit. Original shipping charges,
        if any, are handled as required by applicable law and the circumstances of the
        order.
      </p>
      <h2>Damaged or incorrect items</h2>
      <p>
        If your order arrives damaged or you received the wrong item, contact us promptly
        with your order reference and photos so we can review and make it right.
      </p>
      <div className="policy-callout">
        We’re here to help:{" "}
        <a href="mailto:support@sundayrituals.com">support@sundayrituals.com</a>.
      </div>
    </article>
  );
}
