import { describe, expect, test } from "bun:test";
import searchFixture from "./fixtures/github-discovery-search.json";
import githubFixture from "./fixtures/github-octocat.json";
import { GitHubDiscoveryAdapter } from "../src/lib/discovery/github-discovery.server";
import { executeDiscoveryPlan } from "../src/lib/discovery/orchestrator.server";
import { DiscoveryPlanner } from "../src/lib/discovery/planner.server";
import type { DiscoveryPersistenceStore } from "../src/lib/discovery/persistence.server";
import type {
  DiscoveryCandidateUpdate,
  DiscoveryPlan,
  DiscoveryRunUpdate,
  GitHubDiscoveryCandidate,
} from "../src/lib/discovery/types";
import { GitHubGraphAdapter } from "../src/lib/graph/github-graph.server";
import { DEFAULT_THESIS } from "../src/lib/thesis";

const observedAt = "2026-07-19T09:00:00.000Z";

function oneQueryPlan(): DiscoveryPlan {
  return {
    thesisId: "local-thesis-fixture",
    capabilities: [
      {
        id: "github",
        role: "discovery",
        configured: true,
        enabled: true,
        supportsLiveAccess: true,
      },
    ],
    sources: [
      {
        source: "github",
        role: "discovery",
        status: "planned",
        queries: [
          {
            query:
              '"artificial intelligence" in:name,description,readme archived:false pushed:>=2025-07-19',
            reason: "Search public repositories matching the AI thesis.",
            limit: 10,
          },
        ],
        themes: ["artificial intelligence"],
        evidenceRequirements: ["Stored GitHub repository evidence"],
        unsupportedFilters: [],
      },
    ],
    rankingPreferences: ["Evidence-backed AI topic overlap"],
    evidenceRequirements: ["Stored GitHub repository evidence"],
    unsupportedFilters: [],
    candidateLimit: 10,
  };
}

function searchFixtureFetch(): Promise<Response> {
  return Promise.resolve(
    Response.json({
      total_count: searchFixture.items.length,
      incomplete_results: false,
      items: searchFixture.items,
    }),
  );
}

describe("DiscoveryPlanner", () => {
  test("compiles saved thesis fields into bounded, deterministic GitHub queries", () => {
    const planner = new DiscoveryPlanner(() => new Date(observedAt));
    const thesis = {
      ...DEFAULT_THESIS,
      stages: ["Pre-seed" as const],
      sectors: ["AI" as const, "Devtools" as const],
      technicalThemes: ["AI infrastructure"],
      preferredLanguages: ["TypeScript"],
      geos: ["EU"],
    };
    const first = planner.plan(thesis);
    const second = planner.plan(thesis);

    expect(second).toEqual(first);
    expect(first.sources[0]?.queries.length).toBeGreaterThan(0);
    expect(first.sources[0]?.queries.length).toBeLessThanOrEqual(5);
    expect(first.sources[0]?.queries.every((query) => query.limit <= 10)).toBe(true);
    expect(first.sources[0]?.queries[0]?.query).toContain("language:TypeScript");
    expect(first.sources[0]?.queries[0]?.query).toContain("pushed:>=2025-07-19");
    expect(first.candidateLimit).toBeLessThanOrEqual(20);
  });

  test("keeps stage, check size, and geography unsupported or post-fetch", () => {
    const plan = new DiscoveryPlanner(() => new Date(observedAt)).plan({
      ...DEFAULT_THESIS,
      stages: ["Seed"],
      sectors: ["Climate"],
      geos: ["US"],
      checkMin: 100,
      checkMax: 500,
    });
    const fields = plan.unsupportedFilters.map((item) => item.field);
    expect(fields).toContain("stages");
    expect(fields).toContain("geography");
    expect(fields).toContain("check_size");
    expect(plan.sources[0]?.queries.some((item) => /seed|funding/i.test(item.query))).toBe(false);
  });
});

describe("GitHubDiscoveryAdapter", () => {
  test("preserves the runtime fetch receiver when no injected fetch is provided", async () => {
    const originalFetch = globalThis.fetch;
    let usedCorrectReceiver = false;
    globalThis.fetch = function (this: unknown) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      usedCorrectReceiver = true;
      return searchFixtureFetch();
    } as typeof fetch;

    try {
      const result = await new GitHubDiscoveryAdapter().discover(oneQueryPlan());
      expect(result.candidates).toHaveLength(1);
      expect(usedCorrectReceiver).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("turns individual repository owners into candidates and deduplicates by numeric user ID", async () => {
    const adapter = new GitHubDiscoveryAdapter({
      fetchImpl: searchFixtureFetch as typeof fetch,
    });
    const result = await adapter.discover(oneQueryPlan());

    expect(result.repositoriesEvaluated).toBe(4);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.sourceIdentifier).toBe("583231");
    expect(result.candidates[0]?.repositories).toHaveLength(2);
    expect(result.ownersSkipped).toBe(2);
  });

  test("returns an empty successful result without fabricating candidates", async () => {
    const adapter = new GitHubDiscoveryAdapter({
      fetchImpl: (() =>
        Promise.resolve(
          Response.json({ total_count: 0, incomplete_results: false, items: [] }),
        )) as typeof fetch,
    });
    const result = await adapter.discover(oneQueryPlan());
    expect(result.candidates).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.repositoriesEvaluated).toBe(0);
  });

  test("stops cleanly and exposes GitHub rate-limit reset information", async () => {
    const adapter = new GitHubDiscoveryAdapter({
      fetchImpl: (() =>
        Promise.resolve(
          Response.json(
            { message: "API rate limit exceeded" },
            {
              status: 403,
              headers: {
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": "1784455200",
              },
            },
          ),
        )) as typeof fetch,
    });
    const result = await adapter.discover(oneQueryPlan());
    expect(result.candidates).toEqual([]);
    expect(result.issues[0]?.rateLimited).toBe(true);
    expect(result.issues[0]?.rateLimitResetAt).toBeTruthy();
  });
});

