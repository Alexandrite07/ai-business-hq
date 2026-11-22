import Link from "next/link";
import { ArrowUpRight, Mail, Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link aria-label="Roam & Nest home" className="brand-mark" href="/">
            <span className="brand-icon">
              <Sparkles aria-hidden="true" size={18} strokeWidth={1.6} />
            </span>
            <span>
              <strong>Roam & Nest</strong>
              <small>thoughtful gear for life at home and on the move</small>
            </span>
          </Link>
          <p>Thoughtful comfort at home, and easier adventures wherever life leads.</p>
        </div>
        <div className="footer-column">
          <strong>Here to help</strong>
          <a href="mailto:support@roamandnest.com">Contact support</a>
          <Link href="/shipping-policy">Shipping policy</Link>
          <Link href="/refund-policy">Refund policy</Link>
        </div>
        <div className="footer-column">
          <strong>Explore Roam & Nest</strong>
          <Link href="/#shop">Shop bestsellers</Link>
          <Link href="/#our-promise">Our promise</Link>
          <a href="mailto:support@roamandnest.com">
            Get in touch <ArrowUpRight aria-hidden="true" size={13} />
          </a>
        </div>
        <a
          aria-label="Email Roam & Nest"
          className="footer-social"
          href="mailto:support@roamandnest.com"
        >
          <Mail aria-hidden="true" size={17} />
        </a>
      </div>
      <div className="footer-bottom">
        <span>© Roam & Nest. Made for everyday life.</span>
        <span>Thoughtful gear, delivered with care.</span>
      </div>
    </footer>
  );
}
