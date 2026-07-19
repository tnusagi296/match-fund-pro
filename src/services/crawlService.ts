// Frontend adapter around the existing Signal Crawl server function.
//
// This file intentionally does not touch the backend. It:
//  - wraps `crawlFounderGraph` (server function in src/lib/crawl.functions.ts)
//  - adds a client-side timeout,
//  - validates the response shape defensively,
//  - emits structured console diagnostics useful for backend debugging.
//
// TODO(backend): if/when the server function moves behind a different
// transport (edge function / REST route), swap the `invoke` implementation
// only — the CrawlResult contract stays the same for the UI.

import { crawlFounderGraph } from "@/lib/crawl.functions";

export type CrawlInput = {
  name: string;
  headline?: string;
  github: string;
  linkedin?: string;
  site?: string;
  deckText?: string;
};

export type CrawlResult = {
  profileId: string;
  signalCount: number;
  alreadyPublished: boolean;
  // Raw payload kept for future use; UI should read the fields above.
  raw: unknown;
};

export type CrawlFailure =
  | { kind: "timeout"; requestId: string; durationMs: number }
  | { kind: "network"; requestId: string; durationMs: number; message: string }
  | { kind: "invalid_response"; requestId: string; durationMs: number; message: string }
  | { kind: "server"; requestId: string; durationMs: number; message: string };

export class CrawlError extends Error {
  readonly failure: CrawlFailure;
  constructor(failure: CrawlFailure) {
    super(failure.kind);
    this.name = "CrawlError";
    this.failure = failure;
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

function newRequestId() {
  // Short, non-secret correlation id for logs.
  return Math.random().toString(36).slice(2, 10);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function assertCrawlResponse(payload: unknown): {
  profileId: string;
  signals: unknown[];
  alreadyPublished: boolean;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Response was not an object");
  }
  const p = payload as Record<string, unknown>;
  if (!isNonEmptyString(p.profileId)) {
    throw new Error("Response missing profileId");
  }
  if (!Array.isArray(p.signals)) {
    throw new Error("Response missing signals array");
  }
  return {
    profileId: p.profileId,
    signals: p.signals,
    alreadyPublished: Boolean(p.alreadyPublished),
  };
}

export type Invoker = (args: { data: CrawlInput; signal?: AbortSignal }) => Promise<unknown>;

export async function runFounderCrawl(
  input: CrawlInput,
  options: {
    /** Bound `useServerFn(crawlFounderGraph)` from the caller. */
    invoke?: Invoker;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<CrawlResult> {
  const requestId = newRequestId();
  const started = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const invoke: Invoker =
    options.invoke ?? ((args) => crawlFounderGraph(args as { data: CrawlInput }));

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  // Structured start log — cheap breadcrumb for backend debugging.
  // We intentionally do NOT log the deck text or full payload (may be private).
  // eslint-disable-next-line no-console
  console.info("[crawlService] start", {
    requestId,
    fn: "crawlFounderGraph",
    githubHandle: input.github,
    hasLinkedin: Boolean(input.linkedin),
    hasSite: Boolean(input.site),
    hasDeck: Boolean(input.deckText && input.deckText.trim().length > 0),
    timeoutMs,
  });

  try {
    const payload = await invoke({ data: input, signal: controller.signal });
    const durationMs = Math.round(performance.now() - started);

    let parsed;
    try {
      parsed = assertCrawlResponse(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn("[crawlService] invalid_response", {
        requestId,
        durationMs,
        message,
        payloadKeys:
          payload && typeof payload === "object" ? Object.keys(payload as object) : null,
      });
      throw new CrawlError({ kind: "invalid_response", requestId, durationMs, message });
    }

    // eslint-disable-next-line no-console
    console.info("[crawlService] success", {
      requestId,
      durationMs,
      profileId: parsed.profileId,
      signalCount: parsed.signals.length,
      alreadyPublished: parsed.alreadyPublished,
    });

    return {
      profileId: parsed.profileId,
      signalCount: parsed.signals.length,
      alreadyPublished: parsed.alreadyPublished,
      raw: payload,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    if (error instanceof CrawlError) throw error;

    const aborted =
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");

    if (aborted) {
      // eslint-disable-next-line no-console
      console.warn("[crawlService] timeout", { requestId, durationMs, timeoutMs });
      throw new CrawlError({ kind: "timeout", requestId, durationMs });
    }

    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn("[crawlService] failure", {
      requestId,
      durationMs,
      fn: "crawlFounderGraph",
      githubHandle: input.github,
      message,
    });
    // We cannot reliably distinguish network vs server without a status code
    // from the server-function transport. Bucket by heuristic on the message.
    const looksLikeNetwork = /network|fetch|failed to fetch|load failed/i.test(message);
    throw new CrawlError({
      kind: looksLikeNetwork ? "network" : "server",
      requestId,
      durationMs,
      message,
    });
  } finally {
    clearTimeout(timeoutHandle);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
