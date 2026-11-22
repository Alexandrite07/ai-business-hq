import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type ProductExtractionMethod =
  | "direct"
  | "jina"
  | "fallback"
  | "direct+fallback"
  | "jina+fallback"
  | "none";

export type CandidateVariant = {
  name: string;
  sku?: string;
  priceUsd?: number;
  imageUrl?: string;
};

export type ProductExtraction = {
  sourceUrl: string;
  extractedSku: string | null;
  rawTitle: string | null;
  rawDescription: string | null;
  extractedPriceUsd: number | null;
  candidateImageUrls: string[];
  candidateVariants: CandidateVariant[];
  pageContextText: string;
  extractionMethod: ProductExtractionMethod;
};

type PageData = {
  title: string | null;
  description: string | null;
  price: number | null;
  sku: string | null;
  images: string[];
  variants: CandidateVariant[];
  text: string;
};

type HtmlAttribute = {
  name: string;
  value: string;
};

const DIRECT_TIMEOUT_MS = 12_000;
const JINA_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_CONTEXT_LENGTH = 24_000;
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && octets[2] === 0) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 88 && octets[2] === 99) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && octets[2] === 100) ||
    (first === 203 && second === 0 && octets[2] === 113) ||
    first >= 224
  );
}

function ipv6Words(address: string): number[] | null {
  let normalized = address.toLowerCase().split("%")[0] ?? "";
  if (!normalized || isIP(normalized) !== 6) return null;

  const embeddedIpv4 = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  const ipv4Words = embeddedIpv4?.split(".").map(Number) ?? [];
  if (embeddedIpv4 && (ipv4Words.length !== 4 || ipv4Words.some((part) => part < 0 || part > 255))) {
    return null;
  }
  if (embeddedIpv4) {
    const first = (((ipv4Words[0] ?? 0) << 8) | (ipv4Words[1] ?? 0)).toString(16);
    const second = (((ipv4Words[2] ?? 0) << 8) | (ipv4Words[3] ?? 0)).toString(16);
    normalized = normalized.replace(embeddedIpv4, `${first}:${second}`);
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const parsed = [...left, ...right].map((part) => Number.parseInt(part, 16));
  if (parsed.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) return null;
  const zeros = 8 - parsed.length;
  if ((halves.length === 1 && zeros !== 0) || (halves.length === 2 && zeros < 1)) return null;
  return [
    ...left.map((part) => Number.parseInt(part, 16)),
    ...Array.from({ length: zeros }, () => 0),
    ...right.map((part) => Number.parseInt(part, 16)),
  ];
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;

  const words = ipv6Words(address);
  if (!words) return true;
  if (words.every((word) => word === 0) || words.slice(0, 7).every((word) => word === 0) && words[7] === 1) {
    return true;
  }

  const first = words[0] ?? 0;
  if (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && words[1] === 0x0db8)
  ) {
    return true;
  }
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const address4 = `${(words[6] ?? 0) >> 8}.${(words[6] ?? 0) & 255}.${(words[7] ?? 0) >> 8}.${(words[7] ?? 0) & 255}`;
    return isPrivateIpv4(address4);
  }
  return false;
}

async function validatePublicUrl(value: URL): Promise<void> {
  if (value.protocol !== "http:" && value.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS product URLs are supported.");
  }
  if (value.username || value.password || !value.hostname) {
    throw new Error("Provide a valid public product URL.");
  }

  const hostname = value.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private and local network URLs are not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Private and local network URLs are not allowed.");
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("The product URL hostname could not be resolved.");
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private and local network URLs are not allowed.");
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#(\d+);?/g, (_match, code: string) => {
      const point = Number.parseInt(code, 10);
      return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function attributes(tag: string): HtmlAttribute[] {
  const result: HtmlAttribute[] = [];
  const expression = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const body = tag.replace(/^<[^\s>]+/, "").replace(/>$/, "");
  for (const match of body.matchAll(expression)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    result.push({
      name,
      value: decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""),
    });
  }
  return result;
}

function attributeMap(tag: string): Map<string, string> {
  return new Map(attributes(tag).map(({ name, value }) => [name, value]));
}

function parsePrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
}

function variantImage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const image = variantImage(candidate);
      if (image) return image;
    }
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.imageUrl ?? record.url ?? record.src ?? record.image ?? record.thumbnail;
  return typeof candidate === "string" ? candidate : undefined;
}

