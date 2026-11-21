import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import {
  isMissingProductColumn,
  LEGACY_PRODUCT_ADMIN_COLUMNS,
  PRODUCT_ADMIN_COLUMNS,
} from "@/lib/product-management";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

function draftSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "sunday-rituals-product"}-${randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request, context: RouteContext) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "A valid product ID is required." }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server credentials are not configured." }, { status: 503 });
  }

  const extended = await supabase
    .from("products")
    .select(PRODUCT_ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  let source = extended.data as Record<string, unknown> | null;
  let migrationRequired = false;
  if (extended.error && isMissingProductColumn(extended.error)) {
    migrationRequired = true;
    const legacy = await supabase
      .from("products")
      .select(LEGACY_PRODUCT_ADMIN_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (legacy.error) {
      console.error("Legacy product lookup for duplication failed:", legacy.error);
      return NextResponse.json({ error: "Could not load the product to duplicate." }, { status: 500 });
    }
    source = legacy.data as Record<string, unknown> | null;
  } else if (extended.error) {
    console.error("Product lookup for duplication failed:", extended.error);
    return NextResponse.json({ error: "Could not load the product to duplicate." }, { status: 500 });
  }
  if (!source) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const fields = { ...source };
  delete fields.id;
  delete fields.created_at;
  delete fields.updated_at;
  const payload = {
    ...fields,
    slug: draftSlug(String(source.title ?? "Sunday Rituals Product")),
    title: `${String(source.title ?? "Sunday Rituals Product")} (Copy)`.slice(0, 120),
    active: false,
    ...(migrationRequired ? {} : { updated_at: new Date().toISOString() }),
  };
  const result = await supabase
    .from("products")
    .insert(payload)
    .select(migrationRequired ? LEGACY_PRODUCT_ADMIN_COLUMNS : PRODUCT_ADMIN_COLUMNS)
    .single();
  if (result.error) {
    console.error("Product duplication failed:", result.error);
    return NextResponse.json({ error: "Could not create the product draft." }, { status: 500 });
  }

  return NextResponse.json(
    { product: result.data, migrationRequired },
    { status: 200 },
  );
}
