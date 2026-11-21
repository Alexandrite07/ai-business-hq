import { NextResponse } from "next/server";
import {
  isCheckoutSelectionError,
  resolveCheckoutSelection,
} from "@/lib/checkout-pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveProductById, getSupplierCostForActiveProduct } from "@/lib/products";
import { paypalRequest } from "@/lib/paypal";

type CaptureInput = {
  orderID?: unknown;
  productId?: unknown;
  quantity?: unknown;
  variantId?: unknown;
  bundleQty?: unknown;
};

type PayPalAddress = {
  address_line_1?: string;
  address_line_2?: string;
  admin_area_2?: string;
  admin_area_1?: string;
  postal_code?: string;
  country_code?: string;
};

type PayPalOrderDetails = {
  id?: string;
  status?: string;
  payer?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    items?: Array<{
      name?: string;
      description?: string;
      sku?: string;
      quantity?: string;
      unit_amount?: { currency_code?: string; value?: string };
    }>;
    shipping?: {
      name?: { full_name?: string };
      address?: PayPalAddress;
    };
    payments?: {
      captures?: Array<{
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
};

function isValidInput(value: CaptureInput): value is {
  orderID: string;
  productId: string;
  quantity?: number;
  variantId?: string;
  bundleQty?: number;
} {
  return (
    typeof value.orderID === "string" &&
    value.orderID.length >= 5 &&
    value.orderID.length <= 128 &&
    typeof value.productId === "string" &&
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

function paymentMatchesOrder(
  order: PayPalOrderDetails,
  orderID: string,
  productId: string,
  quantity: number,
  total: string,
  unitAmount: string,
  itemName: string,
  variantSku: string | null,
): boolean {
  const purchaseUnit = order.purchase_units?.[0];
  return (
    order.id === orderID &&
    (order.status === "APPROVED" || order.status === "COMPLETED") &&
    purchaseUnit?.reference_id === productId &&
    purchaseUnit.custom_id === productId &&
    purchaseUnit?.amount?.currency_code === "USD" &&
    purchaseUnit.amount.value === total &&
    purchaseUnit.items?.length === 1 &&
    purchaseUnit.items[0]?.quantity === String(quantity) &&
    purchaseUnit.items[0]?.name === itemName &&
    purchaseUnit.items[0]?.unit_amount?.currency_code === "USD" &&
    purchaseUnit.items[0]?.unit_amount?.value === unitAmount &&
    (variantSku === null || purchaseUnit.items[0]?.sku === variantSku)
  );
}

function customerName(order: PayPalOrderDetails): string {
  const shippingName = order.purchase_units?.[0]?.shipping?.name?.full_name?.trim();
  if (shippingName) return shippingName;
  const payerName = order.payer?.name;
  return [payerName?.given_name, payerName?.surname].filter(Boolean).join(" ").trim();
}

function formatAddress(address: PayPalAddress) {
  return {
    address_line_1: address.address_line_1 ?? "",
    address_line_2: address.address_line_2 ?? "",
    city: address.admin_area_2 ?? "",
    state: address.admin_area_1 ?? "",
    postal_code: address.postal_code ?? "",
    country_code: address.country_code ?? "",
  };
}

export async function POST(request: Request) {
  let input: CaptureInput;
  try {
    input = (await request.json()) as CaptureInput;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isValidInput(input)) {
    return NextResponse.json({ error: "Invalid capture request." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server credentials are required to save orders." },
      { status: 503 },
    );
  }

  try {
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("orders")
      .select("id, paypal_order_id, total_usd, status")
      .eq("paypal_order_id", input.orderID)
      .maybeSingle();

    if (existingOrderError) {
      throw new Error(`Could not check for a previous capture: ${existingOrderError.message}`);
    }
    if (existingOrder) {
      return NextResponse.json({ success: true, order: existingOrder });
    }

    const product = await getActiveProductById(input.productId);
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
    const supplierCost = await getSupplierCostForActiveProduct(product.id, selection.variantId ?? undefined);
    if (supplierCost === null) {
      return NextResponse.json(
        { error: "Supplier cost is unavailable for this product." },
        { status: 409 },
      );
    }

    const total = (selection.totalCents / 100).toFixed(2);
    const unitAmount = (selection.unitPriceCents / 100).toFixed(2);
    const variantLabel = selection.variantName
      ? ` · ${selection.variantName}${selection.variantSku ? ` (SKU ${selection.variantSku})` : ""}`
      : "";
    const itemName = `${product.title}${variantLabel}`.slice(0, 127);
    const orderDetails = await paypalRequest<PayPalOrderDetails>(
      `/v2/checkout/orders/${encodeURIComponent(input.orderID)}`,
      { method: "GET" },
    );

    if (
      !paymentMatchesOrder(
        orderDetails,
        input.orderID,
        product.id,
        selection.quantity,
        total,
        unitAmount,
        itemName,
        selection.variantSku,
      )
    ) {
      return NextResponse.json(
        { error: "The PayPal order does not match this product and amount." },
        { status: 400 },
      );
    }

    const orderAddress = orderDetails.purchase_units?.[0]?.shipping?.address;
    if (!orderAddress || orderAddress.country_code !== "US") {
      return NextResponse.json(
        { error: "A valid US shipping address is required to complete this order." },
        { status: 400 },
      );
    }

    const capture =
      orderDetails.status === "COMPLETED"
        ? orderDetails
        : await paypalRequest<PayPalOrderDetails>(
            `/v2/checkout/orders/${encodeURIComponent(input.orderID)}/capture`,
            { method: "POST", body: "{}" },
          );
    const purchaseUnit = capture.purchase_units?.[0];
    const completedCapture = purchaseUnit?.payments?.captures?.find(
      (payment) => payment.status === "COMPLETED",
    );
    const captureTotal = completedCapture?.amount?.value;
    const captureCurrency = completedCapture?.amount?.currency_code;
    if (
      capture.status !== "COMPLETED" ||
      captureCurrency !== "USD" ||
      captureTotal !== total
    ) {
      throw new Error("PayPal did not confirm a completed payment for the expected amount.");
    }

    const finalAddress =
      purchaseUnit?.shipping?.address ?? orderAddress;
    const fullName = customerName(capture) || customerName(orderDetails);
    const email = capture.payer?.email_address ?? orderDetails.payer?.email_address;
    if (!fullName || !email || !finalAddress || finalAddress.country_code !== "US") {
      throw new Error("PayPal payment completed without all required US customer details.");
    }

    const orderToSave = {
      paypal_order_id: input.orderID,
      customer_name: fullName,
      customer_email: email,
      shipping_address: formatAddress(finalAddress),
      items: [
        {
          product_id: product.id,
          title: product.title,
          quantity: selection.quantity,
          unit_price_usd: selection.unitPriceCents / 100,
          supplier_cost_usd: supplierCost,
          ...(selection.variantId ? { variant_id: selection.variantId } : {}),
          ...(selection.variantName ? { variant_name: selection.variantName } : {}),
          ...(selection.variantSku ? { variant_sku: selection.variantSku } : {}),
          ...(selection.variantImageUrl ? { variant_image_url: selection.variantImageUrl } : {}),
          ...(input.bundleQty !== undefined ? { bundle_qty: selection.quantity } : {}),
        },
      ],
      total_usd: total,
      status: "paid_pending_fulfillment",
    };

    const { data: savedOrder, error: saveError } = await supabase
      .from("orders")
      .insert(orderToSave)
      .select("id, paypal_order_id, total_usd, status")
      .single();

    if (saveError) {
      const { data: racedOrder, error: lookupError } = await supabase
        .from("orders")
        .select("id, paypal_order_id, total_usd, status")
        .eq("paypal_order_id", input.orderID)
        .maybeSingle();
      if (lookupError || !racedOrder) {
        throw new Error(`Payment was captured, but the order could not be saved: ${saveError.message}`);
      }
      return NextResponse.json({ success: true, order: racedOrder });
    }

    return NextResponse.json({ success: true, order: savedOrder });
  } catch (error) {
    console.error("PayPal capture-order failed:", error);
    return NextResponse.json(
      { error: "Unable to confirm this payment. Contact support before trying again." },
      { status: 502 },
    );
  }
}
