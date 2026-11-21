import { NextResponse } from "next/server";
import {
  isCheckoutSelectionError,
  resolveCheckoutSelection,
} from "@/lib/checkout-pricing";
import { getActiveProductById, getActiveProductBySlug } from "@/lib/products";
import { paypalRequest } from "@/lib/paypal";

type CreateOrderInput = {
  productId?: unknown;
  quantity?: unknown;
  variantId?: unknown;
  bundleQty?: unknown;
};

type PayPalCreateOrderResponse = {
  id?: string;
};

function isValidInput(value: CreateOrderInput): value is {
  productId: string;
  quantity?: number;
  variantId?: string;
  bundleQty?: number;
} {
  return (
    typeof value.productId === "string" &&
    value.productId.length > 0 &&
    (value.quantity === undefined ||
      (typeof value.quantity === "number" &&
        Number.isInteger(value.quantity) &&
        value.quantity >= 1 &&
        value.quantity <= 20)) &&
    (value.bundleQty === undefined ||
      (typeof value.bundleQty === "number" &&
        Number.isInteger(value.bundleQty) &&
        value.bundleQty >= 2 &&
        value.bundleQty <= 20)) &&
    (value.variantId === undefined ||
      (typeof value.variantId === "string" && value.variantId.length > 0 && value.variantId.length <= 80)) &&
    (value.quantity !== undefined || value.bundleQty !== undefined)
  );
}

export async function POST(request: Request) {
  let input: CreateOrderInput;
  try {
    input = (await request.json()) as CreateOrderInput;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isValidInput(input)) {
    return NextResponse.json(
      { error: "A product and a quantity from 1 to 20 are required." },
      { status: 400 },
    );
  }

  try {
    const product =
      (await getActiveProductById(input.productId)) ??
      (input.productId.includes("-") ? await getActiveProductBySlug(input.productId) : null);
    if (!product) {
      return NextResponse.json({ error: "This product is no longer available." }, { status: 404 });
    }

    const selection = resolveCheckoutSelection(product, {
      quantity: input.quantity,
      bundleQty: input.bundleQty,
      variantId: input.variantId,
    });
    if (isCheckoutSelectionError(selection)) {
      return NextResponse.json({ error: selection.error }, { status: selection.status });
    }
    const amount = (selection.totalCents / 100).toFixed(2);
    const unitAmount = (selection.unitPriceCents / 100).toFixed(2);
    const varietyLabel = selection.variantName
      ? ` · ${selection.variantName}${selection.variantSku ? ` (SKU ${selection.variantSku})` : ""}`
      : "";
    const itemName = `${product.title}${varietyLabel}`.slice(0, 127);
    const origin = new URL(request.url).origin;
    const order = await paypalRequest<PayPalCreateOrderResponse>("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: product.id,
            custom_id: product.id,
            description: itemName,
            items: [
              {
                name: itemName,
                ...(varietyLabel
                  ? { description: varietyLabel.trim().replace(/^·\s*/, "") }
                  : {}),
                ...(selection.variantSku ? { sku: selection.variantSku } : {}),
                quantity: String(selection.quantity),
                unit_amount: {
                  currency_code: "USD",
                  value: unitAmount,
                },
              },
            ],
            amount: {
              currency_code: "USD",
              value: amount,
              breakdown: {
                item_total: { currency_code: "USD", value: amount },
              },
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Sunday Rituals",
              locale: "en-US",
              landing_page: "GUEST_CHECKOUT",
              shipping_preference: "GET_FROM_FILE",
              user_action: "PAY_NOW",
              return_url: `${origin}/thank-you`,
              cancel_url: `${origin}/products/${product.slug}`,
            },
          },
        },
      }),
    });

    if (!order.id) throw new Error("PayPal did not return an order ID.");
    return NextResponse.json({ orderID: order.id, total: amount });
  } catch (error) {
    console.error("PayPal create-order failed:", error);
    const message =
      error instanceof Error && error.message.includes("not configured")
        ? error.message
        : "Unable to start checkout. Please try again.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
