import { describe, expect, test } from "bun:test";
import fixture from "./fixtures/github-octocat.json";
import {
  GitHubGraphAdapter,
  parseGitHubLogin,
  stableGitHubEntityKey,
} from "../src/lib/graph/github-graph.server";
import {
  persistGraphIngestionWithStore,
  type GraphPersistenceStore,
} from "../src/lib/graph/persistence.server";
import { projectFounderCard } from "../src/lib/graph/projection";
import { calculateGraphThesisFit } from "../src/lib/graph/thesis-fit";
import { selectFounderFeed } from "../src/lib/graph/feed-selection";
import type {
  GraphClaimInput,
  GraphEntityInput,
  GraphEvidenceInput,
  GraphIdentifierInput,
  GraphIngestionResult,
  GraphProjectionSnapshot,
  GraphRelationshipInput,
} from "../src/lib/graph/types";
import { DEFAULT_THESIS } from "../src/lib/thesis";

const observedAt = "2026-07-19T09:00:00.000Z";

function fixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url === "https://api.github.com/users/octocat") {
    return Promise.resolve(Response.json(fixture.user));
  }
  if (url.startsWith("https://api.github.com/users/octocat/repos?")) {
    return Promise.resolve(Response.json(fixture.repositories));
  }
  return Promise.resolve(Response.json({ message: "Not Found" }, { status: 404 }));
}

async function normalizedFixture(): Promise<GraphIngestionResult> {
  const adapter = new GitHubGraphAdapter({
    fetchImpl: fixtureFetch as typeof fetch,
    now: () => new Date(observedAt),
  });
  return adapter.ingest({
    github: "https://github.com/octocat?tab=repositories",
    founderName: "The Octocat",
    headline: "AI infrastructure builder",
  });
}

function snapshotFromResult(result: GraphIngestionResult): GraphProjectionSnapshot {
  const entityIds = new Map(
    result.entities.map((entity) => [entity.tempId, `persisted:${entity.tempId}`]),
  );
  const evidenceIds = new Map(
    result.evidence.map((evidence) => [evidence.tempId, `persisted:${evidence.tempId}`]),
  );
  const relationshipIds = new Map(
    result.relationships.map((relationship) => [
      relationship.tempId,
      `persisted:${relationship.tempId}`,
    ]),
  );
  const claimIds = new Map(
    result.claims.map((claim) => [claim.tempId, `persisted:${claim.tempId}`]),
  );
  const founderInput = result.entities.find((entity) => entity.entityType === "founder");
  if (!founderInput) throw new Error("Fixture graph has no founder");
  const founderId = entityIds.get(founderInput.tempId)!;

  return {
    profile: {
      id: "11111111-1111-4111-8111-111111111111",
      graphEntityId: founderId,
      name: "The Octocat",
      headline: "AI infrastructure builder",
      github: "https://github.com/octocat",
      linkedin: null,
      site: null,
      summary: "Recorded graph fixture",
      updatedAt: observedAt,
    },
    entities: result.entities.map((entity) => ({
      id: entityIds.get(entity.tempId)!,
      entityType: entity.entityType,
      canonicalKey: entity.canonicalKey,
      canonicalName: entity.canonicalName,
      properties: entity.properties,
      updatedAt: observedAt,
    })),
    relationships: result.relationships.map((relationship) => ({
      id: relationshipIds.get(relationship.tempId)!,
      sourceEntityId: entityIds.get(relationship.sourceTempId)!,
      targetEntityId: entityIds.get(relationship.targetTempId)!,
      relationshipType: relationship.relationshipType,
      confidence: relationship.confidence,
      observedAt: relationship.observedAt,
      properties: relationship.properties,
    })),
    claims: result.claims.map((claim) => ({
      id: claimIds.get(claim.tempId)!,
      subjectEntityId: entityIds.get(claim.subjectTempId)!,
      predicate: claim.predicate,
      value: claim.value,
      status: claim.status,
      trustLevel: claim.trustLevel,
      observedAt: claim.observedAt,
    })),
    evidence: result.evidence.map((evidence) => ({
      id: evidenceIds.get(evidence.tempId)!,
      sourceType: evidence.sourceType,
      sourceUrl: evidence.sourceUrl,
      sourceExternalId: evidence.sourceExternalId,
      retrievedAt: evidence.retrievedAt,
      excerpt: evidence.excerpt,
      reliability: evidence.reliability,
      pageTitle: evidence.pageTitle,
      extractionMethod: evidence.extractionMethod,
      trustLevel: evidence.trustLevel,
      metadata: evidence.metadata,
    })),
    relationshipEvidence: result.relationships.flatMap((relationship) =>
      relationship.evidenceTempIds.map((evidenceTempId) => ({
        relationshipId: relationshipIds.get(relationship.tempId)!,
        evidenceId: evidenceIds.get(evidenceTempId)!,
      })),
    ),
    claimEvidence: result.claims.flatMap((claim) =>
      claim.evidenceTempIds.map((evidenceTempId) => ({
        claimId: claimIds.get(claim.tempId)!,
        evidenceId: evidenceIds.get(evidenceTempId)!,
      })),
    ),
  };
}

