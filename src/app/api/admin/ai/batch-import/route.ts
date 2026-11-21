import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { isRecord } from "@/lib/product-management";
import { POST as importFromUrl } from "../import-from-url/route";

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
  if (
    !isRecord(body) ||
    !Array.isArray(body.urls) ||
    body.urls.length < 1 ||
    body.urls.length > 10 ||
    !body.urls.every(
      (url) =>
        typeof url === "string" &&
        url.length <= 2048 &&
        (() => {
          try {
            return ["http:", "https:"].includes(new URL(url).protocol);
          } catch {
            return false;
          }
        })(),
    ) ||
    (body.autoPublish !== undefined && typeof body.autoPublish !== "boolean") ||
    (body.supplierCostOverrideUsd !== undefined &&
      body.supplierCostOverrideUsd !== null &&
      (typeof body.supplierCostOverrideUsd !== "number" ||
        !Number.isFinite(body.supplierCostOverrideUsd) ||
        body.supplierCostOverrideUsd <= 0 ||
        body.supplierCostOverrideUsd > 100_000))
  ) {
    return NextResponse.json(
      { error: "Provide up to 10 valid supplier URLs and valid optional import settings." },
      { status: 400 },
    );
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  const adminPassword = request.headers.get("x-admin-password");
  const sessionCookie = request.headers.get("cookie");
  if (adminPassword) headers.set("x-admin-password", adminPassword);
  if (sessionCookie) headers.set("cookie", sessionCookie);
  const results: Array<{ url: string; status: number; result: unknown }> = [];
  for (const url of body.urls as string[]) {
    const importRequest = new Request(new URL("/api/admin/ai/import-from-url", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        url,
        autoPublish: body.autoPublish === true,
        ...(typeof body.supplierCostOverrideUsd === "number"
          ? { supplierCostOverrideUsd: body.supplierCostOverrideUsd }
          : {}),
      }),
    });
    const response = await importFromUrl(importRequest);
    results.push({ url, status: response.status, result: await response.json() });
  }
  return NextResponse.json(
    {
      results,
      succeeded: results.filter((item) => item.status >= 200 && item.status < 300).length,
      failed: results.filter((item) => item.status < 200 || item.status >= 300).length,
    },
    { status: 200, headers: { "Cache-Control": "private, no-store" } },
  );
}
