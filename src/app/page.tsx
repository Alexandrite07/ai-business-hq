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
  const featuredProduct = products[0];

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles aria-hidden="true" size={14} /> A softer kind of self-care
          </span>
          <h1>
            Make a little
            <br />
            <em>room for you.</em>
          </h1>
          <p>
            Thoughtful beauty essentials for slower evenings, softer mornings, and the
            everyday moments that feel like yours.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" href={`/products/${featuredProduct.slug}`}>
              Meet your new ritual <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="text-link" href="#our-promise">
              Why Sunday Rituals <ArrowDown aria-hidden="true" size={14} />
            </Link>
          </div>
          <div className="hero-proof">
            <span className="proof-avatars" aria-hidden="true">
              <i>J</i>
              <i>M</i>
              <i>A</i>
            </span>
            <span>
              <strong>4.9/5</strong> from people finding their softer side
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div
            aria-label="A calm, sunlit beauty ritual"
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
              <strong>Your little moment</strong>
              starts right here
            </span>
          </div>
          <span aria-hidden="true" className="hero-orbit">
            <Sparkles size={21} />
          </span>
        </div>
        <div aria-hidden="true" className="hero-scroll">
          <span /> Scroll to find your ritual
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
            <h2>Little things, <em>lovingly chosen.</em></h2>
            <p>Meet the feel-good essential our community can’t stop talking about.</p>
          </div>
          <span className="collection-count">{String(products.length).padStart(2, "0")} / YOUR NEXT FAVORITE</span>
        </div>
        <ProductCollection products={products} />
      </section>

      <section className="ritual-feature">
        <div
          aria-label="Gentle evening beauty routine"
          className="ritual-image"
          role="img"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=85')",
          }}
        />
        <div className="ritual-copy">
          <span className="eyebrow">THE SUNDAY STATE OF MIND</span>
          <h2>Beauty should feel like a deep breath.</h2>
          <p>
            No complicated routines. No pressure to be perfect. Just thoughtfully chosen
            essentials that make taking care of yourself feel easy, gentle, and entirely
            your own.
          </p>
          <Link className="text-link" href={`/products/${featuredProduct.slug}`}>
            Find your first little ritual <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <span aria-hidden="true" className="ritual-sparkle">
            <Sparkles size={32} strokeWidth={1} />
          </span>
        </div>
      </section>

      <section className="promise-section section-wrap">
        <div className="promise-intro">
          <span className="eyebrow">A NOTE FROM US</span>
          <h2>Consider this your permission to <em>slow down.</em></h2>
          <p>
            Your routine doesn’t need to be another thing to get right. We’re here for
            small joys, thoughtful details, and beauty that fits real life.
          </p>
        </div>
        <div className="promise-cards">
          <article>
            <span className="promise-number">01</span>
            <Sparkles aria-hidden="true" size={20} />
            <h3>Thoughtfully picked</h3>
            <p>Useful little favorites, chosen to make everyday care feel special.</p>
          </article>
          <article>
            <span className="promise-number">02</span>
            <Heart aria-hidden="true" size={20} />
            <h3>Gentle by design</h3>
            <p>Comfort-first details that make a calmer routine easy to come back to.</p>
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
          <a className="text-link" href="mailto:support@sundayrituals.com">
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
        <h2>Your softer morning is one good night away.</h2>
        <Link className="button button-light" href={`/products/${featuredProduct.slug}`}>
          Make room for a new ritual <ArrowRight aria-hidden="true" size={16} />
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
    <div aria-label="Loading Sunday Rituals" className="storefront-loading">
      <Sparkles aria-hidden="true" size={22} />
      <span>Making room for your next ritual…</span>
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
