import { NextResponse } from "next/server";
import {
  generateGeminiJson,
  GeminiConfigurationError,
  GeminiRequestError,
} from "@/lib/ai";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type OrderItem = {
  product_id?: string;
  cj_sku?: string;
  quantity?: number | string;
  supplier_cost_usd?: number | string;
};

type BriefResult = {
  bullets: string[];
};

type BriefMetrics = {
  revenueUsd: number;
  supplierCostsUsd: number;
  estimatedPaypalFeesUsd: number;
  netProfitUsd: number;
  unfulfilledOrdersOver24Hours: number;
};

function deterministicBullets(
  metrics: BriefMetrics,
  ordersCount: number,
  productsCount: number,
): string[] {
  const fulfillmentBullet =
    metrics.unfulfilledOrdersOver24Hours > 0
      ? `Prioritize ${metrics.unfulfilledOrdersOver24Hours} unfulfilled order${metrics.unfulfilledOrdersOver24Hours === 1 ? "" : "s"} older than 24 hours.`
      : ordersCount > 0
        ? "Review paid orders and keep fulfillment tracking current."
        : "Confirm checkout and payment capture are ready before promoting the store.";
  const catalogBullet =
    productsCount > 0
      ? `Review the ${productsCount} product${productsCount === 1 ? "" : "s"} and keep supplier costs and listing details current.`
      : "Add and verify the first product so customers can start shopping.";
  const marginBullet =
    `Recorded revenue is $${metrics.revenueUsd.toFixed(2)} against $${metrics.supplierCostsUsd.toFixed(2)} in supplier costs and $${metrics.estimatedPaypalFeesUsd.toFixed(2)} in estimated PayPal fees; estimated net is $${metrics.netProfitUsd.toFixed(2)}.`;
  return [fulfillmentBullet, catalogBullet, marginBullet];
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 503 },
    );
  }

  let productsResult;
  let ordersResult;
  try {
    [productsResult, ordersResult] = await Promise.all([
      supabase.from("products").select("id, cj_sku, supplier_cost_usd"),
      supabase.from("orders").select("id, items, total_usd, status, created_at"),
    ]);
  } catch (error) {
    console.error("AI operations brief data request failed:", error);
    return NextResponse.json({ error: "Could not reach Supabase for store operations data." }, {
      status: 503,
    });
  }
  if (productsResult.error || ordersResult.error) {
    console.error("AI operations brief data lookup failed:", productsResult.error ?? ordersResult.error);
    return NextResponse.json({ error: "Could not load store operations data." }, { status: 500 });
  }

  const costByProduct = new Map<string, number>();
  const costBySku = new Map<string, number>();
  for (const product of productsResult.data ?? []) {
    const cost = Number(product.supplier_cost_usd);
    if (!Number.isFinite(cost) || cost < 0) continue;
    costByProduct.set(product.id, cost);
    if (product.cj_sku) costBySku.set(product.cj_sku, cost);
  }

  const orders = ordersResult.data ?? [];
  let revenueCents = 0;
  let supplierCostsCents = 0;
  let estimatedPaypalFeesCents = 0;
  const now = Date.now();
  const unfulfilledOrdersOver24Hours = orders.filter(
    (order) => {
      const createdAt = new Date(order.created_at).getTime();
      return (
        order.status !== "shipped" &&
        Number.isFinite(createdAt) &&
        now - createdAt > 24 * 60 * 60 * 1000
      );
    },
  );

  for (const order of orders) {
    const orderRevenue = Number(order.total_usd);
    if (!Number.isFinite(orderRevenue)) continue;
    const orderRevenueCents = Math.round(orderRevenue * 100);
    revenueCents += orderRevenueCents;
    estimatedPaypalFeesCents += Math.round(orderRevenueCents * 0.044 + 30);

    const items = Array.isArray(order.items) ? order.items : [];
    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
      const item = rawItem as OrderItem;
      const quantity = Number(item.quantity ?? 1);
      const directCost = Number(item.supplier_cost_usd);
      const cost =
        Number.isFinite(directCost) && directCost >= 0 && item.supplier_cost_usd !== undefined
          ? directCost
          : item.product_id
            ? costByProduct.get(item.product_id) ?? 0
            : item.cj_sku
              ? costBySku.get(item.cj_sku) ?? 0
              : 0;
      if (Number.isSafeInteger(quantity) && quantity > 0) {
        supplierCostsCents += Math.round(cost * 100) * quantity;
      }
    }
  }

  const metrics: BriefMetrics = {
    revenueUsd: revenueCents / 100,
    supplierCostsUsd: supplierCostsCents / 100,
    estimatedPaypalFeesUsd: estimatedPaypalFeesCents / 100,
    netProfitUsd: (revenueCents - supplierCostsCents - estimatedPaypalFeesCents) / 100,
    unfulfilledOrdersOver24Hours: unfulfilledOrdersOver24Hours.length,
  };

  if (orders.length === 0 || productsResult.data?.length === 0) {
    const bullets = deterministicBullets(metrics, orders.length, productsResult.data?.length ?? 0);
    return NextResponse.json(
      { metrics, bullets, aiSource: "deterministic-fallback" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const result = await generateGeminiJson<BriefResult>(
      `Create exactly 3 concise executive action bullets for the Roam & Nest store team today. Base recommendations only on these metrics and prioritize urgent fulfillment, catalog readiness for pet enrichment/travel/home gear, and profitability. Do not invent trends, customers, or facts. Keep every recommendation PayPal-compliant: target at least 55% net margin after supplier cost, the $3.50 US shipping buffer when used, and 4.4% + $0.30 PayPal fees. Metrics are USD and include all recorded orders.

${JSON.stringify(metrics)}`,
      {
        type: "OBJECT",
        properties: {
          bullets: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["bullets"],
      },
    );
    if (
      !Array.isArray(result.data.bullets) ||
      result.data.bullets.length !== 3 ||
      !result.data.bullets.every(
        (bullet) => typeof bullet === "string" && bullet.trim().length > 0 && bullet.length <= 400,
      )
    ) {
      return NextResponse.json({ error: "Gemini returned an invalid operations brief." }, {
        status: 502,
      });
    }

    return NextResponse.json(
      {
        metrics,
        bullets: result.data.bullets.map((bullet) => bullet.trim()),
        aiSource: "gemini",
        modelUsed: result.modelUsed,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof GeminiConfigurationError || error instanceof GeminiRequestError) {
      return NextResponse.json(
        {
          metrics,
          bullets: deterministicBullets(metrics, orders.length, productsResult.data?.length ?? 0),
          aiSource: "deterministic-fallback",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const message = error instanceof Error ? error.message : "Could not create the operations brief.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
