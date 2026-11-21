"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/app/components/product-card";
import type { Product } from "@/lib/products";

type SortMode = "featured" | "newest" | "price";

export function ProductCollection({ products }: { products: Product[] }) {
  const [category, setCategory] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  );
  const visibleProducts = useMemo(() => {
    const filtered = products.filter(
      (product) => category === "All" || product.category === category,
    );
    return filtered.sort((left, right) => {
      if (sortMode === "price") {
        const lowestPrice = (product: Product) =>
          Math.min(
            product.price_usd,
            ...product.variants.flatMap((variant) =>
              variant.retailPriceUsd === null ? [] : [variant.retailPriceUsd],
            ),
          );
        return lowestPrice(left) - lowestPrice(right);
      }
      if (sortMode === "newest") {
        return (right.created_at ?? "").localeCompare(left.created_at ?? "");
      }
      return Number(right.featured) - Number(left.featured) ||
        (left.sort_order ?? 100) - (right.sort_order ?? 100);
    });
  }, [category, products, sortMode]);

  return (
    <>
      <div className="collection-controls">
        <div aria-label="Filter products by category" className="category-filter-pills">
          {categories.map((item) => (
            <button
              aria-pressed={category === item}
              className={category === item ? "is-selected" : ""}
              key={item}
              onClick={() => setCategory(item)}
              style={{ minHeight: 44 }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <label className="collection-sort">
          <span>Sort by</span>
          <select
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            value={sortMode}
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price">Price: Low to High</option>
          </select>
        </label>
      </div>
      {visibleProducts.length > 0 ? (
        <div className="product-grid">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <p className="collection-empty">No products in this collection just yet.</p>
      )}
    </>
  );
}
