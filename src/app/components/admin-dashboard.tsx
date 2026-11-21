"use client";

import {
  ArrowUpRight,
  Check,
  Clipboard,
  LogOut,
  PackageCheck,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AIStoreManager } from "@/app/components/ai-store-manager";
import { RetailProductStudio } from "@/app/components/retail-product-studio";

type OrderItem = {
  title?: string;
  quantity?: number;
  supplier_cost_usd?: number;
  variant_name?: string;
  variant_sku?: string;
  variant_image_url?: string;
};

type ShippingAddress = {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
};

type AdminOrder = {
  id: string;
  paypal_order_id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  total_usd: number | string;
  status: string;
  cj_tracking_number: string | null;
  created_at: string;
};

type AdminTab = "orders" | "products" | "addProduct";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function orderProfit(order: AdminOrder) {
  const revenueCents = Math.round(Number(order.total_usd) * 100);
  const supplierCostCents = (Array.isArray(order.items) ? order.items : []).reduce(
    (total, item) =>
      total + Math.round(Number(item.supplier_cost_usd ?? 0) * 100) * Number(item.quantity ?? 1),
    0,
  );
  const paypalFeeCents = Math.round(revenueCents * 0.044 + 30);
  return (revenueCents - supplierCostCents - paypalFeeCents) / 100;
}

