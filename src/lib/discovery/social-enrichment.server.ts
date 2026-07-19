import type { GraphClaimInput, GraphIngestionResult } from "@/lib/graph/types";
import { graphEvidence, slug } from "./graph-builders.server";
import { fetchPublicJson } from "./safe-fetch.server";
import type { RedditConfiguration } from "./source-registry.server";
import { normalizeLinkedInUrl, normalizeRedditUrl } from "./source-utils.server";
import { DISCOVERY_LIMITS } from "./types";
import type { Candidate, EnrichmentAdapter, EnrichmentResult, SourceDiscoveryIssue } from "./types";

function issue(source: "linkedin_identifier" | "reddit", message: string): SourceDiscoveryIssue {
  return {
    source,
    query: source === "linkedin_identifier" ? "identifier only" : "linked Reddit account",
    status: null,
    message,
    rateLimited: false,
    rateLimitResetAt: null,
  };
}

export class LinkedInIdentifierAdapter implements EnrichmentAdapter {
  supports(candidate: Candidate): boolean {
    return Boolean(candidate.urls?.linkedin && normalizeLinkedInUrl(candidate.urls.linkedin));
  }

  enrich(candidate: Candidate): Promise<EnrichmentResult> {
    const value = candidate.urls?.linkedin ? normalizeLinkedInUrl(candidate.urls.linkedin) : null;
    return Promise.resolve({
      source: "linkedin_identifier",
      status: value ? "completed" : "failed",
      candidate,
      graph: { entities: [], relationships: [], claims: [], evidence: [] },
      identifiers: value ? [{ scheme: "linkedin_url", value }] : [],
      pagesFetched: 0,
      issues: value ? [] : [issue("linkedin_identifier", "LinkedIn URL could not be normalized.")],
    });
  }
}

type RedditAdapterOptions = {
  configuration: RedditConfiguration | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type RedditListing = {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        permalink?: string;
        created_utc?: number;
      };
    }>;
  };
};

export class RedditEnrichmentAdapter implements EnrichmentAdapter {
  private readonly now: () => Date;

  constructor(private readonly options: RedditAdapterOptions) {
    this.now = options.now ?? (() => new Date());
  }

  supports(candidate: Candidate): boolean {
    return Boolean(candidate.urls?.reddit && normalizeRedditUrl(candidate.urls.reddit));
  }

  async enrich(candidate: Candidate): Promise<EnrichmentResult> {
    const redditUrl = candidate.urls?.reddit ? normalizeRedditUrl(candidate.urls.reddit) : null;
    if (!redditUrl) {
      return {
        source: "reddit",
        status: "failed",
        candidate,
        graph: { entities: [], relationships: [], claims: [], evidence: [] },
        identifiers: [],
        pagesFetched: 0,
        issues: [issue("reddit", "Reddit URL could not be normalized.")],
      };
    }
    if (!this.options.configuration) {
      return {
        source: "reddit",
        status: "disabled_unconfigured",
        candidate,
        graph: { entities: [], relationships: [], claims: [], evidence: [] },
        identifiers: [{ scheme: "reddit_url", value: redditUrl }],
        pagesFetched: 0,
        issues: [
          issue(
            "reddit",
            "Reddit API access is unconfigured; the cross-linked URL remains an identifier only.",
          ),
        ],
      };
    }
    const founder = candidate.graph?.entities.find((entity) => entity.entityType === "founder");
    if (!founder) {
      return {
        source: "reddit",
        status: "partial",
        candidate,
        graph: { entities: [], relationships: [], claims: [], evidence: [] },
        identifiers: [{ scheme: "reddit_url", value: redditUrl }],
        pagesFetched: 0,
        issues: [
          issue("reddit", "Reddit activity was not attached without a resolved founder identity."),
        ],
      };
    }
    const username = new URL(redditUrl).pathname.split("/").filter(Boolean).at(-1)!;
    const apiUrl = new URL(
      `/user/${encodeURIComponent(username)}/submitted`,
      this.options.configuration.apiBaseUrl,
    );
    apiUrl.searchParams.set("limit", String(DISCOVERY_LIMITS.maxRedditItems));
    apiUrl.searchParams.set("raw_json", "1");
    let listing: RedditListing;
    try {
      listing = (
        await fetchPublicJson<RedditListing>(apiUrl.href, {
          fetchImpl: this.options.fetchImpl,
          headers: { Authorization: `Bearer ${this.options.configuration.apiToken}` },
        })
      ).value;
    } catch (error) {
      return {
        source: "reddit",
        status: "failed",
        candidate,
        graph: { entities: [], relationships: [], claims: [], evidence: [] },
        identifiers: [{ scheme: "reddit_url", value: redditUrl }],
        pagesFetched: 0,
        issues: [
          issue("reddit", error instanceof Error ? error.message : "Reddit API request failed."),
        ],
      };
    }
    const children = (listing.data?.children ?? []).slice(0, DISCOVERY_LIMITS.maxRedditItems);
    const observedAt = this.now().toISOString();
    const claims: GraphClaimInput[] = [];
    const evidence = children.flatMap((child, index) => {
      const post = child.data;
      if (!post?.id || !post.title || !post.permalink) return [];
      const sourceUrl = `https://www.reddit.com${post.permalink}`;
      const evidenceTempId = `evidence:reddit:${slug(post.id)}`;
      claims.push({
        tempId: `claim:${founder.tempId}:reddit-activity:${slug(post.id)}`,
        subjectTempId: founder.tempId,
        predicate: "linked_reddit_public_activity",
        value: { title: post.title, sourceUrl },
        status: "supported",
        trustLevel: "low",
        observedAt,
        evidenceTempIds: [evidenceTempId],
      });
      return [
        graphEvidence({
          tempId: evidenceTempId,
          sourceType: "reddit_api",
          sourceUrl,
          sourceExternalId: post.id,
          retrievedAt: observedAt,
          excerpt: `${post.title}${post.selftext ? ` — ${post.selftext.slice(0, 500)}` : ""}`,
          rawPayload: {
            id: post.id,
            title: post.title,
            createdUtc: post.created_utc ?? null,
            permalink: post.permalink,
          },
          reliability: 0.4,
          pageTitle: post.title,
          extractionMethod: "reddit_api_bounded_linked_account",
          trustLevel: "low",
          sourceName: `Reddit u/${username}`,
          metadata: { identityTrust: "low", itemIndex: index },
        }),
      ];
    });
    const graph: GraphIngestionResult = {
      entities: [
        {
          ...founder,
          identifiers: [...founder.identifiers, { scheme: "reddit_url", value: redditUrl }],
        },
      ],
      relationships: [],
      claims,
      evidence,
    };
    return {
      source: "reddit",
      status: "completed",
      candidate,
      graph,
      identifiers: [{ scheme: "reddit_url", value: redditUrl }],
      pagesFetched: children.length,
      issues: [],
    };
  }
}
