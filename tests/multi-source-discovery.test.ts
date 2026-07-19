import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import acceleratorFixture from "./fixtures/german-register-feed.json";
import redditFixture from "./fixtures/reddit-listing.json";
import { AcceleratorDirectoryAdapter } from "../src/lib/discovery/accelerator-directory.server";
import { EntityResolutionService } from "../src/lib/discovery/entity-resolution.server";
import { GermanRegisterDiscoveryAdapter } from "../src/lib/discovery/german-register.server";
import { HackathonDirectoryAdapter } from "../src/lib/discovery/hackathon-directory.server";
import { executeMultiSourceDiscoveryPlan } from "../src/lib/discovery/orchestrator.server";
import { DiscoveryPlanner } from "../src/lib/discovery/planner.server";
import type { DiscoveryPersistenceStore } from "../src/lib/discovery/persistence.server";
import {
  LinkedInIdentifierAdapter,
  RedditEnrichmentAdapter,
} from "../src/lib/discovery/social-enrichment.server";
import type { DirectorySourceConfiguration } from "../src/lib/discovery/source-registry.server";
import { WebsiteEnrichmentAdapter } from "../src/lib/discovery/website-enrichment.server";
import { isPublicNetworkUrl } from "../src/lib/discovery/source-utils.server";
import type {
  DiscoveryCandidate,
  DiscoveryCandidateUpdate,
  DiscoveryPlan,
  DiscoveryResult,
  DiscoveryRunUpdate,
  SourceCapability,
  SourceDiscoveryPlan,
} from "../src/lib/discovery/types";
import type { GraphIngestionResult } from "../src/lib/graph/types";
import { projectFounderCard } from "../src/lib/graph/projection";
import { calculateGraphThesisFit, rankGraphFounders } from "../src/lib/graph/thesis-fit";
import { selectFounderFeed } from "../src/lib/graph/feed-selection";
import { DEFAULT_THESIS } from "../src/lib/thesis";

const observedAt = "2026-07-19T10:00:00.000Z";
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

const enabledCapabilities: SourceCapability[] = [
  { id: "github", role: "discovery", configured: true, enabled: true, supportsLiveAccess: true },
  { id: "hackathon", role: "discovery", configured: true, enabled: true, supportsLiveAccess: true },
  {
    id: "accelerator",
    role: "discovery",
    configured: true,
    enabled: true,
    supportsLiveAccess: true,
  },
  {
    id: "german_register",
    role: "discovery",
    configured: true,
    enabled: true,
    supportsLiveAccess: true,
  },
];

function configuredPlan(): DiscoveryPlan {
  return new DiscoveryPlanner(() => new Date(observedAt), enabledCapabilities).plan({
    ...DEFAULT_THESIS,
    stages: ["Pre-seed"],
    sectors: ["AI", "Climate"],
    technicalThemes: ["AI infrastructure"],
    preferredLanguages: ["TypeScript"],
  });
}

describe("multi-source DiscoveryPlanner", () => {
  test("creates source-specific plans while retaining unsupported stage semantics", () => {
    const plan = configuredPlan();
    expect(plan.sources.map((source) => source.source)).toEqual([
      "github",
      "hackathon",
      "accelerator",
      "german_register",
    ]);
    expect(plan.sources.every((source) => source.status === "planned")).toBe(true);
    expect(plan.sources.find((source) => source.source === "github")?.queries[0]?.query).toContain(
      "language:TypeScript",
    );
    expect(plan.unsupportedFilters.some((filter) => filter.field === "stages")).toBe(true);
    expect(
      plan.sources
        .find((source) => source.source === "german_register")
        ?.evidenceRequirements.some((requirement) => /legal roles/i.test(requirement)),
    ).toBe(true);
  });

  test("reports unconfigured sources as disabled instead of scanned", () => {
    const capabilities: SourceCapability[] = enabledCapabilities.map((capability) =>
      capability.id === "hackathon"
        ? {
            ...capability,
            configured: false,
            enabled: false,
            supportsLiveAccess: false,
            disabledReason: "fixture-only in this environment",
          }
        : capability,
    );
    const plan = new DiscoveryPlanner(() => new Date(observedAt), capabilities).plan({
      ...DEFAULT_THESIS,
      sectors: ["AI"],
    });
    const hackathon = plan.sources.find((source) => source.source === "hackathon");
    expect(hackathon?.status).toBe("disabled_unconfigured");
    expect(hackathon?.disabledReason).toContain("fixture-only");
  });
});

