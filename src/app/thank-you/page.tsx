import { Suspense } from "react";
import { Check, Mail, PackageCheck, Sparkles } from "lucide-react";
import Link from "next/link";

type ConfirmationProps = {
  searchParams: Promise<{ orderId?: string | string[] }>;
};

async function Confirmation({ searchParams }: ConfirmationProps) {
  const params = await searchParams;
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

  return (
    <section className="confirmation-page">
      <div aria-hidden="true" className="confirmation-sparkle">
        <Sparkles size={22} />
      </div>
      <span className="confirmation-check">
        <Check aria-hidden="true" size={25} strokeWidth={1.7} />
      </span>
      <span className="eyebrow">A LITTLE JOY IS ON ITS WAY</span>
      <h1>Thank you for making room for a new ritual.</h1>
      <p className="confirmation-lede">
        Your order is confirmed. We’re getting everything ready for its trip to you.
      </p>
      {orderId && (
        <div className="order-reference">
          <span>PayPal order reference</span>
          <strong>{orderId}</strong>
        </div>
      )}
      <div className="confirmation-timeline">
        <PackageCheck aria-hidden="true" size={21} />
        <span>
          <strong>Here’s what happens next</strong>
          2–3 business days processing, then 5–10 business days for US delivery. Keep an
          eye on your inbox for tracking details.
        </span>
      </div>
      <p className="confirmation-support">
        <Mail aria-hidden="true" size={15} />
        Questions? <a href="mailto:support@roamandnest.com">support@roamandnest.com</a>
      </p>
      <Link className="button button-dark" href="/">
        Back to Roam & Nest
      </Link>
    </section>
  );
}

export default function ThankYouPage(props: ConfirmationProps) {
  return (
    <Suspense fallback={<div className="storefront-loading">Preparing your confirmation…</div>}>
      <Confirmation {...props} />
    </Suspense>
  );
}
