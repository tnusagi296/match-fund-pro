import { describe, expect, test } from "bun:test";
import {
  HackathonEvidenceAdapter,
  canonicalizePublicUrl,
  type HackathonExtraction,
} from "../src/lib/graph/hackathon-evidence.server";
import {
  persistGraphIngestionWithStore,
  type GraphPersistenceStore,
} from "../src/lib/graph/persistence.server";
import { projectFounderCard } from "../src/lib/graph/projection";
import { calculateGraphThesisFit } from "../src/lib/graph/thesis-fit";
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

const observedAt = "2026-07-19T11:00:00.000Z";
const profileId = "22222222-2222-4222-8222-222222222222";

const founder: GraphEntityInput = {
  tempId: "founder:583231",
  entityType: "founder",
  canonicalKey: "github:user:583231",
  canonicalName: "The Octocat",
  properties: {
    githubUserId: 583231,
    githubLogin: "octocat",
    githubUrl: "https://github.com/octocat",
    avatarUrl: null,
    location: null,
  },
  identifiers: [
    { scheme: "github_user_id", value: "583231" },
    { scheme: "github_login", value: "octocat" },
  ],
};

async function fixture(name: string): Promise<string> {
  return Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).text();
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function fixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url === "https://projects.example.test/matchfund") {
    return htmlResponse(await fixture("hackathon-project-finalist.html"));
  }
  if (url === "https://projects.example.test/signal-forge") {
    return htmlResponse(await fixture("hackathon-project-winner.html"));
  }
  if (url === "https://projects.example.test/matchfund-unlinked") {
    return htmlResponse(await fixture("hackathon-project-unlinked-founder.html"));
  }
  if (url === "https://projects.example.test/empty") {
    return htmlResponse(await fixture("hackathon-empty.html"));
  }
  if (url === "https://projects.example.test/quiet-project") {
    return htmlResponse(await fixture("hackathon-project-no-result.html"));
  }
  if (url === "https://events.example.test/hack-nation-2026") {
    return htmlResponse(await fixture("hackathon-event.html"));
  }
  if (url === "https://events.example.test/build-weekend-2026") {
    const eventHtml = (await fixture("hackathon-event.html"))
      .replaceAll("Hack Nation", "Build Weekend")
      .replaceAll("hack-nation", "build-weekend");
    return htmlResponse(eventHtml);
  }
  return new Response("Not found", { status: 404 });
}

function adapter(
  aiExtractor?: (sources: never[], input: never) => Promise<HackathonExtraction | null>,
): HackathonEvidenceAdapter {
  return new HackathonEvidenceAdapter({
    fetchImpl: fixtureFetch as typeof fetch,
    now: () => new Date(observedAt),
    validateDns: false,
    useAi: Boolean(aiExtractor),
    aiExtractor: aiExtractor as ConstructorParameters<
      typeof HackathonEvidenceAdapter
    >[0]["aiExtractor"],
  });
}

async function finalistGraph() {
  return adapter().ingest({
    projectUrl: "http://projects.example.test/matchfund?utm_source=test#details",
    eventUrl: "https://events.example.test/hack-nation-2026/",
    eventName: "Hack Nation 2026",
    projectName: "MatchFund",
    claimedRole: "Data layer builder",
    claimedResult: "finalist",
    founder,
  });
}

