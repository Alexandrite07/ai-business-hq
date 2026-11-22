import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SiteFooter } from "@/app/components/site-footer";
import { SiteHeader } from "@/app/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Roam & Nest | Thoughtful gear for home and away",
    template: "%s | Roam & Nest",
  },
  description:
    "Thoughtful gear for life at home and on the move — pet enrichment, everyday travel, and cozy home essentials.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Suspense
          fallback={
            <header className="site-header">
              <Link aria-label="Roam &amp; Nest home" className="brand-mark" href="/">
                <span><strong>Roam &amp; Nest</strong><small>thoughtful gear for life at home and on the move</small></span>
              </Link>
              <nav aria-label="Main navigation" className="site-nav">
                <Link href="/#shop">Shop</Link><Link href="/#our-promise">Our promise</Link><Link href="/#faq">FAQs</Link>
              </nav>
              <Link className="header-cta" href="/products/calmpaws-silicone-slow-feeder-lick-mat-set">Shop thoughtful gear</Link>
            </header>
          }
        >
          <SiteHeader />
        </Suspense>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