function parseVariant(value: unknown): CandidateVariant | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const nameValue =
    record.name ??
    record.title ??
    record.label ??
    record.colorName ??
    record.color ??
    record.optionName ??
    record.variantName ??
    record.value ??
    record.skuPropertyName;
  if (typeof nameValue !== "string" || !nameValue.trim() || nameValue.length > 160) return null;
  const offers = Array.isArray(record.offers) ? record.offers[0] : record.offers;
  const offersRecord =
    offers && typeof offers === "object" && !Array.isArray(offers)
      ? (offers as Record<string, unknown>)
      : null;
  const rawPrice =
    record.priceUsd ??
    record.price ??
    record.sellPrice ??
    offersRecord?.price ??
    (offersRecord?.priceSpecification as Record<string, unknown> | undefined)?.price;
  const rawSku = record.sku ?? record.productId ?? record.variantSku ?? record.id;
  const image = variantImage(
    record.imageUrl ??
      record.swatchImageUrl ??
      record.image ??
      record.images ??
      record.productImage ??
      record.thumbnail ??
      record.src,
  );
  const price = parsePrice(rawPrice);
  return {
    name: cleanText(nameValue).slice(0, 160),
    ...(typeof rawSku === "string" && rawSku.length <= 100 ? { sku: rawSku } : {}),
    ...(price !== null ? { priceUsd: price } : {}),
    ...(image ? { imageUrl: image } : {}),
  };
}

function addVariant(page: PageData, value: unknown): void {
  const variant = parseVariant(value);
  if (variant) {
    page.variants.push(variant);
    if (variant.imageUrl) page.images.push(variant.imageUrl);
  }
}

function resolveImage(value: string, pageUrl: URL): string | null {
  const trimmed = value.trim().replace(/&amp;/g, "&");
  if (!trimmed || /^(?:data:|blob:)/i.test(trimmed)) return null;
  try {
    const imageUrl = new URL(trimmed, pageUrl);
    if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") return null;
    const hostname = imageUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      (isIP(hostname) !== 0 && isPrivateAddress(hostname))
    ) {
      return null;
    }
    if (/\.(?:svg|gif)(?:$|[?#])/i.test(imageUrl.pathname)) return null;
    const width = Number(imageUrl.searchParams.get("width") ?? imageUrl.searchParams.get("w"));
    if (width > 0 && width < 160) return null;
    if (/(?:logo|icon|avatar|badge|social|sprite|tracking-pixel|placeholder)/i.test(imageUrl.pathname)) {
      return null;
    }
    return imageUrl.toString();
  } catch {
    return null;
  }
}

function validImageUrls(images: string[], pageUrl: URL): string[] {
  const unique = new Set<string>();
  for (const value of images) {
    const imageUrl = resolveImage(value, pageUrl);
    if (imageUrl) unique.add(imageUrl);
    if (unique.size === 30) break;
  }
  return [...unique];
}

function collectProductJson(value: unknown, page: PageData): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectProductJson(entry, page);
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];
  const productType =
    typeValue === "Product" ||
    (Array.isArray(typeValue) && typeValue.includes("Product"));
  if (productType) {
    if (!page.title && typeof record.name === "string") page.title = cleanText(record.name);
    if (!page.description && typeof record.description === "string") page.description = cleanText(record.description);
    if (!page.sku && typeof record.sku === "string") page.sku = record.sku;
    const images = Array.isArray(record.image) ? record.image : [record.image];
    for (const image of images) {
      if (typeof image === "string") page.images.push(image);
      else if (image && typeof image === "object" && typeof (image as Record<string, unknown>).url === "string") {
        page.images.push((image as Record<string, string>).url);
      }
    }
    const offers = Array.isArray(record.offers) ? record.offers[0] : record.offers;
    if (offers && typeof offers === "object") {
      const price = (offers as Record<string, unknown>).price;
      page.price ??= parsePrice(price);
      const priceSpecification = (offers as Record<string, unknown>).priceSpecification;
      if (priceSpecification && typeof priceSpecification === "object") {
        page.price ??= parsePrice((priceSpecification as Record<string, unknown>).price);
      }
    }
  }

  for (const [key, nested] of Object.entries(record)) {
    if (/^(?:hasVariant|variantList|stanProducts|variants|productVariants|skuProps)$/i.test(key)) {
      for (const variant of Array.isArray(nested) ? nested : [nested]) addVariant(page, variant);
    }
    if (
      typeof nested === "string" &&
      /^(?:productNameEn|product_name|name)$/i.test(key) &&
      !page.title &&
      nested.length < 300
    ) {
      page.title = cleanText(nested);
    }
    if (/^(?:sellPrice|price|salePrice)$/i.test(key)) page.price ??= parsePrice(nested);
    if (/^(?:productImageSet|images|imageList|variantImages|productImage|image)$/i.test(key)) {
      const imageValues = Array.isArray(nested) ? nested : [nested];
      for (const image of imageValues) {
        if (typeof image === "string") page.images.push(image);
        else if (image && typeof image === "object") {
          const imageRecord = image as Record<string, unknown>;
          const imageUrl = imageRecord.imageUrl ?? imageRecord.url ?? imageRecord.src;
          if (typeof imageUrl === "string") page.images.push(imageUrl);
        }
      }
    }
    collectProductJson(nested, page);
  }
}

