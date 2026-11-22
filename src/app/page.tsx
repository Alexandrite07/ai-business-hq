import { Suspense } from "react";
import { connection } from "next/server";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Heart,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { ProductCollection } from "@/app/components/product-collection";
import { getActiveProducts } from "@/lib/products";

async function Storefront() {
  await connection();
  const products = await getActiveProducts();
  const featuredProduct =
    products.find((product) => product.featured && product.active) ?? products[0];
  const featuredSlug =
    featuredProduct?.slug ?? "calmpaws-silicone-slow-feeder-lick-mat-set";

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles aria-hidden="true" size={14} /> Thoughtful comfort, wherever life goes
          </span>
          <h1>
            Home and away,
            <br />
            <em>thoughtfully equipped.</em>
          </h1>
          <p>
            Thoughtful gear for life at home and on the move — from enrichment and
            mealtime calm to cozy spaces and easier travel.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" href={`/products/${featuredSlug}`}>
              Shop thoughtful gear <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="text-link" href="#our-promise">
              Why Roam & Nest <ArrowDown aria-hidden="true" size={14} />
            </Link>
          </div>
          <div className="hero-proof">
            <span className="proof-avatars" aria-hidden="true">
              <i>J</i>
              <i>M</i>
              <i>A</i>
            </span>
            <span>
              <strong>Thoughtfully chosen</strong> for daily comfort
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div
            aria-label="A calm pet and home lifestyle"
            className="hero-image"
            role="img"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=88')",
            }}
          />
          <div className="hero-image-wash" />
          <div className="floating-note">
            <span className="note-icon">
              <Heart aria-hidden="true" fill="currentColor" size={15} />
            </span>
            <span>
              <strong>Little comforts</strong>
              for big everyday moments
            </span>
          </div>
          <span aria-hidden="true" className="hero-orbit">
            <Sparkles size={21} />
          </span>
        </div>
        <div aria-hidden="true" className="hero-scroll">
          <span /> Scroll to find your gear
        </div>
      </section>

      <section aria-label="Our customer promises" className="trust-strip" id="our-promise">
        <div>
          <ShieldCheck aria-hidden="true" size={18} />
          <span>
            <strong>Secure checkout</strong>
            PayPal & guest card
          </span>
        </div>
        <i aria-hidden="true" />
        <div>
          <Truck aria-hidden="true" size={18} />
          <span>
            <strong>Free US shipping</strong>
            Tracked to your door
          </span>
        </div>
        <i aria-hidden="true" />
        <div>
          <BadgeCheck aria-hidden="true" size={18} />
          <span>
            <strong>30-day guarantee</strong>
            Love it or let us know
          </span>
        </div>
      </section>

      <section className="collection-section section-wrap" id="shop">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A GOOD PLACE TO BEGIN</span>
            <h2>Useful things, <em>lovingly chosen.</em></h2>
            <p>Meet practical comfort and enrichment for pets, home, and time away.</p>
          </div>
          <span className="collection-count">{String(products.length).padStart(2, "0")} / YOUR NEXT FAVORITE</span>
        </div>
        <ProductCollection products={products} />
      </section>

      <section className="ritual-feature">
        <div
          aria-label="Cozy home and pet enrichment"
          className="ritual-image"
          role="img"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=85')",
          }}
        />
        <div className="ritual-copy">
          <span className="eyebrow">THE ROAM & NEST STATE OF MIND</span>
          <h2>Everyday life should feel a little easier.</h2>
          <p>
            No clutter for clutter’s sake. No complicated gear. Just useful, attractive
            essentials that support daily comfort, calmer routines, and mess-conscious
            moments at home or away.
          </p>
          <Link className="text-link" href={`/products/${featuredSlug}`}>
            Find an everyday favorite <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <span aria-hidden="true" className="ritual-sparkle">
            <Sparkles size={32} strokeWidth={1} />
          </span>
        </div>
      </section>

      <section className="promise-section section-wrap">
        <div className="promise-intro">
          <span className="eyebrow">A NOTE FROM US</span>
          <h2>Consider this a little more <em>ease.</em></h2>
          <p>
            Daily routines don’t need to be another thing to get right. We’re here for
            useful details, warm design, and gear that fits real life.
          </p>
        </div>
        <div className="promise-cards">
          <article>
            <span className="promise-number">01</span>
            <Sparkles aria-hidden="true" size={20} />
            <h3>Thoughtfully picked</h3>
            <p>Useful favorites for pets, home, and travel, chosen with real routines in mind.</p>
          </article>
          <article>
            <span className="promise-number">02</span>
            <Heart aria-hidden="true" size={20} />
            <h3>Comfort in the details</h3>
            <p>Attractive, practical features that make daily routines feel calmer and simpler.</p>
          </article>
          <article>
            <span className="promise-number">03</span>
            <ShieldCheck aria-hidden="true" size={20} />
            <h3>Here if you need us</h3>
            <p>Real support, clear policies, and 30 days to decide if it feels right.</p>
          </article>
        </div>
      </section>

      <section className="faq-section section-wrap" id="faq">
        <div className="faq-title">
          <span className="eyebrow">GOOD TO KNOW</span>
          <h2>A few things you might be <em>wondering.</em></h2>
          <p>Need a hand with something else? We’re only an email away.</p>
          <a className="text-link" href="mailto:support@roamandnest.com">
            Email our team <ArrowRight aria-hidden="true" size={15} />
          </a>
        </div>
        <div className="faq-list">
          <details>
            <summary>How long will my order take to arrive?</summary>
            <p>
              Orders are processed in 2–3 business days, then typically arrive within 5–10
              business days in the US. We’ll send tracking details as soon as your order is
              on its way.
            </p>
          </details>
          <details>
            <summary>Is shipping really free?</summary>
            <p>
              Yes. US standard shipping is on us, with no minimum purchase required.
            </p>
          </details>
          <details>
            <summary>What if it isn’t quite right for me?</summary>
            <p>
              Let us know within 30 days of delivery. We’ll help you with the next steps
              under our 30-day money-back guarantee.
            </p>
          </details>
          <details>
            <summary>Can I pay with a card without a PayPal account?</summary>
            <p>
              Yes. At checkout, choose the debit or credit card option to pay securely as
              a guest through PayPal, where available.
            </p>
          </details>
        </div>
      </section>

      <section className="closing-banner">
        <span className="eyebrow">A LITTLE SOMETHING FOR YOU</span>
        <h2>Thoughtful gear for wherever today takes you.</h2>
        <Link className="button button-light" href={`/products/${featuredSlug}`}>
          Find your everyday favorite <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <span aria-hidden="true" className="closing-sparkle closing-sparkle-one">
          <Sparkles size={25} />
        </span>
        <span aria-hidden="true" className="closing-sparkle closing-sparkle-two">
          <Sparkles size={16} />
        </span>
      </section>
    </>
  );
}

function StorefrontFallback() {
  return (
    <div aria-label="Loading Roam & Nest" className="storefront-loading">
      <Sparkles aria-hidden="true" size={22} />
      <span>Gathering thoughtful gear…</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<StorefrontFallback />}>
      <Storefront />
    </Suspense>
  );
}
