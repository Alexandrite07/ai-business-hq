import Link from "next/link";
import { ArrowUpRight, PawPrint } from "lucide-react";
import { getActiveProducts } from "@/lib/products";

export async function SiteHeader() {
  const products = await getActiveProducts();
  const featured = products.find((product) => product.featured && product.active) ?? products[0];
  const ctaSlug = featured?.slug ?? "calmpaws-silicone-slow-feeder-lick-mat-set";
  return (
    <>
      <header className="site-header">
        <Link aria-label="Roam & Nest home" className="brand-mark" href="/">
          <span className="brand-icon">
            <PawPrint aria-hidden="true" size={18} strokeWidth={1.6} />
          </span>
          <span>
            <strong>Roam & Nest</strong>
            <small>thoughtful gear for life at home and on the move</small>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          <Link href="/#shop">Shop</Link>
          <Link href="/#our-promise">Our promise</Link>
          <Link href="/#faq">FAQs</Link>
        </nav>
        <Link className="header-cta" href={`/products/${ctaSlug}`}>
          Shop thoughtful gear <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </header>
    </>
  );
}
