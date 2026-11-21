"use client";

import { useState } from "react";
import { ProductGallery } from "@/app/components/product-gallery";
import { ProductPurchase } from "@/app/components/product-purchase-varieties";
import type { Product } from "@/lib/products";

export function ProductDetailClient({ product }: { product: Product }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const galleryImages =
    selectedVariant?.imageUrls.length ? selectedVariant.imageUrls : product.image_urls;

  return (
    <div className="product-detail-layout">
      <ProductGallery
        images={galleryImages}
        key={selectedVariant?.id ?? "product-gallery"}
        title={product.title}
      />
      <ProductPurchase
        onVariantChange={setSelectedVariantId}
        product={{
          id: product.id,
          slug: product.slug,
          title: product.title,
          subtitle: product.subtitle,
          description: product.description,
          price_usd: product.price_usd,
          compare_at_price_usd: product.compare_at_price_usd,
          benefits: product.benefits,
          variants: product.variants,
          bundle_tiers: product.bundle_tiers,
          how_to_use: product.how_to_use,
          materials_and_care: product.materials_and_care,
          shipping_estimate: product.shipping_estimate,
          stock_status: product.stock_status,
        }}
        selectedVariantId={selectedVariantId}
      />
    </div>
  );
}
