import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { isRecord } from "@/lib/product-management";
import { createAdminClient } from "@/lib/supabase/admin";

type BulkAction = "activate" | "deactivate" | "set_category" | "set_badge" | "adjust_price" | "delete";

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function roundToNinetyNine(cents: number): number {
  return Math.max(99, Math.ceil((cents / 100) - 0.99) * 100 + 99);
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body) || !Array.isArray(body.productIds) || !body.productIds.length ||
    body.productIds.length > 100 || !body.productIds.every(isId)) {
    return NextResponse.json({ error: "Select between 1 and 100 valid products." }, { status: 400 });
  }
  const action = body.action as BulkAction;
  const actions: BulkAction[] = ["activate", "deactivate", "set_category", "set_badge", "adjust_price", "delete"];
  if (!actions.includes(action)) {
    return NextResponse.json({ error: "Choose a supported bulk action." }, { status: 400 });
  }
  if (
    (action === "set_category" &&
      (typeof body.category !== "string" || body.category.trim().length < 1 || body.category.length > 80)) ||
    (action === "set_badge" &&
      (body.badgeText !== null &&
        (typeof body.badgeText !== "string" || body.badgeText.length > 60))) ||
    (action === "adjust_price" &&
      (typeof body.adjustPercent !== "number" ||
        !Number.isFinite(body.adjustPercent) ||
        body.adjustPercent < -90 ||
        body.adjustPercent > 200))
  ) {
    return NextResponse.json({ error: "One or more bulk action values are invalid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server credentials are not configured." }, { status: 503 });
  }
  const ids = [...new Set(body.productIds as string[])];
  if (action === "delete") {
    const { data, error } = await supabase.from("products").delete().in("id", ids).select("id");
    if (error) {
      console.error("Bulk product deletion failed:", error);
      return NextResponse.json({ error: "Could not delete the selected products." }, { status: 500 });
    }
    return NextResponse.json({ success: true, affected: data.length });
  }

  if (action === "adjust_price") {
    const { data: products, error: lookupError } = await supabase
      .from("products")
      .select("id, price_usd")
      .in("id", ids);
    if (lookupError) {
      console.error("Bulk product price lookup failed:", lookupError);
      return NextResponse.json({ error: "Could not load selected product prices." }, { status: 500 });
    }
    for (const product of products) {
      const currentCents = Math.round(Number(product.price_usd) * 100);
      const adjustedCents = roundToNinetyNine(
        Math.round(currentCents * (1 + Number(body.adjustPercent) / 100)),
      );
      const { error } = await supabase
        .from("products")
        .update({ price_usd: (adjustedCents / 100).toFixed(2) })
        .eq("id", product.id);
      if (error) {
        console.error("Bulk product price update failed:", error);
        return NextResponse.json({ error: "A selected product price could not be updated." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true, affected: products.length });
  }

  const updates: Record<string, unknown> =
    action === "activate"
      ? { active: true }
      : action === "deactivate"
        ? { active: false }
        : action === "set_category"
          ? { category: (body.category as string).trim() }
          : { badge_text: body.badgeText === null ? null : (body.badgeText as string).trim() };
  const { data, error } = await supabase.from("products").update(updates).in("id", ids).select("id");
  if (error) {
    console.error("Bulk product update failed:", error);
    return NextResponse.json(
      {
        error: "Could not update the selected products.",
        ...(action === "set_category" || action === "set_badge"
          ? { migrationRequired: true }
          : {}),
      },
      { status: error.code === "42703" || error.code === "PGRST204" ? 409 : 500 },
    );
  }
  return NextResponse.json({ success: true, affected: data.length });
}