const hackathonConfiguration: DirectorySourceConfiguration = {
  id: "hack-nation-fixture",
  name: "Hack Nation fixture",
  indexUrl: "https://events.example.test/projects",
  itemUrlPattern: "^/matchfund$",
  sourcePolicy: "configured_allowed",
};

test("hackathon index discovers an explicitly linked participant and reuses validated project evidence", async () => {
  const requests: string[] = [];
  const fetchImpl = ((input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url === hackathonConfiguration.indexUrl)
      return Promise.resolve(htmlResponse(fixture("hackathon-directory-index.html")));
    if (url === "https://projects.example.test/matchfund")
      return Promise.resolve(htmlResponse(fixture("hackathon-project-finalist.html")));
    if (url === "https://events.example.test/hack-nation-2026")
      return Promise.resolve(htmlResponse(fixture("hackathon-event.html")));
    return Promise.resolve(htmlResponse("not found", 404));
  }) as typeof fetch;
  const plan = configuredPlan().sources.find((source) => source.source === "hackathon")!;
  const result = await new HackathonDirectoryAdapter({
    configurations: [hackathonConfiguration],
    fetchImpl,
    now: () => new Date(observedAt),
  }).discover(plan);

  expect(result.status).toBe("completed");
  expect(result.candidates).toHaveLength(1);
  const candidate = result.candidates[0]!;
  expect(candidate.source).toBe("hackathon");
  expect(
    candidate.graph.relationships.some((edge) => edge.relationshipType === "FINALIST_AT"),
  ).toBe(true);
  expect(candidate.graph.relationships.every((edge) => edge.evidenceTempIds.length > 0)).toBe(true);
  expect(candidate.graph.claims.every((claim) => claim.evidenceTempIds.length > 0)).toBe(true);
  expect(candidate.discoveryReasons[0]?.query).toContain("AI infrastructure");
  expect(candidate.graph.evidence.some((item) => item.sourceType === "github_search")).toBe(false);
  expect(requests).toContain("https://events.example.test/hack-nation-2026");
});

test("hackathon extraction failure creates no fabricated candidate graph", async () => {
  const fetchImpl = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === hackathonConfiguration.indexUrl)
      return Promise.resolve(
        htmlResponse(
          '<html><body><a href="https://projects.example.test/matchfund">AI infrastructure</a></body></html>',
        ),
      );
    if (url === "https://projects.example.test/matchfund")
      return Promise.resolve(htmlResponse(fixture("hackathon-empty.html")));
    return Promise.resolve(htmlResponse("not found", 404));
  }) as typeof fetch;
  const plan = configuredPlan().sources.find((source) => source.source === "hackathon")!;
  const result = await new HackathonDirectoryAdapter({
    configurations: [hackathonConfiguration],
    fetchImpl,
  }).discover(plan);
  expect(result.candidates).toEqual([]);
  expect(result.skipped).toBeGreaterThan(0);
});

const acceleratorConfiguration: DirectorySourceConfiguration = {
  id: "foundry-north-fixture",
  name: "Foundry North fixture",
  indexUrl: "https://accelerator.example.test/cohort",
  itemUrlPattern: "^/companies/",
  sourcePolicy: "configured_allowed",
};

async function acceleratorCandidate() {
  const fetchImpl = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === acceleratorConfiguration.indexUrl)
      return Promise.resolve(htmlResponse(fixture("accelerator-directory-index.html")));
    if (url === "https://accelerator.example.test/companies/greenstack")
      return Promise.resolve(htmlResponse(fixture("accelerator-company.html")));
    return Promise.resolve(htmlResponse("not found", 404));
  }) as typeof fetch;
  const sourcePlan = configuredPlan().sources.find((source) => source.source === "accelerator")!;
  const result = await new AcceleratorDirectoryAdapter({
    configurations: [acceleratorConfiguration],
    fetchImpl,
    now: () => new Date(observedAt),
  }).discover(sourcePlan);
  return result.candidates[0]!;
}

