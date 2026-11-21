"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import type { Product } from "@/lib/products";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function ProductCard({ product }: { product: Product }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const coverImage =
    selectedVariant?.imageUrls[0] ?? selectedVariant?.swatchImageUrl ?? product.image_urls[0] ?? "";
  const price = selectedVariant?.retailPriceUsd ?? product.price_usd;
  const compareAtPrice =
    selectedVariant?.compareAtPriceUsd ?? product.compare_at_price_usd;
  const savingsPercent =
    compareAtPrice && compareAtPrice > price
      ? Math.round((1 - price / compareAtPrice) * 100)
      : 0;

  return (
    <article className="product-card">
      <Link
        aria-label={`Shop ${product.title}`}
        className="product-card-image"
        href={`/products/${product.slug}`}
        style={{ backgroundImage: `url("${coverImage}")` }}
      >
        {product.badge_text && <span className="product-tag">{product.badge_text}</span>}
        <span aria-hidden="true" className="product-card-arrow">
          <ArrowUpRight size={17} />
        </span>
      </Link>
      {product.variants.length > 0 && (
        <div aria-label={`${product.title} photo swatches`} className="product-card-swatches">
          {product.variants.slice(0, 8).map((variant) => (
            <button
              aria-label={`Preview ${variant.name}`}
              aria-pressed={selectedVariantId === variant.id}
              className={selectedVariantId === variant.id ? "is-selected" : ""}
              key={variant.id}
              onClick={() => setSelectedVariantId(variant.id)}
              style={{
                backgroundImage: `url("${variant.swatchImageUrl}")`,
                minHeight: 44,
                minWidth: 44,
              }}
              type="button"
            />
          ))}
        </div>
      )}
      <div className="product-card-info">
        <div>
          <div className="rating-line">
            <span aria-label="Rated 4.9 out of 5" className="rating-stars">
              <Star aria-hidden="true" size={12} fill="currentColor" />
              <Star aria-hidden="true" size={12} fill="currentColor" />
              <Star aria-hidden="true" size={12} fill="currentColor" />
              <Star aria-hidden="true" size={12} fill="currentColor" />
              <Star aria-hidden="true" size={12} fill="currentColor" />
            </span>
            <span>4.9 · loved by our community</span>
          </div>
          <h3>{product.title}</h3>
          <p>{product.subtitle ?? "A thoughtfully chosen beauty ritual."}</p>
        </div>
        <div className="product-card-price">
          <strong>{currency.format(price)}</strong>
          {compareAtPrice && compareAtPrice > price && (
            <del>{currency.format(compareAtPrice)}</del>
          )}
          {savingsPercent > 0 && <span className="savings-pill">Save {savingsPercent}%</span>}
        </div>
      </div>
      <Link className="product-card-link" href={`/products/${product.slug}`}>
        Discover your new ritual <ArrowUpRight aria-hidden="true" size={15} />
      </Link>
    </article>
  );
}