class MemoryGraphStore implements GraphPersistenceStore {
  private sequence = 0;
  readonly entities = new Map<string, string>();
  readonly identifiers = new Map<string, string>();
  readonly evidence = new Map<string, string>();
  readonly relationships = new Map<string, string>();
  readonly claims = new Map<string, string>();
  readonly relationshipEvidence = new Set<string>();
  readonly claimEvidence = new Set<string>();
  readonly profiles = new Map<string, string>();

  private id(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  findEntityByIdentifier(identifier: GraphIdentifierInput): Promise<string | null> {
    return Promise.resolve(
      this.identifiers.get(`${identifier.scheme}:${identifier.value}`) ?? null,
    );
  }

  upsertEntity(
    entity: GraphEntityInput,
    existingId: string | null,
  ): Promise<{ id: string; created: boolean }> {
    const key = `${entity.entityType}:${entity.canonicalKey}`;
    const found = existingId ?? this.entities.get(key);
    if (found) return Promise.resolve({ id: found, created: false });
    const id = this.id("entity");
    this.entities.set(key, id);
    return Promise.resolve({ id, created: true });
  }

  upsertIdentifier(entityId: string, identifier: GraphIdentifierInput): Promise<void> {
    this.identifiers.set(`${identifier.scheme}:${identifier.value}`, entityId);
    return Promise.resolve();
  }

  upsertEvidence(evidence: GraphEvidenceInput): Promise<{ id: string; created: boolean }> {
    const found = this.evidence.get(evidence.contentHash);
    if (found) return Promise.resolve({ id: found, created: false });
    const id = this.id("evidence");
    this.evidence.set(evidence.contentHash, id);
    return Promise.resolve({ id, created: true });
  }

  upsertRelationship(
    relationship: GraphRelationshipInput,
    sourceEntityId: string,
    targetEntityId: string,
  ): Promise<{ id: string; created: boolean }> {
    const key = `${sourceEntityId}:${targetEntityId}:${relationship.relationshipType}`;
    const found = this.relationships.get(key);
    if (found) return Promise.resolve({ id: found, created: false });
    const id = this.id("relationship");
    this.relationships.set(key, id);
    return Promise.resolve({ id, created: true });
  }

  linkRelationshipEvidence(relationshipId: string, evidenceId: string): Promise<void> {
    this.relationshipEvidence.add(`${relationshipId}:${evidenceId}`);
    return Promise.resolve();
  }

  upsertClaim(
    claim: GraphClaimInput,
    subjectEntityId: string,
  ): Promise<{ id: string; created: boolean }> {
    const key = `${subjectEntityId}:${claim.predicate}:${JSON.stringify(claim.value)}`;
    const found = this.claims.get(key);
    if (found) return Promise.resolve({ id: found, created: false });
    const id = this.id("claim");
    this.claims.set(key, id);
    return Promise.resolve({ id, created: true });
  }

  linkClaimEvidence(claimId: string, evidenceId: string): Promise<void> {
    this.claimEvidence.add(`${claimId}:${evidenceId}`);
    return Promise.resolve();
  }

  linkProfile(profileId: string, founderEntityId: string): Promise<void> {
    this.profiles.set(profileId, founderEntityId);
    return Promise.resolve();
  }
}

describe("GitHub URL parsing", () => {
  test("accepts usernames, @handles, and complete profile URLs", () => {
    expect(parseGitHubLogin("octocat")).toBe("octocat");
    expect(parseGitHubLogin("@octocat")).toBe("octocat");
    expect(parseGitHubLogin("https://github.com/octocat")).toBe("octocat");
    expect(parseGitHubLogin("github.com/octocat/?tab=repositories")).toBe("octocat");
  });

  test("rejects non-GitHub URLs and malformed logins", () => {
    expect(parseGitHubLogin("https://example.com/octocat")).toBeNull();
    expect(parseGitHubLogin("bad--handle!")).toBeNull();
  });
});

describe("GitHub graph normalization", () => {
  test("creates stable entities, claims, evidence, and only established ownership edges", async () => {
    const result = await normalizedFixture();
    expect(result.entities.filter((entity) => entity.entityType === "founder")).toHaveLength(1);
    expect(result.entities.filter((entity) => entity.entityType === "repository")).toHaveLength(3);
    expect(
      result.relationships.filter(
        (relationship) => relationship.relationshipType === "OWNS_REPOSITORY",
      ),
    ).toHaveLength(2);
    expect(
      result.relationships.some((relationship) => relationship.relationshipType === "BUILT"),
    ).toBe(false);
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence.every((evidence) => evidence.sourceUrl.startsWith("https://"))).toBe(
      true,
    );
    expect(result.claims.some((claim) => claim.predicate === "authored_code")).toBe(false);
  });

  test("uses GitHub numeric IDs as stable canonical keys", async () => {
    const result = await normalizedFixture();
    expect(stableGitHubEntityKey("user", 583231)).toBe("github:user:583231");
    expect(stableGitHubEntityKey("repository", 1296269)).toBe("github:repository:1296269");
    expect(result.entities.some((entity) => entity.canonicalKey === "github:user:583231")).toBe(
      true,
    );
    expect(
      result.entities.some((entity) => entity.canonicalKey === "github:repository:1296269"),
    ).toBe(true);
  });
});