test("accelerator cohort creates only an explicitly stated founder-to-company path", async () => {
  const candidate = await acceleratorCandidate();
  expect(candidate.explicitFounderRole).toBe(true);
  expect(candidate.displayName).toBe("Alex Rivera");
  expect(candidate.graph.relationships.some((edge) => edge.relationshipType === "FOUNDED")).toBe(
    true,
  );
  expect(
    candidate.graph.relationships.some((edge) => edge.relationshipType === "PARTICIPATED_IN"),
  ).toBe(true);
  expect(candidate.graph.relationships.every((edge) => edge.evidenceTempIds.length > 0)).toBe(true);
  expect(candidate.graph.claims.every((claim) => claim.evidenceTempIds.length > 0)).toBe(true);
});

function snapshotFromGraph(graph: GraphIngestionResult) {
  const entityIds = new Map(graph.entities.map((entity) => [entity.tempId, `id:${entity.tempId}`]));
  const evidenceIds = new Map(graph.evidence.map((item) => [item.tempId, `id:${item.tempId}`]));
  const founder = graph.entities.find((entity) => entity.entityType === "founder")!;
  return {
    profile: {
      id: "public-profile",
      graphEntityId: entityIds.get(founder.tempId)!,
      name: founder.canonicalName,
      headline: "Public accelerator profile",
      github: null,
      linkedin: "https://www.linkedin.com/in/alex-rivera/",
      site: "https://alex.example.test/",
      summary: "Public evidence fixture",
      updatedAt: observedAt,
      profileOrigin: "public_scan" as const,
      claimStatus: "unclaimed" as const,
      visibilityState: "discoverable" as const,
    },
    entities: graph.entities.map((entity) => ({
      id: entityIds.get(entity.tempId)!,
      entityType: entity.entityType,
      canonicalKey: entity.canonicalKey,
      canonicalName: entity.canonicalName,
      properties: entity.properties,
      updatedAt: observedAt,
    })),
    relationships: graph.relationships.map((edge) => ({
      id: `id:${edge.tempId}`,
      sourceEntityId: entityIds.get(edge.sourceTempId)!,
      targetEntityId: entityIds.get(edge.targetTempId)!,
      relationshipType: edge.relationshipType,
      confidence: edge.confidence,
      observedAt: edge.observedAt,
      properties: edge.properties,
    })),
    claims: graph.claims.map((claim) => ({
      id: `id:${claim.tempId}`,
      subjectEntityId: entityIds.get(claim.subjectTempId)!,
      predicate: claim.predicate,
      value: claim.value,
      status: claim.status,
      trustLevel: claim.trustLevel,
      observedAt: claim.observedAt,
    })),
    evidence: graph.evidence.map((item) => ({
      id: evidenceIds.get(item.tempId)!,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      sourceExternalId: item.sourceExternalId,
      retrievedAt: item.retrievedAt,
      excerpt: item.excerpt,
      reliability: item.reliability,
      pageTitle: item.pageTitle,
      extractionMethod: item.extractionMethod,
      trustLevel: item.trustLevel,
      metadata: item.metadata,
    })),
    relationshipEvidence: graph.relationships.flatMap((edge) =>
      edge.evidenceTempIds.map((evidenceId) => ({
        relationshipId: `id:${edge.tempId}`,
        evidenceId: evidenceIds.get(evidenceId)!,
      })),
    ),
    claimEvidence: graph.claims.flatMap((claim) =>
      claim.evidenceTempIds.map((evidenceId) => ({
        claimId: `id:${claim.tempId}`,
        evidenceId: evidenceIds.get(evidenceId)!,
      })),
    ),
    discoveryProvenance: [
      {
        source: "accelerator" as const,
        sourceUrl: "https://accelerator.example.test/companies/greenstack",
        introducedAt: observedAt,
        reasons: [{ query: "climate", reason: "The thesis asked MatchFund to search climate." }],
      },
    ],
  };
}

