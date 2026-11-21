import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/app/components/product-detail-client";
import { getActiveProductBySlug } from "@/lib/products";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) notFound();

  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://sundayrituals.com";
  const offers = product.variants.length > 0
    ? product.variants.map((variant) => ({
        "@type": "Offer",
        name: variant.name,
        sku: variant.sku || undefined,
        priceCurrency: "USD",
        price: (variant.retailPriceUsd ?? product.price_usd).toFixed(2),
        availability: variant.inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        url: `${siteOrigin}/products/${product.slug}`,
      }))
    : [{
        "@type": "Offer",
        priceCurrency: "USD",
        price: product.price_usd.toFixed(2),
        availability: product.stock_status === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: `${siteOrigin}/products/${product.slug}`,
      }];
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.image_urls,
    sku: product.cj_sku ?? undefined,
    brand: { "@type": "Brand", name: product.store_brand },
    offers,
  };

  return (
    <section className="product-detail-section">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <ProductDetailClient key={product.id} product={product} />
    </section>
  );
}