function properties(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const founderInput = result.entities.find((entity) => entity.entityType === "founder")!;
  const founderId = entityIds.get(founderInput.tempId)!;
  return {
    profile: {
      id: profileId,
      graphEntityId: founderId,
      name: "The Octocat",
      headline: "AI infrastructure builder",
      github: "https://github.com/octocat",
      linkedin: null,
      site: null,
      summary: "Graph-backed founder fixture",
      updatedAt: observedAt,
      profileOrigin: "founder_submission",
      claimStatus: "self_submitted",
      visibilityState: "published",
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

  upsertEntity(entity: GraphEntityInput, existingId: string | null) {
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

  upsertEvidence(evidence: GraphEvidenceInput) {
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
  ) {
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

  upsertClaim(claim: GraphClaimInput, subjectEntityId: string) {
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

  linkProfile(id: string, founderEntityId: string): Promise<void> {
    this.profiles.set(id, founderEntityId);
    return Promise.resolve();
  }
}

describe("hackathon source normalization", () => {
  test("canonicalizes to HTTPS and removes tracking fragments", () => {
    expect(canonicalizePublicUrl("http://Projects.Example.test/matchfund/?utm_source=x#team")).toBe(
      "https://projects.example.test/matchfund",
    );
    expect(() => canonicalizePublicUrl("http://127.0.0.1/project")).toThrow();
  });

  test("verifies linked founder participation and explicit project submission", async () => {
    const result = await finalistGraph();
    const contribution = result.relationships.find(
      (relationship) => relationship.relationshipType === "CONTRIBUTED_TO",
    )!;
    const participation = result.relationships.find(
      (relationship) => relationship.relationshipType === "PARTICIPATED_IN",
    )!;
    const submission = result.relationships.find(
      (relationship) => relationship.relationshipType === "SUBMITTED_TO",
    )!;
    expect(properties(contribution.properties).verificationStatus).toBe("supported");
    expect(properties(participation.properties).verificationStatus).toBe("supported");
    expect(properties(submission.properties).verificationStatus).toBe("supported");
    expect(result.verification.verified.some((item) => item.includes("linked"))).toBe(true);
    expect(
      result.relationships.every((relationship) => relationship.evidenceTempIds.length > 0),
    ).toBe(true);
    expect(result.claims.every((claim) => claim.evidenceTempIds.length > 0)).toBe(true);
  });

  test("persists only source-explicit finalist and winner results", async () => {
    const finalist = await finalistGraph();
    expect(
      finalist.relationships.some(
        (relationship) => relationship.relationshipType === "FINALIST_AT",
      ),
    ).toBe(true);
    expect(
      finalist.relationships.some((relationship) => relationship.relationshipType === "WON_AT"),
    ).toBe(false);

    const winner = await adapter().ingest({
      projectUrl: "https://projects.example.test/signal-forge",
      eventUrl: "https://events.example.test/build-weekend-2026",
      projectName: "Signal Forge",
      eventName: "Build Weekend 2026",
      claimedResult: "winner",
      founder,
    });
    expect(
      winner.relationships.some((relationship) => relationship.relationshipType === "WON_AT"),
    ).toBe(true);
  });
});

describe("trust boundaries", () => {
  test("keeps a verified project but an unlinked founder relationship self-reported", async () => {
    const result = await adapter().ingest({
      projectUrl: "https://projects.example.test/matchfund-unlinked",
      eventName: "Hack Nation 2026",
      projectName: "MatchFund",
      claimedRole: "Founder",
      founder,
    });
    const projectIdentity = result.claims.find((claim) => claim.predicate === "project_identity")!;
    const contribution = result.relationships.find(
      (relationship) => relationship.relationshipType === "CONTRIBUTED_TO",
    )!;
    expect(projectIdentity.status).toBe("supported");
    expect(properties(contribution.properties).verificationStatus).toBe("self_reported");
    expect(
      result.verification.selfReported.some((item) => item.includes("no reliably linked profile")),
    ).toBe(true);
    const card = projectFounderCard(snapshotFromResult(result));
    const fit = calculateGraphThesisFit(card, {
      ...DEFAULT_THESIS,
      keywords: ["Supabase"],
      stages: ["Hackathon"],
      technicalBuilderRequired: true,
    });
    expect(
      fit.evidencePaths.some((path) => /SUBMITTED_TO|USES_TECHNOLOGY/.test(path.graphStep)),
    ).toBe(false);
  });

  test("stores unsupported role and result as self-reported", async () => {
    const result = await adapter().ingest({
      projectUrl: "https://projects.example.test/matchfund-unlinked",
      eventName: "Hack Nation 2026",
      claimedRole: "Product lead",
      claimedResult: "winner",
      founder,
    });
    expect(
      result.claims.find((claim) => claim.predicate === "founder_claimed_project_role")?.status,
    ).toBe("self_reported");
    expect(
      result.claims.find((claim) => claim.predicate === "founder_claimed_hackathon_result")?.status,
    ).toBe("self_reported");
    expect(
      result.relationships.some((relationship) => relationship.relationshipType === "WON_AT"),
    ).toBe(false);
  });

  test("marks a claimed winner as contradicted by an explicit finalist result", async () => {
    const result = await adapter().ingest({
      projectUrl: "https://projects.example.test/matchfund",
      eventUrl: "https://events.example.test/hack-nation-2026",
      claimedResult: "winner",
      founder,
    });
    const claim = result.claims.find(
      (candidate) => candidate.predicate === "founder_claimed_hackathon_result",
    );
    expect(claim?.status).toBe("contradicted");
    expect(
      result.relationships.some((relationship) => relationship.relationshipType === "WON_AT"),
    ).toBe(false);
    expect(
      result.relationships.some((relationship) => relationship.relationshipType === "FINALIST_AT"),
    ).toBe(true);
  });

  test("rejects fabricated AI result proposals", async () => {
    const fabricated: HackathonExtraction = {
      event: {
        name: "Hack Nation 2026",
        canonicalUrl: null,
        organizer: null,
        startDate: null,
        endDate: null,
      },
      project: {
        name: "Quiet Project",
        canonicalUrl: "https://projects.example.test/quiet-project",
        description: null,
        technologies: [],
      },
      participants: [],
      result: {
        type: "winner",
        label: "Imaginary winner",
        supportingExcerpt: "Quiet Project won an imaginary global prize.",
      },
      evidence: [
        {
          claimType: "result",
          sourceUrl: "https://projects.example.test/quiet-project",
          excerpt: "Quiet Project won an imaginary global prize.",
        },
      ],
    };
    const result = await adapter(async () => fabricated).ingest({
      projectUrl: "https://projects.example.test/quiet-project",
      founder,
    });
    expect(result.extraction.result.type).toBe("unknown");
    expect(
      result.relationships.some((relationship) => relationship.relationshipType === "WON_AT"),
    ).toBe(false);
  });
});

test("re-ingestion creates zero duplicate graph records", async () => {
  const result = await finalistGraph();
  const store = new MemoryGraphStore();
  const first = await persistGraphIngestionWithStore(store, result, profileId);
  const second = await persistGraphIngestionWithStore(store, result, profileId);
  expect(first.summary.projectsFound).toBe(1);
  expect(first.summary.hackathonsFound).toBe(1);
  expect(second.summary.entitiesCreated).toBe(0);
  expect(second.summary.evidenceCreated).toBe(0);
  expect(second.summary.relationshipsCreated).toBe(0);
  expect(second.summary.claimsCreated).toBe(0);
});

test("projection and Thesis Fit expose complete source-linked hackathon paths", async () => {
  const graph = await finalistGraph();
  const card = projectFounderCard(snapshotFromResult(graph));
  expect(card.projects).toHaveLength(1);
  expect(card.hackathons).toHaveLength(1);
  expect(card.verifiedResults.some((result) => result.toLowerCase().includes("finalist"))).toBe(
    true,
  );
  expect(card.technologies).toEqual(expect.arrayContaining(["TypeScript", "Supabase"]));
  expect(card.founderScoreLabel).toBe("Insufficient evidence");

  const fit = calculateGraphThesisFit(card, {
    ...DEFAULT_THESIS,
    sectors: ["AI"],
    stages: ["Hackathon"],
    keywords: ["Supabase"],
    technicalBuilderRequired: true,
  });
  expect(fit.evidencePaths.map((path) => path.graphStep).join(" | ")).toContain("SUBMITTED_TO");
  expect(fit.evidencePaths.some((path) => path.graphStep.includes("FINALIST_AT"))).toBe(true);
  for (const path of fit.evidencePaths) {
    expect(path.sourceUrl.startsWith("https://")).toBe(true);
    expect(path.evidenceExcerpt.length).toBeGreaterThan(0);
    expect(path.observedAt).toBe(observedAt);
    expect(["high", "medium"]).toContain(path.trustLevel);
  }
});

test("empty extraction fails before any graph data can be persisted", async () => {
  await expect(
    adapter().ingest({ projectUrl: "https://projects.example.test/empty", founder }),
  ).rejects.toThrow("no usable public evidence");
});