test("Why discovered stays separate while Why matched uses only persisted accelerator evidence", async () => {
  const candidate = await acceleratorCandidate();
  const card = projectFounderCard(snapshotFromGraph(candidate.graph));
  const fit = calculateGraphThesisFit(card, {
    ...DEFAULT_THESIS,
    sectors: ["Climate"],
    keywords: ["climate"],
  });
  expect(card.profileOrigin).toBe("public_scan");
  expect(card.claimStatus).toBe("unclaimed");
  expect(card.founderScoreLabel).toBe("Insufficient evidence");
  expect(card.discoveryProvenance[0]?.reasons[0]?.query).toBe("climate");
  expect(fit.evidencePaths.length).toBeGreaterThan(0);
  expect(fit.unknownCriteria.some((criterion) => criterion.includes("Technical-builder"))).toBe(
    true,
  );
  expect(
    fit.evidencePaths.every((path) =>
      Boolean(path.sourceUrl && path.evidenceExcerpt && path.observedAt && path.trustLevel),
    ),
  ).toBe(true);
  expect(
    fit.evidencePaths.some((path) => /FOCUSES_ON|FOUNDED|PARTICIPATED_IN/.test(path.graphStep)),
  ).toBe(true);
  const ranked = rankGraphFounders([card], { ...DEFAULT_THESIS, sectors: ["Climate"] });
  expect(selectFounderFeed(ranked, [{ id: "demo" }]).mode).toBe("graph");
});

test("repeating configured directory scans yields the same entity, edge, claim, and evidence keys", async () => {
  const first = (await acceleratorCandidate()).graph;
  const second = (await acceleratorCandidate()).graph;
  const keySet = (graph: GraphIngestionResult) => ({
    entities: graph.entities.map((item) => `${item.entityType}:${item.canonicalKey}`).sort(),
    relationships: graph.relationships
      .map((item) => `${item.sourceTempId}:${item.relationshipType}:${item.targetTempId}`)
      .sort(),
    claims: graph.claims
      .map((item) => `${item.subjectTempId}:${item.predicate}:${JSON.stringify(item.value)}`)
      .sort(),
    evidence: graph.evidence.map((item) => item.contentHash).sort(),
  });
  expect(keySet(second)).toEqual(keySet(first));
});

test("website enrichment is same-domain bounded and records sameAs without fetching LinkedIn or Reddit", async () => {
  const base = await acceleratorCandidate();
  const requests: string[] = [];
  const fetchImpl = ((input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/robots.txt")) return Promise.resolve(new Response("", { status: 404 }));
    if (url === "https://alex.example.test/")
      return Promise.resolve(htmlResponse(fixture("website-home.html")));
    if (url === "https://alex.example.test/about")
      return Promise.resolve(htmlResponse(fixture("website-about.html")));
    if (url === "https://alex.example.test/team")
      return Promise.resolve(htmlResponse(fixture("website-team.html")));
    if (url === "https://greenstack.example.test/")
      return Promise.resolve(
        htmlResponse(
          '<html><head><title>GreenStack</title></head><body data-technologies="Postgres">GreenStack climate data infrastructure.</body></html>',
        ),
      );
    return Promise.resolve(htmlResponse("not found", 404));
  }) as typeof fetch;
  const result = await new WebsiteEnrichmentAdapter({
    fetchImpl,
    now: () => new Date(observedAt),
  }).enrich(base);

  expect(result.pagesFetched).toBeLessThanOrEqual(10);
  expect(result.identifiers).toContainEqual({
    scheme: "linkedin_url",
    value: "https://www.linkedin.com/in/alex-rivera/",
  });
  expect(result.identifiers).toContainEqual({
    scheme: "reddit_url",
    value: "https://www.reddit.com/user/alex-builds/",
  });
  expect(requests.some((url) => /linkedin\.com|reddit\.com/i.test(url))).toBe(false);
  expect(
    result.graph.relationships.filter((edge) => edge.relationshipType === "HAS_SOCIAL_IDENTIFIER"),
  ).toHaveLength(2);
  expect(result.graph.relationships.every((edge) => edge.evidenceTempIds.length > 0)).toBe(true);
  expect(result.graph.claims.every((claim) => claim.evidenceTempIds.length > 0)).toBe(true);
});

