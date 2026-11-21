import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

export function SiteHeader() {
  return (
    <>
      <header className="site-header">
        <Link aria-label="Sunday Rituals home" className="brand-mark" href="/">
          <span className="brand-icon">
            <Sparkles aria-hidden="true" size={18} strokeWidth={1.6} />
          </span>
          <span>
            <strong>Sunday Rituals</strong>
            <small>beauty, made softer</small>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          <Link href="/#shop">Shop</Link>
          <Link href="/#our-promise">Our promise</Link>
          <Link href="/#faq">FAQs</Link>
        </nav>
        <Link className="header-cta" href="/products/silk-heatless-curling-rod-set">
          Shop the ritual <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </header>
    </>
  );
}