function addressText(address: ShippingAddress) {
  return [
    address.address_line_1,
    address.address_line_2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
    address.country_code,
  ]
    .filter(Boolean)
    .join("\n");
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/admin/orders", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          orders?: AdminOrder[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Could not load orders.");
        return result.orders ?? [];
      })
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load orders.");
        }
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const result = (await response.json()) as {
        orders?: AdminOrder[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Could not load orders.");
      setOrders(result.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load orders.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  async function logout() {
    const response = await fetch("/api/admin/session", { method: "DELETE" });
    if (!response.ok) {
      setError("Could not sign out. Please try again.");
      return;
    }
    window.location.replace("/admin");
  }

  async function copyAddress(address: ShippingAddress) {
    try {
      await navigator.clipboard.writeText(addressText(address));
      setNotice("Shipping address copied.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch {
      setError("Clipboard access was denied. Copy the address manually.");
    }
  }

  async function saveTracking(orderId: string, trackingNumber: string) {
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, trackingNumber }),
    });
    const result = (await response.json()) as {
      order?: { status: string; cj_tracking_number: string };
      error?: string;
    };
    if (!response.ok || !result.order) {
      setError(result.error ?? "Could not save the tracking number.");
      return;
    }
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: result.order!.status,
              cj_tracking_number: result.order!.cj_tracking_number,
            }
          : order,
      ),
    );
    setNotice("Tracking saved — this order is marked as shipped.");
    window.setTimeout(() => setNotice(""), 4000);
  }

  return (
    <section className="admin-dashboard">
      <div className="admin-dashboard-top">
        <div>
          <span className="eyebrow">
            <Sparkles aria-hidden="true" size={13} /> SUNDAY RITUALS / TEAM
          </span>
          <h1>Your shop, <em>in good hands.</em></h1>
          <p>Keep the thoughtful details moving, from first click to front door.</p>
        </div>
        <button className="admin-logout" onClick={logout} type="button">
          <LogOut aria-hidden="true" size={15} /> Sign out
        </button>
      </div>
      <AIStoreManager />
      <div className="admin-summary">
        <div>
          <span className="admin-summary-icon"><PackageCheck size={18} /></span>
          <span><small>Orders in view</small><strong>{orders.length}</strong></span>
        </div>
        <div>
          <span className="admin-summary-icon"><Truck size={18} /></span>
          <span>
            <small>Need fulfillment</small>
            <strong>{orders.filter((order) => order.status !== "shipped").length}</strong>
          </span>
        </div>
        <div>
          <span className="admin-summary-icon"><Store size={18} /></span>
          <span><small>Active workspace</small><strong>Sunday Rituals</strong></span>
        </div>
      </div>
      <div className="admin-workspace">
        <div className="admin-tabs" role="tablist" aria-label="Dashboard sections">
          <button
            aria-selected={activeTab === "orders"}
            className={activeTab === "orders" ? "is-active" : ""}
            onClick={() => setActiveTab("orders")}
            role="tab"
            type="button"
          >
            <PackageCheck aria-hidden="true" size={16} /> Orders
          </button>
          <button
            aria-selected={activeTab === "products"}
            className={activeTab === "products" ? "is-active" : ""}
            onClick={() => setActiveTab("products")}
            role="tab"
            type="button"
          >
            <Store aria-hidden="true" size={16} /> Products
          </button>
          <button
            aria-selected={activeTab === "addProduct"}
            className={activeTab === "addProduct" ? "is-active" : ""}
            onClick={() => setActiveTab("addProduct")}
            role="tab"
            type="button"
          >
            <Plus aria-hidden="true" size={16} /> Add a product
          </button>
        </div>
        {(error || notice) && (
          <p
            aria-live="polite"
            className={error ? "admin-notice is-error" : "admin-notice"}
            role={error ? "alert" : "status"}
          >
            {error || notice}
          </p>
        )}
        {activeTab === "orders" ? (
          <div aria-label="Orders" className="admin-orders" role="tabpanel">
            <div className="admin-panel-heading">
              <div>
                <h2>Incoming orders</h2>
                <p>Paid orders are ready for a little care and a shipping label.</p>
              </div>
              <button
                aria-label="Refresh orders"
                className="admin-refresh"
                disabled={loadingOrders}
                onClick={() => {
                  setLoadingOrders(true);
                  setError("");
                  void loadOrders();
                }}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={15} />
                Refresh
              </button>
            </div>
            {loadingOrders ? (
              <div className="admin-empty">Gathering your order details…</div>
            ) : orders.length === 0 ? (
              <div className="admin-empty">
                <PackageCheck aria-hidden="true" size={25} />
                <strong>Nothing to pack just yet.</strong>
                <span>New paid orders will appear here.</span>
              </div>
            ) : (
              <div className="admin-order-list">
                {orders.map((order) => (
                  <AdminOrderCard
                    key={order.id}
                    onCopyAddress={copyAddress}
                    onSaveTracking={saveTracking}
                    order={order}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <RetailProductStudio initialMode={activeTab === "products" ? "catalog" : "link"} key={activeTab} />
        )}
      </div>
      <p className="admin-bottom-note">
        Orders and customer details are visible only to authorized store admins.
        <a href="mailto:support@sundayrituals.com"> Need a hand?</a>
      </p>
    </section>
  );
}
function AdminOrderCard({
  order,
  onCopyAddress,
  onSaveTracking,
}: {
  order: AdminOrder;
  onCopyAddress: (address: ShippingAddress) => void;
  onSaveTracking: (orderId: string, trackingNumber: string) => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState(order.cj_tracking_number ?? "");
  const [saving, setSaving] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];
  const profit = orderProfit(order);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    await onSaveTracking(order.id, trackingNumber);
    setSaving(false);
  }

  return (
    <article className="admin-order-card">
      <div className="order-card-top">
        <div>
          <span className="order-date">
            {new Date(order.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <strong className="order-ref">#{order.paypal_order_id}</strong>
        </div>
        <span className={`order-status ${order.status === "shipped" ? "is-shipped" : ""}`}>
          {order.status === "shipped" ? <Check size={12} /> : <PackageCheck size={12} />}
          {order.status === "shipped" ? "Shipped" : "Paid · needs fulfillment"}
        </span>
      </div>
      <div className="order-card-content">
        <div className="order-customer">
          <span className="eyebrow">CUSTOMER</span>
          <strong>{order.customer_name}</strong>
          <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
        </div>
        <div className="order-items">
          <span className="eyebrow">ORDER</span>
          {items.map((item, index) => (
            <div className="order-variety-item" key={`${item.title ?? "item"}-${index}`}>
              {item.variant_image_url && (
                <span
                  aria-label={`${item.variant_name ?? item.title ?? "Product"} photo`}
                  className="order-variety-thumb"
                  role="img"
                  style={{ backgroundImage: `url("${item.variant_image_url}")` }}
                />
              )}
              <span>
                {item.title ?? "Sunday Rituals product"}
                {item.variant_name ? ` · ${item.variant_name}` : ""}
                {item.variant_sku ? ` · CJ SKU ${item.variant_sku}` : ""}
                {` · Qty ${item.quantity ?? 1}`}
              </span>
            </div>
          ))}
          <strong>Revenue {currency.format(Number(order.total_usd))}</strong>
          <span className={profit >= 0 ? "profit-value" : "profit-value is-negative"}>
            Est. net profit {currency.format(profit)}
          </span>
        </div>
        <div className="order-address">
          <span className="eyebrow">SHIP TO</span>
          <p>{addressText(order.shipping_address)}</p>
          <button
            className="copy-address-button"
            onClick={() => void onCopyAddress(order.shipping_address)}
            type="button"
          >
            <Clipboard aria-hidden="true" size={14} /> Copy US shipping address
          </button>
        </div>
      </div>
      <form className="tracking-form" onSubmit={handleSubmit}>
        <label htmlFor={`tracking-${order.id}`}>CJ tracking number</label>
        <input
          id={`tracking-${order.id}`}
          onChange={(event) => setTrackingNumber(event.target.value)}
          placeholder="Paste tracking number"
          required
          value={trackingNumber}
        />
        <button className="button button-dark" disabled={saving} type="submit">
          {saving ? "Saving…" : order.status === "shipped" ? "Update tracking" : "Save & mark shipped"}
          <ArrowUpRight aria-hidden="true" size={14} />
        </button>
        {order.cj_tracking_number && (
          <span className="saved-tracking">Current: {order.cj_tracking_number}</span>
        )}
      </form>
    </article>
  );
}
