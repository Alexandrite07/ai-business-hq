import "server-only";

type PayPalTokenResponse = {
  access_token?: string;
  error_description?: string;
};

const PAYPAL_MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
const PAYPAL_API_BASE =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("PayPal server credentials are not configured.");
  }

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const payload = (await response.json()) as PayPalTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "PayPal authentication failed.");
  }
  return payload.access_token;
}

export async function paypalRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as T & {
    message?: string;
    name?: string;
  };
  if (!response.ok) {
    throw new Error(payload.message ?? payload.name ?? "PayPal request failed.");
  }
  return payload;
}
