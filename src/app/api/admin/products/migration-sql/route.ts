import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  try {
    const sql = await readFile(
      join(process.cwd(), "supabase/migrations/20261116_variety_photos_and_retail.sql"),
      "utf8",
    );
    return NextResponse.json({ sql }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not read the product migration SQL:", error);
    return NextResponse.json({ error: "Could not load the migration SQL." }, { status: 500 });
  }
}
