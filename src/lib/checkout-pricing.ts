import type { Product } from "@/lib/products";

export type CheckoutInput = {
  variantId?: string;
  quantity?: number;
  bundleQty?: number;
};

export type CheckoutSelection = {
  variantId: string | null;
  variantName: string | null;
  variantSku: string | null;
  variantImageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type CheckoutSelectionError = {
  error: string;
  status: number;
};

export function resolveCheckoutSelection(
  product: Product,
  input: CheckoutInput,
): CheckoutSelection | CheckoutSelectionError {
  const quantity = input.bundleQty ?? input.quantity ?? 1;
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20 ||
    (input.quantity !== undefined &&
      (!Number.isInteger(input.quantity) || input.quantity !== quantity))
  ) {
    return { error: "Choose a valid quantity from 1 to 20.", status: 400 };
  }

  if (product.stock_status === "out_of_stock") {
    return { error: "This product is sold out.", status: 409 };
  }
  if (product.variants.length > 0 && !input.variantId) {
    return { error: "Choose a product variety before checking out.", status: 409 };
  }

  const variant = input.variantId
    ? product.variants.find((candidate) => candidate.id === input.variantId)
    : undefined;
  if (input.variantId && !variant) {
    return { error: "The selected variety is no longer available.", status: 409 };
  }
  if (variant && !variant.inStock) {
    return { error: "The selected variety is sold out.", status: 409 };
  }

  const baseUnitCents = Math.round((variant?.retailPriceUsd ?? product.price_usd) * 100);
  if (!Number.isSafeInteger(baseUnitCents) || baseUnitCents < 1) {
    return { error: "This product has an invalid retail price.", status: 409 };
  }

  let unitPriceCents = baseUnitCents;
  if (input.bundleQty !== undefined) {
    const tier = product.bundle_tiers.find((candidate) => candidate.qty === quantity);
    if (!tier) {
      return { error: "The selected bundle is no longer available.", status: 409 };
    }
    const discountBasisPoints = Math.round(tier.discountPercent * 100);
    unitPriceCents = Math.round((baseUnitCents * (10_000 - discountBasisPoints)) / 10_000);
  }

  const totalCents = unitPriceCents * quantity;
  if (!Number.isSafeInteger(totalCents)) {
    return { error: "The selected order total is invalid.", status: 400 };
  }

  return {
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    variantSku: variant?.sku || null,
    variantImageUrl: variant?.swatchImageUrl ?? null,
    quantity,
    unitPriceCents,
    totalCents,
  };
}

export function isCheckoutSelectionError(
  result: CheckoutSelection | CheckoutSelectionError,
): result is CheckoutSelectionError {
  return "error" in result;
}
