import { lookup } from "node:dns/promises";
import { DISCOVERY_LIMITS } from "./types";
import { canonicalHttpsUrl, isPublicNetworkUrl } from "./source-utils.server";

export class SourceFetchError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "SourceFetchError";
  }
}

export type SafeFetchOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  resolveDns?: boolean;
  allowedOrigins?: string[];
};

async function assertPublicDns(url: URL): Promise<void> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(":")) return;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new SourceFetchError(`Could not resolve public source host ${url.hostname}.`);
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => {
      const host = address.includes(":") ? `[${address}]` : address;
      return !isPublicNetworkUrl(`https://${host}/`);
    })
  ) {
    throw new SourceFetchError("Source URL resolves to a private or reserved network address.");
  }
}

async function fetchBounded(
  input: string,
  options: SafeFetchOptions,
  accept: string,
): Promise<{ response: Response; body: Uint8Array; canonicalUrl: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? DISCOVERY_LIMITS.maxWebsiteResponseBytes;
  const maxRedirects = options.maxRedirects ?? DISCOVERY_LIMITS.maxRedirects;
  let current = canonicalHttpsUrl(input);
  if (!current) throw new SourceFetchError("Source URL must be a public HTTP(S) URL.");

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const currentUrl = new URL(current);
    if (options.allowedOrigins && !options.allowedOrigins.includes(currentUrl.origin)) {
      throw new SourceFetchError("Source redirect left the configured same-domain boundary.");
    }
    if (options.resolveDns ?? options.fetchImpl === undefined) await assertPublicDns(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? DISCOVERY_LIMITS.fetchTimeoutMs,
    );
    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: accept,
          "User-Agent": "MatchFund-bounded-public-evidence/1.0",
          ...options.headers,
        },
      });
    } catch (error) {
      throw new SourceFetchError(
        error instanceof Error
          ? `Public source request failed: ${error.message}`
          : "Public source request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new SourceFetchError("Source redirect did not include a destination.");
      if (redirectCount === maxRedirects)
        throw new SourceFetchError("Source redirect limit exceeded.");
      const next = canonicalHttpsUrl(new URL(location, currentUrl).href);
      if (!next) throw new SourceFetchError("Source redirected to a non-public URL.");
      if (options.allowedOrigins && !options.allowedOrigins.includes(new URL(next).origin)) {
        throw new SourceFetchError("Source redirect left the configured same-domain boundary.");
      }
      current = next;
      continue;
    }
    if (!response.ok) {
      throw new SourceFetchError(
        `Public source returned HTTP ${response.status}.`,
        response.status,
      );
    }
    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      throw new SourceFetchError("Public source response exceeds the configured size limit.");
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > maxBytes) {
      throw new SourceFetchError("Public source response exceeds the configured size limit.");
    }
    return { response, body, canonicalUrl: current };
  }
  throw new SourceFetchError("Source redirect limit exceeded.");
}

export async function fetchPublicHtml(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ html: string; canonicalUrl: string; contentType: string }> {
  const result = await fetchBounded(url, options, "text/html,application/xhtml+xml");
  const contentType = result.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("xhtml")) {
    throw new SourceFetchError("Public source did not return HTML.");
  }
  return {
    html: new TextDecoder().decode(result.body),
    canonicalUrl: result.canonicalUrl,
    contentType,
  };
}

export async function fetchPublicJson<T>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ value: T; canonicalUrl: string }> {
  const result = await fetchBounded(url, options, "application/json");
  try {
    return {
      value: JSON.parse(new TextDecoder().decode(result.body)) as T,
      canonicalUrl: result.canonicalUrl,
    };
  } catch {
    throw new SourceFetchError("Configured source did not return valid JSON.");
  }
}

export async function fetchPublicText(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ text: string; canonicalUrl: string; contentType: string }> {
  const result = await fetchBounded(url, options, "text/plain,text/html;q=0.8");
  const contentType = result.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("text/plain") && !contentType.includes("text/html")) {
    throw new SourceFetchError("Public source did not return text.");
  }
  return {
    text: new TextDecoder().decode(result.body),
    canonicalUrl: result.canonicalUrl,
    contentType,
  };
}