test("website fetch policy rejects private and metadata-network targets", () => {
  expect(isPublicNetworkUrl("http://127.0.0.1/admin")).toBe(false);
  expect(isPublicNetworkUrl("https://10.0.0.8/internal")).toBe(false);
  expect(isPublicNetworkUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
  expect(isPublicNetworkUrl("https://public.example.com/about")).toBe(true);
});

test("website enrichment blocks a redirect to LinkedIn before sending that request", async () => {
  const base = await acceleratorCandidate();
  const requests: string[] = [];
  const candidate = {
    ...base,
    urls: { personalWebsite: "https://alex.example.test/" },
  };
  const result = await new WebsiteEnrichmentAdapter({
    respectRobots: false,
    fetchImpl: ((input: RequestInfo | URL) => {
      requests.push(String(input));
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.linkedin.com/in/alex-rivera/" },
        }),
      );
    }) as typeof fetch,
  }).enrich(candidate);
  expect(result.status).toBe("failed");
  expect(requests).toEqual(["https://alex.example.test/"]);
});

test("LinkedIn remains identifier-only and Reddit reports disabled or bounded API states honestly", async () => {
  const base = await acceleratorCandidate();
  const candidate = {
    ...base,
    urls: {
      ...base.urls,
      linkedin: "https://linkedin.com/in/alex-rivera/?trk=fixture",
      reddit: "https://reddit.com/u/alex-builds",
    },
  };
  const linkedIn = await new LinkedInIdentifierAdapter().enrich(candidate);
  expect(linkedIn.pagesFetched).toBe(0);
  expect(linkedIn.identifiers[0]?.value).toBe("https://www.linkedin.com/in/alex-rivera/");

  const disabled = await new RedditEnrichmentAdapter({ configuration: null }).enrich(candidate);
  expect(disabled.status).toBe("disabled_unconfigured");
  expect(disabled.pagesFetched).toBe(0);

  const requests: string[] = [];
  const configured = await new RedditEnrichmentAdapter({
    configuration: { apiBaseUrl: "https://oauth.reddit.com/", apiToken: "fixture-token" },
    fetchImpl: ((input: RequestInfo | URL) => {
      requests.push(String(input));
      return Promise.resolve(Response.json(redditFixture));
    }) as typeof fetch,
    now: () => new Date(observedAt),
  }).enrich(candidate);
  expect(configured.status).toBe("completed");
  expect(configured.graph.claims.every((claim) => claim.trustLevel === "low")).toBe(true);
  expect(requests.every((url) => url.startsWith("https://oauth.reddit.com/"))).toBe(true);
});

test("German register roles stay legal-role evidence and never become founder claims", async () => {
  const plan = configuredPlan().sources.find((source) => source.source === "german_register")!;
  const result = await new GermanRegisterDiscoveryAdapter({
    configuration: {
      feedUrl: "https://register-provider.example.test/recent.json",
      apiKey: "fixture-key",
      sourceName: "Licensed register fixture",
    },
    fetchImpl: (() => Promise.resolve(Response.json(acceleratorFixture))) as typeof fetch,
    now: () => new Date(observedAt),
  }).discover(plan);
  const candidate = result.candidates.find((item) =>
    item.sourceIdentifier.includes("DE-HRB-123456"),
  );
  expect(candidate).toBeTruthy();
  expect(candidate?.graph.entities.some((entity) => entity.entityType === "founder")).toBe(false);
  expect(
    candidate?.graph.relationships.some((edge) => edge.relationshipType === "MANAGING_DIRECTOR_OF"),
  ).toBe(true);
  expect(candidate?.graph.relationships.some((edge) => edge.relationshipType === "FOUNDED")).toBe(
    false,
  );
  expect(candidate?.context).toMatchObject({ notFounderClaim: true, holdingCompany: false });
  if (!candidate) throw new Error("Register fixture candidate is missing.");
  const enrichment = await new WebsiteEnrichmentAdapter({
    fetchImpl: ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return Promise.resolve(new Response("", { status: 404 }));
      if (url === "https://greenstack.example.test/") {
        return Promise.resolve(
          htmlResponse(
            '<html><head><title>GreenStack</title></head><body data-technologies="Postgres">Official company website.</body></html>',
          ),
        );
      }
      return Promise.resolve(htmlResponse("not found", 404));
    }) as typeof fetch,
    now: () => new Date(observedAt),
  }).enrich(candidate);
  expect(enrichment.pagesFetched).toBe(1);
  expect(
    enrichment.graph.relationships.some((edge) => edge.relationshipType === "HAS_WEBSITE"),
  ).toBe(true);
  expect(enrichment.graph.relationships.some((edge) => edge.relationshipType === "FOUNDED")).toBe(
    false,
  );
  expect(enrichment.graph.entities.some((entity) => entity.entityType === "founder")).toBe(false);
});

