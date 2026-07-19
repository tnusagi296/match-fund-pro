import type { GraphIdentifierInput } from "@/lib/graph/types";
import {
  canonicalDomainUrl,
  canonicalHttpsUrl,
  normalizeLinkedInUrl,
  normalizeRedditUrl,
} from "./source-utils.server";

const PERSON_IDENTIFIER_SCHEMES = new Set<GraphIdentifierInput["scheme"]>([
  "github_user_id",
  "canonical_url",
  "personal_website_url",
  "linkedin_url",
  "reddit_url",
]);
const COMPANY_IDENTIFIER_SCHEMES = new Set<GraphIdentifierInput["scheme"]>([
  "company_website_url",
  "company_domain",
  "euid",
  "german_register_key",
]);

export type ResolvableIdentity = {
  entityId: string;
  canonicalName: string;
  entityKind?: "person" | "company";
  identifiers: GraphIdentifierInput[];
};

export type EntityResolution =
  | {
      decision: "reuse";
      entityId: string;
      matchedIdentifiers: GraphIdentifierInput[];
    }
  | {
      decision: "create";
      matchedIdentifiers: [];
    }
  | {
      decision: "ambiguous";
      entityIds: string[];
      reason: string;
      matchedIdentifiers: GraphIdentifierInput[];
    };

export function normalizeIdentityIdentifier(
  identifier: GraphIdentifierInput,
): GraphIdentifierInput | null {
  const raw = identifier.value.trim();
  if (!raw) return null;
  let value = raw;
  if (identifier.scheme === "github_login") value = raw.toLowerCase();
  if (
    [
      "canonical_url",
      "personal_website_url",
      "company_website_url",
      "accelerator_company_url",
      "accelerator_cohort_url",
    ].includes(identifier.scheme)
  ) {
    const normalized = canonicalHttpsUrl(raw);
    if (!normalized) return null;
    value = normalized;
  }
  if (identifier.scheme === "company_domain") {
    const normalized = canonicalDomainUrl(raw);
    if (!normalized) return null;
    value = new URL(normalized).hostname;
  }
  if (identifier.scheme === "linkedin_url") {
    const normalized = normalizeLinkedInUrl(raw);
    if (!normalized) return null;
    value = normalized;
  }
  if (identifier.scheme === "reddit_url") {
    const normalized = normalizeRedditUrl(raw);
    if (!normalized) return null;
    value = normalized;
  }
  if (["euid", "german_register_key"].includes(identifier.scheme)) value = raw.toUpperCase();
  return { scheme: identifier.scheme, value };
}

function key(identifier: GraphIdentifierInput): string {
  return `${identifier.scheme}:${identifier.value}`;
}

export class EntityResolutionService {
  resolve(
    candidate: {
      canonicalName: string;
      identifiers: GraphIdentifierInput[];
      entityKind?: "person" | "company";
    },
    existing: ResolvableIdentity[],
  ): EntityResolution {
    const identifiers = candidate.identifiers
      .map(normalizeIdentityIdentifier)
      .filter((item): item is GraphIdentifierInput => Boolean(item))
      .filter((item) =>
        (candidate.entityKind === "company"
          ? COMPANY_IDENTIFIER_SCHEMES
          : PERSON_IDENTIFIER_SCHEMES
        ).has(item.scheme),
      );
    const candidateKeys = new Set(identifiers.map(key));
    const matches = existing.flatMap((identity) => {
      if ((identity.entityKind ?? "person") !== (candidate.entityKind ?? "person")) return [];
      const matchedIdentifiers = identity.identifiers
        .map(normalizeIdentityIdentifier)
        .filter((item): item is GraphIdentifierInput => Boolean(item))
        .filter((item) => candidateKeys.has(key(item)));
      return matchedIdentifiers.length > 0 ? [{ identity, matchedIdentifiers }] : [];
    });
    const entityIds = [...new Set(matches.map((match) => match.identity.entityId))];
    const matchedIdentifiers = matches.flatMap((match) => match.matchedIdentifiers);
    if (entityIds.length === 1) {
      return { decision: "reuse", entityId: entityIds[0], matchedIdentifiers };
    }
    if (entityIds.length > 1) {
      return {
        decision: "ambiguous",
        entityIds,
        reason: "Stable identifiers resolve to multiple existing entities and require review.",
        matchedIdentifiers,
      };
    }

    // Names are deliberately ignored. Two people called Alex Smith remain two
    // identities until a stable cross-link is observed.
    return { decision: "create", matchedIdentifiers: [] };
  }
}