test("discovery reasons remain separate from graph evidence and claims", async () => {
  const discovery = await new GitHubDiscoveryAdapter({
    fetchImpl: searchFixtureFetch as typeof fetch,
  }).discover(oneQueryPlan());
  const candidate = discovery.candidates[0]!;
  const fixtureFetch = ((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://api.github.com/users/octocat") {
      return Promise.resolve(Response.json(githubFixture.user));
    }
    if (url.startsWith("https://api.github.com/users/octocat/repos?")) {
      return Promise.resolve(Response.json(githubFixture.repositories));
    }
    return Promise.resolve(Response.json({ message: "Not Found" }, { status: 404 }));
  }) as typeof fetch;
  const graph = await new GitHubGraphAdapter({
    fetchImpl: fixtureFetch,
    now: () => new Date(observedAt),
  }).ingest({
    github: candidate.sourceUrl,
    founderName: "",
    repositorySeeds: candidate.repositories,
    repositoryLimit: 20,
  });

  expect(candidate.discoveryReasons.length).toBeGreaterThan(0);
  expect(graph.evidence.some((item) => item.sourceType === "github_search")).toBe(false);
  expect(graph.claims.some((item) => /discovery|search_query/.test(item.predicate))).toBe(false);
  expect(graph.entities.find((item) => item.entityType === "founder")?.canonicalKey).toBe(
    "github:user:583231",
  );
});

class MemoryDiscoveryStore implements DiscoveryPersistenceStore {
  private sequence = 0;
  readonly candidates = new Map<string, DiscoveryCandidateUpdate>();
  runUpdate: DiscoveryRunUpdate | null = null;

  createRun(): Promise<string> {
    return Promise.resolve("run-1");
  }

  upsertCandidate(_runId: string, candidate: GitHubDiscoveryCandidate) {
    this.sequence += 1;
    const id = `candidate-${this.sequence}`;
    this.candidates.set(id, { status: "discovered" });
    return Promise.resolve({ id, status: "discovered" as const });
  }

  updateCandidate(candidateId: string, update: DiscoveryCandidateUpdate): Promise<void> {
    this.candidates.set(candidateId, update);
    return Promise.resolve();
  }

  completeRun(_runId: string, update: DiscoveryRunUpdate): Promise<void> {
    this.runUpdate = update;
    return Promise.resolve();
  }
}

function candidate(id: number, login: string): GitHubDiscoveryCandidate {
  return {
    source: "github",
    sourceIdentifier: String(id),
    login,
    sourceUrl: `https://github.com/${login}`,
    repositories: [],
    discoveryReasons: [],
  };
}

test("public candidates ingest without /me and one candidate failure produces a partial run", async () => {
  const store = new MemoryDiscoveryStore();
  const summary = await executeDiscoveryPlan(
    oneQueryPlan(),
    {
      ...DEFAULT_THESIS,
      sectors: ["AI"],
    },
    {
      store,
      now: () => new Date(observedAt),
      discover: () =>
        Promise.resolve({
          source: "github",
          status: "completed",
          candidates: [candidate(1, "success"), candidate(2, "failure")],
          repositoriesEvaluated: 2,
          recordsEvaluated: 2,
          queriesExecuted: 1,
          ownersSkipped: 0,
          skipped: 0,
          issues: [],
        }),
      ingestCandidate: (item) => {
        if (item.login === "failure") return Promise.reject(new Error("recorded fixture failure"));
        return Promise.resolve({
          profileId: "profile-1",
          graphEntityId: "graph-1",
          name: "Success",
          summary: {
            repositoriesFound: 1,
            projectsFound: 0,
            hackathonsFound: 0,
            organizationsFound: 0,
            entitiesCreated: 3,
            evidenceCreated: 2,
            relationshipsCreated: 2,
            claimsCreated: 2,
            claimsSupported: 2,
            lastUpdated: observedAt,
          },
        });
      },
      rankProfiles: (outcomes) =>
        Promise.resolve(
          outcomes.map((outcome) => ({
            profileId: outcome.profileId,
            graphEntityId: outcome.graphEntityId,
            name: outcome.name,
            thesisFit: 80,
            discoveryPriority: 78,
          })),
        ),
    },
  );

  expect(summary.status).toBe("partial");
  expect(summary.stats.profilesIngested).toBe(1);
  expect(summary.stats.failed).toBe(1);
  expect(summary.results[0]?.profileId).toBe("profile-1");
  expect([...store.candidates.values()].map((item) => item.status).sort()).toEqual([
    "failed",
    "ingested",
  ]);
});
