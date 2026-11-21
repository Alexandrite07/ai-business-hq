import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function isAuthorized(request?: Request) {
  return isAdminRequestAuthorized(request);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, paypal_order_id, customer_name, customer_email, shipping_address, items, total_usd, status, cj_tracking_number, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin order lookup failed:", error);
    return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  }
  return NextResponse.json(
    { orders: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

type UpdateOrderInput = {
  orderId?: unknown;
  trackingNumber?: unknown;
};

export async function PATCH(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  let input: UpdateOrderInput;
  try {
    input = (await request.json()) as UpdateOrderInput;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof input.orderId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(input.orderId) ||
    typeof input.trackingNumber !== "string" ||
    input.trackingNumber.trim().length < 3 ||
    input.trackingNumber.trim().length > 100
  ) {
    return NextResponse.json(
      { error: "Enter a valid order and tracking number." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      cj_tracking_number: input.trackingNumber.trim(),
      status: "shipped",
    })
    .eq("id", input.orderId)
    .select("id, status, cj_tracking_number")
    .maybeSingle();

  if (error) {
    console.error("Admin order update failed:", error);
    return NextResponse.json({ error: "Could not save the tracking number." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ order: data });
}