test("holding-company register records remain non-founder, noisy candidates", async () => {
  const plan: SourceDiscoveryPlan = {
    source: "german_register",
    role: "discovery",
    status: "planned",
    queries: [{ query: "holding", reason: "fixture holding query", limit: 10 }],
    themes: ["holding"],
    evidenceRequirements: [],
    unsupportedFilters: [],
  };
  const result = await new GermanRegisterDiscoveryAdapter({
    configuration: {
      feedUrl: "https://register-provider.example.test/recent.json",
      apiKey: "fixture-key",
      sourceName: "Licensed register fixture",
    },
    fetchImpl: (() => Promise.resolve(Response.json(acceleratorFixture))) as typeof fetch,
  }).discover(plan);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]?.context).toMatchObject({
    holdingCompany: true,
    notFounderClaim: true,
  });
  expect(
    result.candidates[0]?.graph.entities.some((entity) => entity.entityType === "founder"),
  ).toBe(false);
});

test("entity resolution never merges two people on name alone", () => {
  const resolver = new EntityResolutionService();
  const existing = [
    {
      entityId: "person-one",
      canonicalName: "Alex Rivera",
      identifiers: [{ scheme: "github_user_id" as const, value: "101" }],
    },
  ];
  expect(
    resolver.resolve(
      {
        canonicalName: "Alex Rivera",
        identifiers: [{ scheme: "linkedin_url", value: "https://linkedin.com/in/different-alex" }],
      },
      existing,
    ).decision,
  ).toBe("create");
  expect(
    resolver.resolve(
      {
        canonicalName: "Different Name",
        identifiers: [{ scheme: "github_user_id", value: "101" }],
      },
      existing,
    ).decision,
  ).toBe("reuse");
});

class MemoryDiscoveryStore implements DiscoveryPersistenceStore {
  private sequence = 0;
  readonly candidates = new Map<string, DiscoveryCandidateUpdate>();
  completed: DiscoveryRunUpdate | null = null;

  createRun(): Promise<string> {
    return Promise.resolve("multi-run");
  }
  upsertCandidate(_runId: string, _candidate: DiscoveryCandidate) {
    const id = `candidate-${++this.sequence}`;
    this.candidates.set(id, { status: "discovered" });
    return Promise.resolve({ id, status: "discovered" as const });
  }
  updateCandidate(id: string, update: DiscoveryCandidateUpdate): Promise<void> {
    this.candidates.set(id, update);
    return Promise.resolve();
  }
  completeRun(_runId: string, update: DiscoveryRunUpdate): Promise<void> {
    this.completed = update;
    return Promise.resolve();
  }
}

function emptyGraph(name: string): GraphIngestionResult {
  return {
    entities: [
      {
        tempId: `founder:${name}`,
        entityType: "founder",
        canonicalKey: `fixture:${name}`,
        canonicalName: name,
        properties: {},
        identifiers: [{ scheme: "canonical_url", value: `https://${name}.example.test/` }],
      },
    ],
    relationships: [],
    claims: [],
    evidence: [],
  };
}

