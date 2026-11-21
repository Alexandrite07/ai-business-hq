import Link from "next/link";
import { ArrowUpRight, Mail, Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link aria-label="Sunday Rituals home" className="brand-mark" href="/">
            <span className="brand-icon">
              <Sparkles aria-hidden="true" size={18} strokeWidth={1.6} />
            </span>
            <span>
              <strong>Sunday Rituals</strong>
              <small>beauty, made softer</small>
            </span>
          </Link>
          <p>Small rituals. Softer mornings. A little more you, every day.</p>
        </div>
        <div className="footer-column">
          <strong>Here to help</strong>
          <a href="mailto:support@sundayrituals.com">Contact support</a>
          <Link href="/shipping-policy">Shipping policy</Link>
          <Link href="/refund-policy">Refund policy</Link>
        </div>
        <div className="footer-column">
          <strong>Find your ritual</strong>
          <Link href="/#shop">Shop bestsellers</Link>
          <Link href="/#our-promise">Our promise</Link>
          <a href="mailto:support@sundayrituals.com">
            Get in touch <ArrowUpRight aria-hidden="true" size={13} />
          </a>
        </div>
        <a
          aria-label="Email Sunday Rituals"
          className="footer-social"
          href="mailto:support@sundayrituals.com"
        >
          <Mail aria-hidden="true" size={17} />
        </a>
      </div>
      <div className="footer-bottom">
        <span>© Sunday Rituals. Made for your everyday.</span>
        <span>Thoughtful beauty, delivered with care.</span>
      </div>
    </footer>
  );
}