function inlineJsonString(source: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`"${escapedKey}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
  if (!match?.[1]) return null;
  try {
    const parsed: unknown = JSON.parse(match[1]);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function parseHtml(html: string, pageUrl: URL): PageData {
  const page: PageData = {
    title: null,
    description: null,
    price: null,
    sku: null,
    images: [],
    variants: [],
    text: "",
  };
  const metaTitle: string[] = [];
  const metaDescription: string[] = [];
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  for (const match of scripts) {
    const tag = `<script ${match[1] ?? ""}>`;
    const scriptAttrs = attributeMap(tag);
    const content = match[2] ?? "";
    const type = scriptAttrs.get("type")?.toLowerCase();
    const id = scriptAttrs.get("id")?.toLowerCase();
    if (type === "application/ld+json" || id === "__next_data__" || type?.includes("json")) {
      try {
        const parsed: unknown = JSON.parse(content.replace(/^\s*<!--|-->\s*$/g, ""));
        collectProductJson(parsed, page);
      } catch {
        // Inline scripts are also inspected below for common supplier JSON fields.
      }
    }
    if (!page.title) {
      const name = inlineJsonString(content, "productNameEn");
      if (name) page.title = cleanText(name);
    }
    const price = content.match(/"(?:sellPrice|price)"\s*:\s*"?([0-9.]+)"?/i)?.[1];
    page.price ??= parsePrice(price ?? null);
    const imageSet = content.match(/"productImageSet"\s*:\s*\[([\s\S]*?)\]/i)?.[1];
    if (imageSet) {
      try {
        const values: unknown = JSON.parse(`[${imageSet}]`);
        if (Array.isArray(values)) {
          for (const image of values) {
            if (typeof image === "string") page.images.push(image);
            else if (image && typeof image === "object") {
              const entry = image as Record<string, unknown>;
              const imageUrl = entry.imageUrl ?? entry.url ?? entry.src;
              if (typeof imageUrl === "string") page.images.push(imageUrl);
            }
          }
        }
      } catch {
        // The individual inline image URL fields are still inspected below.
      }
    }
    for (const field of ["productImageSet", "imageUrl", "originalImage", "bigImage", "productImage", "imgUrl"]) {
      const image = inlineJsonString(content, field);
      if (image) page.images.push(image);
    }
  }

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const meta = attributeMap(match[0]);
    const key = (meta.get("property") ?? meta.get("name") ?? meta.get("itemprop") ?? "").toLowerCase();
    const content = meta.get("content") ?? "";
    if (!content) continue;
    if (key === "og:title" || key === "twitter:title" || key === "title") metaTitle.push(content);
    if (key === "og:description" || key === "twitter:description" || key === "description") {
      metaDescription.push(content);
    }
    if (/^(?:og:image|twitter:image|twitter:image:src|product:image)$/i.test(key)) page.images.push(content);
    if (/^(?:product:price:amount|og:price:amount|price)$/i.test(key)) page.price ??= parsePrice(content);
    if (/^(?:product:sku|sku)$/i.test(key) && !page.sku) page.sku = content;
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const img = attributeMap(match[0]);
    const width = Number(img.get("width"));
    const height = Number(img.get("height"));
    const markedAsVariant =
      img.has("data-color") ||
      img.has("data-option") ||
      img.has("data-variant") ||
      /(?:color|colour|shade|style|size|variant|option|swatch)/i.test(
        `${img.get("class") ?? ""} ${img.get("role") ?? ""}`,
      );
    if (((width > 0 && width < 160) || (height > 0 && height < 120)) && !markedAsVariant) continue;
    const optionName =
      img.get("data-color") ??
      img.get("data-option") ??
      img.get("data-variant") ??
      img.get("data-value") ??
      img.get("aria-label") ??
      img.get("alt") ??
      img.get("title");
    const imageSrc =
      img.get("src") ?? img.get("data-src") ?? img.get("data-original") ?? img.get("data-lazy-src");
    if (
      optionName &&
      imageSrc &&
      markedAsVariant
    ) {
      addVariant(page, {
        name: optionName,
        sku: img.get("data-sku"),
        imageUrl: imageSrc,
      });
    }
    for (const source of ["src", "data-src", "data-original"]) {
      const src = img.get(source);
      if (src) page.images.push(src);
    }
    const srcset = img.get("srcset") ?? img.get("data-srcset");
    if (srcset) {
      const highest = srcset.split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
      page.images.push(...highest.slice(-3));
    }
  }

  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1];
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  page.title ??= cleanText(h1 ?? "") || cleanText(metaTitle[0] ?? "") || cleanText(titleTag ?? "") || null;
  page.description ??= cleanText(metaDescription[0] ?? "") || null;
  page.images = validImageUrls(page.images, pageUrl);
  page.variants = page.variants.flatMap((variant) => {
    const resolvedImage = variant.imageUrl ? resolveImage(variant.imageUrl, pageUrl) : null;
    const variantWithoutImage = { ...variant };
    delete variantWithoutImage.imageUrl;
    return [resolvedImage ? { ...variantWithoutImage, imageUrl: resolvedImage } : variantWithoutImage];
  });

  const visibleHtml = html
    .replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  page.text = cleanText(visibleHtml).slice(0, MAX_CONTEXT_LENGTH);
  return page;
}

function parseJinaText(text: string, pageUrl: URL): PageData {
  const title = text.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();
  const description =
    text.match(/(?:^|\n)(?:Description|Product description)\s*:\s*(.+)/i)?.[1]?.trim() ?? null;
  const priceMatch =
    text.match(/(?:US?\$|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)/)?.[1] ??
    text.match(/\b(?:price|sellPrice)\s*[:=]\s*([0-9]+(?:\.[0-9]{1,2})?)/i)?.[1];
  const images = [...text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/gi)]
    .map((match) => match[1] ?? "");
  for (const match of text.matchAll(/https?:\/\/[^\s)>"']+\.(?:jpe?g|png|webp)(?:\?[^\s)>"']*)?/gi)) {
    images.push(match[0]);
  }
  return {
    title: title ? cleanText(title) : null,
    description: description ? cleanText(description) : null,
    price: parsePrice(priceMatch ?? null),
    sku: text.match(/\b(?:SKU|Product ID)\s*:\s*([A-Za-z0-9-]+)/i)?.[1] ?? null,
    images: validImageUrls(images, pageUrl),
    variants: [],
    text: text.slice(0, MAX_CONTEXT_LENGTH),
  };
}

function readUrlSku(value: URL): string | null {
  const match = value.pathname.match(/-p-([A-Za-z0-9-]+)\.html/i);
  if (match?.[1]) return match[1].slice(0, 100);
  for (const key of ["pid", "id", "sku"]) {
    const param = value.searchParams.get(key)?.trim();
    if (param && /^[A-Za-z0-9-]{1,100}$/.test(param)) return param;
  }
  return null;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total <= maxBytes ? total : chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchPublicText(
  initialUrl: URL,
  timeoutMs: number,
  headers: HeadersInit,
  maxBytes: number,
): Promise<{ text: string; finalUrl: URL; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const timedOut = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(new Error("Product page request timed out.")),
      { once: true },
    );
  });
  try {
    let url = new URL(initialUrl);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      await Promise.race([validatePublicUrl(url), timedOut]);
      const response = await fetch(url, {
        headers,
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error("The product page redirected too many times.");
        url = new URL(location, url);
        continue;
      }
      return { text: await readLimitedBody(response, maxBytes), finalUrl: url, status: response.status };
    }
    throw new Error("The product page redirected too many times.");
  } finally {
    clearTimeout(timeout);
  }
}

function emptyPage(): PageData {
  return { title: null, description: null, price: null, sku: null, images: [], variants: [], text: "" };
}

function hasUsefulPageData(page: PageData): boolean {
  return Boolean(page.title || page.description || page.images.length || page.text.length >= 200);
}

function isBlockedPage(page: PageData): boolean {
  return /cloudflare|checking your browser|verify you are human|access denied|robot check|captcha|just a moment|attention required|automated requests|bot verification/i.test(
    [page.title, page.description, page.text].filter(Boolean).join(" "),
  );
}

export async function extractProductFromUrl(
  url: string,
  fallbackRawText?: string,
): Promise<ProductExtraction> {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(url.trim());
  } catch {
    throw new Error("Provide a valid HTTP or HTTPS product URL.");
  }
  await validatePublicUrl(sourceUrl);
  const extractedSku = readUrlSku(sourceUrl);
  let page = emptyPage();
  let method: ProductExtractionMethod = "none";

  try {
    const direct = await fetchPublicText(
      sourceUrl,
      DIRECT_TIMEOUT_MS,
      {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      MAX_HTML_BYTES,
    );
    if (direct.status < 400) {
      page = parseHtml(direct.text, direct.finalUrl);
      if (hasUsefulPageData(page)) method = "direct";
    }
  } catch {
    // The free reader is the intended fallback for blocked, timed-out, and unavailable pages.
  }

  const shouldUseReader =
    method === "none" || (page.text.length < 200 && !page.title) || isBlockedPage(page);
  if (shouldUseReader) {
    try {
      const readerResponse = await fetchPublicText(
        new URL(`https://r.jina.ai/${sourceUrl.toString()}`),
        JINA_TIMEOUT_MS,
        { Accept: "text/plain", "User-Agent": "RoamAndNestProductImporter/1.0" },
        MAX_HTML_BYTES,
      );
      if (readerResponse.status < 400) {
        const readerPage = parseJinaText(readerResponse.text, sourceUrl);
        if (hasUsefulPageData(readerPage) && !isBlockedPage(readerPage)) {
          page = readerPage;
          method = "jina";
        } else {
          page = emptyPage();
          method = "none";
        }
      } else {
        page = emptyPage();
        method = "none";
      }
    } catch {
      if (shouldUseReader) {
        page = emptyPage();
        method = "none";
      }
    }
  }

  const fallbackText = fallbackRawText?.trim().slice(0, MAX_CONTEXT_LENGTH) ?? "";
  if (fallbackText) {
    const fallbackPage = parseJinaText(fallbackText, sourceUrl);
    page = {
      title: page.title ?? fallbackPage.title,
      description: page.description ?? fallbackPage.description,
      price: page.price ?? fallbackPage.price,
      sku: page.sku ?? fallbackPage.sku,
      images: [...new Set([...page.images, ...fallbackPage.images])].slice(0, 30),
      variants: [...page.variants, ...fallbackPage.variants],
      text: [page.text, fallbackText].filter(Boolean).join("\n\n").slice(0, MAX_CONTEXT_LENGTH),
    };
    method = method === "direct" ? "direct+fallback" : method === "jina" ? "jina+fallback" : "fallback";
  }

  return {
    sourceUrl: sourceUrl.toString(),
    extractedSku: extractedSku ?? page.sku,
    rawTitle: page.title,
    rawDescription: page.description,
    extractedPriceUsd: page.price,
    candidateImageUrls: page.images,
    candidateVariants: page.variants.filter(
      (variant, index, variants) =>
        variants.findIndex(
          (other) =>
            other.name.toLowerCase() === variant.name.toLowerCase() &&
            (other.sku ?? "") === (variant.sku ?? "") &&
            (other.imageUrl ?? "") === (variant.imageUrl ?? ""),
        ) === index,
    ),
    pageContextText: page.text,
    extractionMethod: method,
  };
}

export const DEFAULT_PRODUCT_IMAGE_URL = FALLBACK_IMAGE;
