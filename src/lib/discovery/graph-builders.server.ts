import type { Json } from "@/integrations/supabase/types";
import { parseGitHubLogin } from "@/lib/graph/github-graph.server";
import type {
  GraphEntityInput,
  GraphEvidenceInput,
  GraphIdentifierInput,
  GraphIngestionResult,
  TrustLevel,
} from "@/lib/graph/types";
import {
  canonicalDomainUrl,
  canonicalHttpsUrl,
  contentHash,
  normalizeLinkedInUrl,
  normalizeRedditUrl,
} from "./source-utils.server";

export function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9+#.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

export function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function identifierForUrl(value: string): GraphIdentifierInput | null {
  const githubLogin = parseGitHubLogin(value);
  if (githubLogin && /github\.com/i.test(value)) {
    return { scheme: "github_login", value: githubLogin.toLowerCase() };
  }
  const linkedin = normalizeLinkedInUrl(value);
  if (linkedin) return { scheme: "linkedin_url", value: linkedin };
  const reddit = normalizeRedditUrl(value);
  if (reddit) return { scheme: "reddit_url", value: reddit };
  const canonical = canonicalHttpsUrl(value);
  return canonical ? { scheme: "personal_website_url", value: canonical } : null;
}

export function founderEntity(
  tempId: string,
  name: string,
  identifiers: GraphIdentifierInput[],
  properties: Record<string, unknown> = {},
): GraphEntityInput {
  const stable = identifiers[0];
  if (!stable) throw new Error(`Founder ${name} has no stable public identifier.`);
  return {
    tempId,
    entityType: "founder",
    canonicalKey: `${stable.scheme}:${slug(stable.value)}`,
    canonicalName: name,
    properties: asJson(properties),
    identifiers,
  };
}

export function websiteEntity(
  tempId: string,
  value: string,
  name: string,
  kind: "personal" | "company",
): GraphEntityInput | null {
  const url = canonicalDomainUrl(value);
  if (!url) return null;
  const domain = new URL(url).hostname;
  return {
    tempId,
    entityType: "website",
    canonicalKey: `website:${domain}`,
    canonicalName: name,
    properties: { url, domain, kind },
    identifiers: [{ scheme: "canonical_url", value: url }],
  };
}

export function graphEvidence(input: {
  tempId: string;
  sourceType: string;
  sourceUrl: string;
  sourceExternalId?: string | null;
  retrievedAt: string;
  excerpt: string;
  rawPayload: unknown;
  reliability: number;
  pageTitle?: string | null;
  extractionMethod: string;
  trustLevel: TrustLevel | "self_reported";
  sourceName: string;
  metadata?: Record<string, unknown>;
}): GraphEvidenceInput {
  const payload = asJson(input.rawPayload);
  return {
    tempId: input.tempId,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    sourceExternalId: input.sourceExternalId ?? null,
    retrievedAt: input.retrievedAt,
    excerpt: input.excerpt,
    rawPayload: payload,
    contentHash: contentHash(
      JSON.stringify({
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourceExternalId: input.sourceExternalId ?? null,
        excerpt: input.excerpt,
        payload,
      }),
    ),
    reliability: input.reliability,
    pageTitle: input.pageTitle ?? null,
    extractionMethod: input.extractionMethod,
    trustLevel: input.trustLevel,
    metadata: asJson({ sourceName: input.sourceName, ...(input.metadata ?? {}) }),
  };
}

export function mergeGraphs(...graphs: GraphIngestionResult[]): GraphIngestionResult {
  const uniqueBy = <T extends { tempId: string }>(values: T[]) => [
    ...new Map(values.map((item) => [item.tempId, item])).values(),
  ];
  return {
    entities: uniqueBy(graphs.flatMap((graph) => graph.entities)),
    relationships: uniqueBy(graphs.flatMap((graph) => graph.relationships)),
    claims: uniqueBy(graphs.flatMap((graph) => graph.claims)),
    evidence: uniqueBy(graphs.flatMap((graph) => graph.evidence)),
  };
}

export function coalesceCandidateFounder(graph: GraphIngestionResult): GraphIngestionResult {
  const founders = graph.entities.filter((entity) => entity.entityType === "founder");
  if (founders.length <= 1) return graph;
  const primary =
    founders.find((founder) =>
      founder.identifiers.some((identifier) => identifier.scheme === "github_user_id"),
    ) ?? founders[0];
  const identifierKeys = new Set(
    primary.identifiers.map(
      (identifier) => `${identifier.scheme}:${identifier.value.toLowerCase()}`,
    ),
  );
  for (const founder of founders) {
    if (founder === primary) continue;
    const overlaps = founder.identifiers.some((identifier) =>
      identifierKeys.has(`${identifier.scheme}:${identifier.value.toLowerCase()}`),
    );
    if (!overlaps) {
      throw new Error(
        "Multiple founder nodes lack a stable cross-source identifier and were not merged.",
      );
    }
    for (const identifier of founder.identifiers) {
      identifierKeys.add(`${identifier.scheme}:${identifier.value.toLowerCase()}`);
    }
  }
  const replacements = new Map(founders.map((founder) => [founder.tempId, primary.tempId]));
  const properties = founders.reduce<Record<string, Json | undefined>>((combined, founder) => {
    if (
      founder.properties &&
      typeof founder.properties === "object" &&
      !Array.isArray(founder.properties)
    ) {
      Object.assign(combined, founder.properties);
    }
    return combined;
  }, {});
  const mergedPrimary: GraphEntityInput = {
    ...primary,
    properties,
    identifiers: [
      ...new Map(
        founders
          .flatMap((founder) => founder.identifiers)
          .map((identifier) => [
            `${identifier.scheme}:${identifier.value.toLowerCase()}`,
            identifier,
          ]),
      ).values(),
    ],
  };
  return {
    entities: [
      mergedPrimary,
      ...graph.entities.filter((entity) => entity.entityType !== "founder"),
    ],
    relationships: graph.relationships.map((relationship) => ({
      ...relationship,
      sourceTempId: replacements.get(relationship.sourceTempId) ?? relationship.sourceTempId,
      targetTempId: replacements.get(relationship.targetTempId) ?? relationship.targetTempId,
    })),
    claims: graph.claims.map((claim) => ({
      ...claim,
      subjectTempId: replacements.get(claim.subjectTempId) ?? claim.subjectTempId,
    })),
    evidence: graph.evidence,
  };
}