test("one source can fail while another creates a public unclaimed profile without /me", async () => {
  const store = new MemoryDiscoveryStore();
  const plan = configuredPlan();
  const publicCandidate: DiscoveryCandidate = {
    source: "accelerator",
    sourceIdentifier: "accelerator:alex",
    sourceUrl: "https://accelerator.example.test/alex",
    displayName: "Alex",
    explicitFounderRole: true,
    identifiers: [{ scheme: "canonical_url", value: "https://alex.example.test/" }],
    urls: { personalWebsite: "https://alex.example.test/" },
    discoveryReasons: [
      {
        source: "accelerator",
        query: "climate",
        planReason: "Thesis theme",
        resultUrl: "https://accelerator.example.test/alex",
      },
    ],
    graph: emptyGraph("alex"),
    context: {},
  };
  const completedResult: DiscoveryResult = {
    source: "accelerator",
    status: "completed",
    candidates: [publicCandidate],
    queriesExecuted: 1,
    recordsEvaluated: 1,
    skipped: 0,
    issues: [],
  };
  const adapters = {
    github: {
      plan: () => Promise.resolve(plan.sources[0]!),
      discover: () => Promise.reject(new Error("fixture GitHub failure")),
    },
    accelerator: {
      plan: () => Promise.resolve(plan.sources[2]!),
      discover: () => Promise.resolve(completedResult),
    },
  };
  const summary = await executeMultiSourceDiscoveryPlan(plan, DEFAULT_THESIS, {
    store,
    adapters,
    capabilities: [
      ...enabledCapabilities.map((capability) =>
        ["hackathon", "german_register"].includes(capability.id)
          ? { ...capability, enabled: false, configured: false, supportsLiveAccess: false }
          : capability,
      ),
      {
        id: "personal_website",
        role: "enrichment",
        configured: true,
        enabled: true,
        supportsLiveAccess: true,
      },
      {
        id: "linkedin_identifier",
        role: "enrichment",
        configured: true,
        enabled: true,
        supportsLiveAccess: false,
      },
      {
        id: "reddit",
        role: "enrichment",
        configured: false,
        enabled: false,
        supportsLiveAccess: false,
        disabledReason: "fixture access is unconfigured",
      },
    ],
    now: () => new Date(observedAt),
    ingestCandidate: () =>
      Promise.resolve({
        profileId: "public-profile",
        graphEntityId: "graph-alex",
        name: "Alex",
        enriched: true,
        issues: [],
        enrichmentResults: [
          {
            source: "personal_website",
            status: "completed",
            pagesFetched: 3,
            issues: [],
          },
          {
            source: "linkedin_identifier",
            status: "completed",
            pagesFetched: 0,
            issues: [],
          },
        ],
        summary: {
          repositoriesFound: 0,
          projectsFound: 0,
          hackathonsFound: 0,
          organizationsFound: 1,
          entitiesCreated: 3,
          evidenceCreated: 1,
          relationshipsCreated: 2,
          claimsCreated: 2,
          claimsSupported: 2,
          lastUpdated: observedAt,
        },
      }),
    rankProfiles: () =>
      Promise.resolve([
        {
          profileId: "public-profile",
          graphEntityId: "graph-alex",
          name: "Alex",
          thesisFit: 75,
          discoveryPriority: 73,
        },
      ]),
  });
  expect(summary.status).toBe("partial");
  expect(summary.results[0]?.profileId).toBe("public-profile");
  expect(summary.sourceResults.find((source) => source.source === "github")?.status).toBe("failed");
  expect(summary.sourceResults.find((source) => source.source === "accelerator")?.status).toBe(
    "completed",
  );
  expect(summary.sourceResults.find((source) => source.source === "hackathon")?.status).toBe(
    "disabled_unconfigured",
  );
  expect(summary.sourceResults.find((source) => source.source === "personal_website")?.status).toBe(
    "completed",
  );
  expect(
    summary.sourceResults.find((source) => source.source === "linkedin_identifier")?.live,
  ).toBe(false);
  expect(summary.sourceResults.find((source) => source.source === "reddit")?.status).toBe(
    "disabled_unconfigured",
  );
});