test("re-ingestion updates stable records without duplicate entities or relationships", async () => {
  const result = await normalizedFixture();
  const store = new MemoryGraphStore();
  const profileId = "11111111-1111-4111-8111-111111111111";
  const first = await persistGraphIngestionWithStore(store, result, profileId);
  const second = await persistGraphIngestionWithStore(store, result, profileId);

  expect(first.summary.entitiesCreated).toBe(result.entities.length);
  expect(first.summary.relationshipsCreated).toBe(result.relationships.length);
  expect(second.summary.entitiesCreated).toBe(0);
  expect(second.summary.evidenceCreated).toBe(0);
  expect(second.summary.relationshipsCreated).toBe(0);
  expect(second.summary.claimsCreated).toBe(0);
  expect(store.entities.size).toBe(result.entities.length);
  expect(store.relationships.size).toBe(result.relationships.length);
});

describe("founder-card graph projection", () => {
  test("projects repositories, languages, topics, evidence coverage, and top signals", async () => {
    const card = projectFounderCard(snapshotFromResult(await normalizedFixture()));
    expect(card.repositoryCount).toBe(2);
    expect(card.mainLanguages).toEqual(["Python", "TypeScript"]);
    expect(card.topics).toContain("ai");
    expect(card.sourceCount).toBeGreaterThanOrEqual(3);
    expect(card.evidenceConfidence).toBe("High");
    expect(card.topSignals).toHaveLength(3);
    expect(card.founderScoreLabel).toBe("Insufficient evidence");
  });

  test("missing evidence results in Unknown Evidence Confidence", async () => {
    const snapshot = snapshotFromResult(await normalizedFixture());
    const card = projectFounderCard({
      ...snapshot,
      evidence: [],
      relationshipEvidence: [],
      claimEvidence: [],
    });
    expect(card.evidenceConfidence).toBe("Unknown");
    expect(card.sourceCount).toBe(0);
  });
});

test("Thesis Fit produces source-linked deterministic evidence paths and preserves unknowns", async () => {
  const card = projectFounderCard(snapshotFromResult(await normalizedFixture()));
  const fit = calculateGraphThesisFit(card, {
    ...DEFAULT_THESIS,
    sectors: ["AI"],
    geos: ["EU"],
    stages: ["Prototype"],
    keywords: ["infrastructure"],
    technicalBuilderRequired: true,
  });

  expect(fit.score).toBeGreaterThan(0);
  expect(fit.matchedCriteria.some((criterion) => criterion.includes("AI"))).toBe(true);
  expect(fit.unknownCriteria).toContain("Stage: not provided");
  expect(fit.evidencePaths.length).toBeGreaterThanOrEqual(3);
  expect(fit.evidencePaths.length).toBeLessThanOrEqual(5);
  for (const path of fit.evidencePaths) {
    expect(path.sourceUrl.startsWith("https://")).toBe(true);
    expect(path.observedAt).toBe(observedAt);
    expect(path.evidenceExcerpt.length).toBeGreaterThan(0);
  }
});

test("demo fallback is selected only when the graph feed is empty", () => {
  expect(selectFounderFeed(["live"], ["demo"])).toEqual({ mode: "graph", records: ["live"] });
  expect(selectFounderFeed([], ["demo"])).toEqual({ mode: "demo", records: ["demo"] });
});
