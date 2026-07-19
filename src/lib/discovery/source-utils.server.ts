export type HtmlAnchor = { href: string; text: string; attributes: string };

export function contentHash(value: string): string {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `matchfund-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function visibleText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function pageTitle(html: string): string | null {
  const value = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return value ? visibleText(value) : null;
}

export function metaContent(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = attribute(tag, "property") ?? attribute(tag, "name");
    if (property?.toLowerCase() !== key.toLowerCase()) continue;
    return attribute(tag, "content");
  }
  return null;
}

export function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2] ? decodeHtml(match[2].trim()) : null;
}

export function anchors(html: string, baseUrl: string): HtmlAnchor[] {
  const output: HtmlAnchor[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const href = attribute(match[1] ?? "", "href");
    if (!href) continue;
    try {
      output.push({
        href: new URL(href, baseUrl).href,
        text: visibleText(match[2] ?? ""),
        attributes: match[1] ?? "",
      });
    } catch {
      // Invalid links are ignored instead of becoming identifiers.
    }
  }
  return output;
}

export function jsonLdObjects(html: string): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1] ?? "null") as unknown;
      const values = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "@graph" in parsed
          ? ((parsed as { "@graph"?: unknown[] })["@graph"] ?? [])
          : [parsed];
      for (const value of values) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          output.push(value as Record<string, unknown>);
        }
      }
    } catch {
      // Invalid JSON-LD is not trusted as structured evidence.
    }
  }
  return output;
}

function privateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
  );
}

export function isPublicNetworkUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    privateIpv4(hostname)
  ) {
    return false;
  }
  if (hostname.includes(":")) {
    const compact = hostname.toLowerCase();
    if (
      compact === "::1" ||
      compact.startsWith("fc") ||
      compact.startsWith("fd") ||
      compact.startsWith("fe8")
    ) {
      return false;
    }
  }
  return true;
}

export function canonicalHttpsUrl(value: string): string | null {
  if (!isPublicNetworkUrl(value)) return null;
  const url = new URL(value);
  url.protocol = "https:";
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.port === "80" || url.port === "443") url.port = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

export function canonicalDomainUrl(value: string): string | null {
  const canonical = canonicalHttpsUrl(value);
  if (!canonical) return null;
  const url = new URL(canonical);
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}/`;
}

export function normalizeLinkedInUrl(value: string): string | null {
  const canonical = canonicalHttpsUrl(value);
  if (!canonical) return null;
  const url = new URL(canonical);
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/(in|company)\/([^/?#]+)/i);
  if (!match) return null;
  return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`;
}

export function normalizeRedditUrl(value: string): string | null {
  const canonical = canonicalHttpsUrl(value);
  if (!canonical) return null;
  const url = new URL(canonical);
  if (!/(^|\.)reddit\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/(?:u|user)\/([^/?#]+)/i);
  if (!match) return null;
  return `https://www.reddit.com/user/${match[1]}/`;
}

export function isLinkedInUrl(value: string): boolean {
  return normalizeLinkedInUrl(value) !== null;
}

export function isRedditUrl(value: string): boolean {
  return normalizeRedditUrl(value) !== null;
}
