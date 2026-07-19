import type { Thesis } from "@/lib/thesis";
import type { GraphIngestionResult, GraphIngestionSummary } from "@/lib/graph/types";
import { AcceleratorDirectoryAdapter } from "./accelerator-directory.server";
import { EntityResolutionService, type ResolvableIdentity } from "./entity-resolution.server";
import { GermanRegisterDiscoveryAdapter } from "./german-register.server";
import { coalesceCandidateFounder, mergeGraphs } from "./graph-builders.server";
import { GitHubDiscoveryAdapter } from "./github-discovery.server";
import { HackathonDirectoryAdapter } from "./hackathon-directory.server";
import { DiscoveryPlanner } from "./planner.server";
import {
  createSupabaseDiscoveryStore,
  emptyDiscoveryStats,
  type DiscoveryPersistenceStore,
} from "./persistence.server";
import { LinkedInIdentifierAdapter, RedditEnrichmentAdapter } from "./social-enrichment.server";
import { SourceRegistry } from "./source-registry.server";
import { WebsiteEnrichmentAdapter } from "./website-enrichment.server";
import { DISCOVERY_LIMITS } from "./types";
import type {
  Candidate,
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoveryPlan,
  DiscoveryResult,
  DiscoveryResultProfile,
  DiscoveryRunStatus,
  DiscoveryRunSummary,
  DiscoverySource,
  EnrichmentSource,
  GitHubDiscoveryCandidate,
  GitHubDiscoveryIssue,
  GitHubDiscoveryResult,
  SourceCapability,
  SourceDiscoveryIssue,
  SourceRunSummary,
  SourceStatus,
} from "./types";

export type CandidateIngestionOutcome = {
  profileId: string;
  graphEntityId: string;
  name: string;
  summary: GraphIngestionSummary;
  enriched?: boolean;
  issues?: SourceDiscoveryIssue[];
};

type MultiSourceCandidateOutcome = {
  profileId: string | null;
  graphEntityId: string | null;
  name: string;
  summary: GraphIngestionSummary;
  enriched: boolean;
  issues: SourceDiscoveryIssue[];
  enrichmentResults?: Array<{
    source: EnrichmentSource;
    status: SourceStatus;
    pagesFetched: number;
    issues: SourceDiscoveryIssue[];
  }>;
};

export type DiscoveryExecutionDependencies = {
  store: DiscoveryPersistenceStore;
  discover(plan: DiscoveryPlan): Promise<GitHubDiscoveryResult>;
  ingestCandidate(candidate: GitHubDiscoveryCandidate): Promise<CandidateIngestionOutcome>;
  rankProfiles(
    outcomes: CandidateIngestionOutcome[],
    thesis: Thesis,
  ): Promise<DiscoveryResultProfile[]>;
  now?: () => Date;
};

export type MultiSourceExecutionDependencies = {
  store: DiscoveryPersistenceStore;
  adapters: Partial<Record<DiscoverySource, DiscoveryAdapter>>;
  capabilities: SourceCapability[];
  ingestCandidate(candidate: DiscoveryCandidate): Promise<MultiSourceCandidateOutcome>;
  rankProfiles(
    outcomes: Array<MultiSourceCandidateOutcome & { profileId: string; graphEntityId: string }>,
    thesis: Thesis,
  ): Promise<DiscoveryResultProfile[]>;
  now?: () => Date;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function orchestrationIssue(
  message: string,
  source: DiscoverySource = "github",
): SourceDiscoveryIssue {
  return {
    source,
    query: "",
    status: null,
    message,
    rateLimited: false,
    rateLimitResetAt: null,
  };
}

function runStatus(successes: number, failures: number, issues: number): DiscoveryRunStatus {
  if (successes === 0 && (failures > 0 || issues > 0)) return "failed";
  if (failures > 0 || issues > 0) return "partial";
  return "completed";
}

export async function executeDiscoveryPlan(
  plan: DiscoveryPlan,
  thesis: Thesis,
  dependencies: DiscoveryExecutionDependencies,
): Promise<DiscoveryRunSummary> {
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const githubPlan = plan.sources.find((source) => source.source === "github");
  const stats = emptyDiscoveryStats(githubPlan?.queries.length ?? 0);
  const runId = await dependencies.store.createRun(plan, startedAt);
  const issues: GitHubDiscoveryIssue[] = [];
  const outcomes: CandidateIngestionOutcome[] = [];

  let discovery: GitHubDiscoveryResult;
  try {
    discovery = await dependencies.discover(plan);
  } catch (error) {
    issues.push(orchestrationIssue(`GitHub discovery failed: ${errorMessage(error)}`));
    const completedAt = now().toISOString();
    const sourceResults: SourceRunSummary[] = [
      {
        source: "github",
        status: "failed",
        configured: true,
        live: true,
        queries: githubPlan?.queries ?? [],
        recordsEvaluated: 0,
        candidatesDiscovered: 0,
        candidatesIngested: 0,
        candidatesEnriched: 0,
        skipped: 0,
        failed: 1,
        issues,
      },
    ];
    await dependencies.store.completeRun(runId, {
      status: "failed",
      stats,
      sourceResults,
      issues,
      completedAt,
    });
    return {
      runId,
      status: "failed",
      plan,
      stats,
      sourceResults,
      issues,
      results: [],
      startedAt,
      completedAt,
    };
  }

  issues.push(...discovery.issues);
  stats.queriesExecuted = discovery.queriesExecuted;
  stats.repositoriesEvaluated = discovery.repositoriesEvaluated;
  stats.recordsEvaluated = discovery.recordsEvaluated;
  stats.candidateFoundersDiscovered = discovery.candidates.length;
  stats.skipped = discovery.ownersSkipped;

  for (const candidate of discovery.candidates) {
    let persistedCandidateId: string;
    try {
      const persistedCandidate = await dependencies.store.upsertCandidate(runId, candidate);
      persistedCandidateId = persistedCandidate.id;
    } catch (error) {
      stats.failed += 1;
      issues.push(
        orchestrationIssue(
          `Could not record GitHub candidate @${candidate.login}: ${errorMessage(error)}`,
        ),
      );
      continue;
    }

    try {
      const outcome = await dependencies.ingestCandidate(candidate);
      outcomes.push(outcome);
      stats.profilesIngested += 1;
      stats.candidatesEnriched += outcome.enriched ? 1 : 0;
      stats.entitiesCreated += outcome.summary.entitiesCreated;
      stats.evidenceCreated += outcome.summary.evidenceCreated;
      stats.relationshipsCreated += outcome.summary.relationshipsCreated;
      stats.claimsCreated += outcome.summary.claimsCreated;
      issues.push(...(outcome.issues ?? []));
      await dependencies.store.updateCandidate(persistedCandidateId, {
        status: "ingested",
        founderGraphEntityId: outcome.graphEntityId,
        founderProfileId: outcome.profileId,
        errorSummary: null,
      });
    } catch (error) {
      stats.failed += 1;
      const message = `Candidate @${candidate.login} failed: ${errorMessage(error)}`;
      issues.push(orchestrationIssue(message));
      await dependencies.store.updateCandidate(persistedCandidateId, {
        status: "failed",
        errorSummary: message,
      });
    }
  }

  let results: DiscoveryResultProfile[] = [];
  if (outcomes.length > 0) {
    try {
      results = await dependencies.rankProfiles(outcomes, thesis);
    } catch (error) {
      issues.push(orchestrationIssue(`Profile projection failed: ${errorMessage(error)}`));
    }
  }

  const status = runStatus(stats.profilesIngested, stats.failed, issues.length);
  const sourceResults: SourceRunSummary[] = [
    {
      source: "github",
      status,
      configured: true,
      live: true,
      queries: githubPlan?.queries ?? [],
      recordsEvaluated: stats.recordsEvaluated,
      candidatesDiscovered: stats.candidateFoundersDiscovered,
      candidatesIngested: stats.profilesIngested,
      candidatesEnriched: stats.candidatesEnriched,
      skipped: stats.skipped,
      failed: stats.failed,
      issues,
    },
  ];
  const completedAt = now().toISOString();
  await dependencies.store.completeRun(runId, {
    status,
    stats,
    sourceResults,
    issues,
    completedAt,
  });
  return {
    runId,
    status,
    plan,
    stats,
    sourceResults,
    issues,
    results,
    startedAt,
    completedAt,
  };
}

function capabilityFor(
  capabilities: SourceCapability[],
  source: DiscoverySource,
): SourceCapability | undefined {
  return capabilities.find(
    (capability) => capability.id === source && capability.role === "discovery",
  );
}

function sourceSummary(
  source: DiscoverySource,
  plan: DiscoveryPlan["sources"][number],
  capability: SourceCapability | undefined,
  status: SourceRunSummary["status"],
  discovery?: DiscoveryResult,
): SourceRunSummary {
  return {
    source,
    status,
    configured: Boolean(capability?.configured),
    live: Boolean(capability?.supportsLiveAccess && capability.enabled),
    queries: plan.queries,
    recordsEvaluated: discovery?.recordsEvaluated ?? 0,
    candidatesDiscovered: discovery?.candidates.length ?? 0,
    candidatesIngested: 0,
    candidatesEnriched: 0,
    skipped: discovery?.skipped ?? 0,
    failed: 0,
    disabledReason: capability?.disabledReason ?? plan.disabledReason,
    issues: discovery?.issues ?? [],
  };
}

export async function executeMultiSourceDiscoveryPlan(
  plan: DiscoveryPlan,
  thesis: Thesis,
  dependencies: MultiSourceExecutionDependencies,
): Promise<DiscoveryRunSummary> {
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const stats = emptyDiscoveryStats(
    plan.sources
      .filter((source) => source.status === "planned")
      .reduce((count, source) => count + source.queries.length, 0),
  );
  const runId = await dependencies.store.createRun(plan, startedAt);
  const issues: SourceDiscoveryIssue[] = [];
  const sourceResults: SourceRunSummary[] = [];
  const outcomes: MultiSourceCandidateOutcome[] = [];
  const identities: ResolvableIdentity[] = [];
  const resolver = new EntityResolutionService();

  for (const sourcePlan of plan.sources) {
    const source = sourcePlan.source;
    const capability = capabilityFor(dependencies.capabilities, source);
    const adapter = dependencies.adapters[source];
    if (!capability?.enabled || sourcePlan.status !== "planned") {
      sourceResults.push(sourceSummary(source, sourcePlan, capability, "disabled_unconfigured"));
      continue;
    }
    if (!adapter) {
      const missingIssue = orchestrationIssue("Enabled source has no registered adapter.", source);
      issues.push(missingIssue);
      sourceResults.push({
        ...sourceSummary(source, sourcePlan, capability, "failed"),
        failed: 1,
        issues: [missingIssue],
      });
      continue;
    }

    let discovery: DiscoveryResult;
    try {
      discovery = await adapter.discover(sourcePlan);
    } catch (error) {
      const failedIssue = orchestrationIssue(
        `${source} discovery failed: ${errorMessage(error)}`,
        source,
      );
      issues.push(failedIssue);
      sourceResults.push({
        ...sourceSummary(source, sourcePlan, capability, "failed"),
        failed: 1,
        issues: [failedIssue],
      });
      continue;
    }

    const resultSummary = sourceSummary(
      source,
      sourcePlan,
      capability,
      discovery.status,
      discovery,
    );
    sourceResults.push(resultSummary);
    issues.push(...discovery.issues);
    stats.queriesExecuted += discovery.queriesExecuted;
    stats.recordsEvaluated += discovery.recordsEvaluated;
    if (source === "github") stats.repositoriesEvaluated += discovery.recordsEvaluated;
    stats.candidateFoundersDiscovered += discovery.candidates.length;
    stats.skipped += discovery.skipped;

    for (const candidate of discovery.candidates.slice(0, DISCOVERY_LIMITS.maxCandidates)) {
      const canCreateProfile =
        candidate.source === "github" ||
        Boolean(candidate.graph?.entities.some((entity) => entity.entityType === "founder"));
      if (
        canCreateProfile &&
        outcomes.filter((outcome) => outcome.profileId).length >= plan.candidateLimit
      ) {
        stats.skipped += 1;
        resultSummary.skipped += 1;
        continue;
      }
      let candidateId: string;
      try {
        candidateId = (await dependencies.store.upsertCandidate(runId, candidate)).id;
      } catch (error) {
        resultSummary.failed += 1;
        stats.failed += 1;
        const recordIssue = orchestrationIssue(
          `Could not record ${source} candidate ${candidate.sourceIdentifier}: ${errorMessage(error)}`,
          source,
        );
        issues.push(recordIssue);
        resultSummary.issues.push(recordIssue);
        continue;
      }

      const resolution = resolver.resolve(
        {
          canonicalName: "login" in candidate ? candidate.login : candidate.displayName,
          identifiers:
            candidate.identifiers ??
            ("login" in candidate
              ? [
                  { scheme: "github_user_id", value: candidate.sourceIdentifier },
                  { scheme: "github_login", value: candidate.login.toLowerCase() },
                ]
              : []),
        },
        identities,
      );
      if (resolution.decision === "ambiguous") {
        const message = `Candidate identity is ambiguous across stable identifiers: ${resolution.reason}`;
        resultSummary.skipped += 1;
        stats.skipped += 1;
        await dependencies.store.updateCandidate(candidateId, {
          status: "skipped",
          errorSummary: message,
        });
        continue;
      }

      try {
        const outcome = await dependencies.ingestCandidate(candidate);
        outcomes.push(outcome);
        resultSummary.candidatesIngested += outcome.profileId ? 1 : 0;
        resultSummary.candidatesEnriched += outcome.enriched ? 1 : 0;
        stats.profilesIngested += outcome.profileId ? 1 : 0;
        stats.candidatesEnriched += outcome.enriched ? 1 : 0;
        stats.entitiesCreated += outcome.summary.entitiesCreated;
        stats.evidenceCreated += outcome.summary.evidenceCreated;
        stats.relationshipsCreated += outcome.summary.relationshipsCreated;
        stats.claimsCreated += outcome.summary.claimsCreated;
        issues.push(...outcome.issues);
        await dependencies.store.updateCandidate(candidateId, {
          status: "ingested",
          founderGraphEntityId: outcome.graphEntityId,
          founderProfileId: outcome.profileId,
          errorSummary: outcome.issues.map((item) => item.message).join(" · ") || null,
        });
        if (outcome.graphEntityId) {
          identities.push({
            entityId: outcome.graphEntityId,
            canonicalName: outcome.name,
            identifiers:
              candidate.identifiers ??
              ("login" in candidate
                ? [
                    { scheme: "github_user_id", value: candidate.sourceIdentifier },
                    { scheme: "github_login", value: candidate.login.toLowerCase() },
                  ]
                : []),
          });
        }
      } catch (error) {
        resultSummary.failed += 1;
        resultSummary.status = resultSummary.candidatesIngested > 0 ? "partial" : "failed";
        stats.failed += 1;
        const message = `${source} candidate ${candidate.sourceIdentifier} failed: ${errorMessage(error)}`;
        const candidateIssue = orchestrationIssue(message, source);
        issues.push(candidateIssue);
        resultSummary.issues.push(candidateIssue);
        await dependencies.store.updateCandidate(candidateId, {
          status: "failed",
          errorSummary: message,
        });
      }
    }
  }

  let results: DiscoveryResultProfile[] = [];
  const profileOutcomes = outcomes.filter(
    (
      outcome,
    ): outcome is MultiSourceCandidateOutcome & { profileId: string; graphEntityId: string } =>
      Boolean(outcome.profileId && outcome.graphEntityId),
  );
  if (profileOutcomes.length > 0) {
    try {
      results = await dependencies.rankProfiles(profileOutcomes, thesis);
    } catch (error) {
      issues.push(orchestrationIssue(`Profile projection failed: ${errorMessage(error)}`));
    }
  }

  const enrichmentRuns = outcomes.flatMap((outcome) => outcome.enrichmentResults ?? []);
  for (const capability of dependencies.capabilities.filter((item) => item.role === "enrichment")) {
    const runs = enrichmentRuns.filter((run) => run.source === capability.id);
    const runIssues = runs.flatMap((run) => run.issues);
    let enrichmentStatus: SourceStatus;
    let disabledReason = capability.disabledReason;
    if (!capability.enabled) {
      enrichmentStatus = "disabled_unconfigured";
    } else if (runs.length === 0) {
      enrichmentStatus = "disabled";
      disabledReason = disabledReason ?? "No discovered candidate exposed a supported URL.";
    } else if (runs.every((run) => run.status === "failed")) {
      enrichmentStatus = "failed";
    } else if (runs.some((run) => ["failed", "partial"].includes(run.status))) {
      enrichmentStatus = "partial";
    } else {
      enrichmentStatus = "completed";
    }
    sourceResults.push({
      source: capability.id,
      status: enrichmentStatus,
      configured: capability.configured,
      live: capability.supportsLiveAccess && capability.enabled,
      queries: [],
      recordsEvaluated: runs.reduce((count, run) => count + run.pagesFetched, 0),
      candidatesDiscovered: 0,
      candidatesIngested: 0,
      candidatesEnriched: runs.filter((run) => ["completed", "partial"].includes(run.status))
        .length,
      skipped: 0,
      failed: runs.filter((run) => run.status === "failed").length,
      disabledReason,
      issues: runIssues,
    });
  }

  const enabledResults = sourceResults.filter(
    (source) => source.status !== "disabled_unconfigured",
  );
  const successfulSources = enabledResults.filter((source) =>
    ["completed", "partial"].includes(source.status),
  ).length;
  const failedSources = enabledResults.filter((source) => source.status === "failed").length;
  const status: DiscoveryRunStatus =
    enabledResults.length === 0
      ? "disabled_unconfigured"
      : failedSources > 0 ||
          stats.failed > 0 ||
          enabledResults.some((source) => source.status === "partial")
        ? successfulSources > 0
          ? "partial"
          : "failed"
        : "completed";
  const completedAt = now().toISOString();
  await dependencies.store.completeRun(runId, {
    status,
    stats,
    sourceResults,
    issues,
    completedAt,
  });
  return { runId, status, plan, stats, sourceResults, issues, results, startedAt, completedAt };
}

function objectProperties(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringProperty(value: unknown, key: string): string | null {
  const property = objectProperties(value)[key];
  return typeof property === "string" && property.trim() ? property.trim() : null;
}

function candidateWithGraph(
  candidate: DiscoveryCandidate,
  graph: GraphIngestionResult,
  urls: Candidate["urls"],
): DiscoveryCandidate {
  return { ...candidate, graph, urls } as DiscoveryCandidate;
}

async function productionCandidateIngestion(
  candidate: DiscoveryCandidate,
  registry: SourceRegistry,
): Promise<MultiSourceCandidateOutcome> {
  const [{ GitHubGraphAdapter }, persistence] = await Promise.all([
    import("@/lib/graph/github-graph.server"),
    import("@/lib/graph/persistence.server"),
  ]);
  let graph: GraphIngestionResult;
  const enrichmentIssues: SourceDiscoveryIssue[] = [];
  const enrichmentResults: NonNullable<MultiSourceCandidateOutcome["enrichmentResults"]> = [];
  let urls = candidate.urls ?? {};
  if (candidate.source === "github") {
    graph = await new GitHubGraphAdapter({ token: registry.configuration.githubToken }).ingest({
      github: candidate.sourceUrl,
      founderName: "",
      headline: "",
      repositorySeeds: candidate.repositories,
      repositoryLimit: DISCOVERY_LIMITS.graphRepositoriesPerCandidate,
    });
  } else {
    graph = candidate.graph;
    if (urls.github) {
      try {
        graph = mergeGraphs(
          graph,
          await new GitHubGraphAdapter({ token: registry.configuration.githubToken }).ingest({
            github: urls.github,
            founderName: candidate.displayName,
            repositoryLimit: DISCOVERY_LIMITS.graphRepositoriesPerCandidate,
          }),
        );
      } catch (error) {
        enrichmentIssues.push(
          orchestrationIssue(
            `Linked GitHub enrichment failed: ${errorMessage(error)}`,
            candidate.source,
          ),
        );
      }
    }
  }

  const founder = graph.entities.find((entity) => entity.entityType === "founder");
  if (founder) {
    urls = {
      ...urls,
      personalWebsite:
        urls.personalWebsite ??
        stringProperty(founder.properties, "site") ??
        stringProperty(founder.properties, "blog"),
      linkedin: urls.linkedin ?? stringProperty(founder.properties, "linkedin"),
    };
  }
  let workingCandidate = candidateWithGraph(candidate, graph, urls);
  let enriched = false;
  const websiteAdapter = new WebsiteEnrichmentAdapter();
  if (websiteAdapter.supports(workingCandidate)) {
    const result = await websiteAdapter.enrich(workingCandidate);
    graph = mergeGraphs(graph, result.graph);
    enriched = result.pagesFetched > 0;
    enrichmentIssues.push(...result.issues);
    for (const source of [
      ...(urls.personalWebsite ? (["personal_website"] as const) : []),
      ...(urls.companyWebsite ? (["company_website"] as const) : []),
    ]) {
      enrichmentResults.push({
        source,
        status: result.status,
        pagesFetched: result.pagesFetched,
        issues: result.issues,
      });
    }
    const linkedIn = result.identifiers.find(
      (identifier) => identifier.scheme === "linkedin_url",
    )?.value;
    const reddit = result.identifiers.find(
      (identifier) => identifier.scheme === "reddit_url",
    )?.value;
    const githubLogin = result.identifiers.find(
      (identifier) => identifier.scheme === "github_login",
    )?.value;
    urls = {
      ...urls,
      linkedin: urls.linkedin ?? linkedIn,
      reddit: urls.reddit ?? reddit,
      github: urls.github ?? (githubLogin ? `https://github.com/${githubLogin}` : null),
    };
    workingCandidate = candidateWithGraph(candidate, graph, urls);
  }
  const linkedInAdapter = new LinkedInIdentifierAdapter();
  if (linkedInAdapter.supports(workingCandidate)) {
    const result = await linkedInAdapter.enrich(workingCandidate);
    enrichmentResults.push({
      source: "linkedin_identifier",
      status: result.status,
      pagesFetched: 0,
      issues: result.issues,
    });
    enrichmentIssues.push(...result.issues);
  }
  const redditAdapter = new RedditEnrichmentAdapter({
    configuration: registry.configuration.reddit,
  });
  if (redditAdapter.supports(workingCandidate)) {
    const result = await redditAdapter.enrich(workingCandidate);
    graph = mergeGraphs(graph, result.graph);
    enrichmentIssues.push(...result.issues);
    enrichmentResults.push({
      source: "reddit",
      status: result.status,
      pagesFetched: result.pagesFetched,
      issues: result.issues,
    });
    enriched = enriched || result.pagesFetched > 0;
  }
  graph = coalesceCandidateFounder(graph);
  const canonicalFounder = graph.entities.find((entity) => entity.entityType === "founder");
  if (!canonicalFounder) {
    const fragment = await persistence.persistGraphFragment(graph);
    return {
      profileId: null,
      graphEntityId: null,
      name: candidate.displayName || ("login" in candidate ? candidate.login : "Public candidate"),
      summary: fragment.summary,
      enriched,
      issues: enrichmentIssues,
      enrichmentResults,
    };
  }
  const properties = objectProperties(canonicalFounder.properties);
  const company = graph.entities.find((entity) => entity.entityType === "company");
  const project = graph.entities.find((entity) => entity.entityType === "project");
  const bio = stringProperty(properties, "bio");
  const headline = company
    ? `Founder of ${company.canonicalName} · Public-source profile`
    : project
      ? `${project.canonicalName} contributor · Public-source profile`
      : bio || "Public GitHub build evidence";
  const persisted = await persistence.persistPublicFounderGraph(graph, {
    name: canonicalFounder.canonicalName,
    headline,
    github: urls.github ?? stringProperty(properties, "githubUrl"),
    linkedin: urls.linkedin ?? stringProperty(properties, "linkedInUrl"),
    site: urls.personalWebsite ?? urls.companyWebsite ?? stringProperty(properties, "site"),
    summary: bio ?? headline,
  });
  return {
    profileId: persisted.profileId,
    graphEntityId: persisted.founderEntityId,
    name: canonicalFounder.canonicalName,
    summary: persisted.summary,
    enriched,
    issues: enrichmentIssues,
    enrichmentResults,
  };
}

export async function runThesisDrivenDiscovery(thesis: Thesis): Promise<DiscoveryRunSummary> {
  const registry = new SourceRegistry();
  const capabilities = registry.capabilities();
  const plan = new DiscoveryPlanner(() => new Date(), capabilities).plan(thesis);
  if (plan.sources.every((source) => source.queries.length === 0)) {
    throw new Error(
      "Add at least one sector, keyword, or technical theme before finding founders.",
    );
  }

  const store = await createSupabaseDiscoveryStore();
  registry.registerDiscoveryAdapter(
    "github",
    new GitHubDiscoveryAdapter({ token: registry.configuration.githubToken }),
  );
  registry.registerDiscoveryAdapter(
    "hackathon",
    new HackathonDirectoryAdapter({
      configurations: registry.configuration.hackathonDirectories,
    }),
  );
  registry.registerDiscoveryAdapter(
    "accelerator",
    new AcceleratorDirectoryAdapter({
      configurations: registry.configuration.acceleratorDirectories,
    }),
  );
  registry.registerDiscoveryAdapter(
    "german_register",
    new GermanRegisterDiscoveryAdapter({
      configuration: registry.configuration.germanRegister,
    }),
  );

  return executeMultiSourceDiscoveryPlan(plan, thesis, {
    store,
    adapters: registry.registeredDiscoveryAdapters(),
    capabilities,
    ingestCandidate: (candidate) => productionCandidateIngestion(candidate, registry),
    rankProfiles: async (outcomes, savedThesis) => {
      const [{ loadDiscoverableGraphFounderCards }, { rankGraphFounders }] = await Promise.all([
        import("@/lib/graph/feed.server"),
        import("@/lib/graph/thesis-fit"),
      ]);
      const profileIds = new Set(outcomes.map((outcome) => outcome.profileId));
      return rankGraphFounders(
        (await loadDiscoverableGraphFounderCards()).filter((card) => profileIds.has(card.id)),
        savedThesis,
      ).map((ranked) => ({
        profileId: ranked.founder.id,
        graphEntityId: ranked.founder.graphEntityId,
        name: ranked.founder.name,
        thesisFit: ranked.thesisFit.score,
        discoveryPriority: ranked.discoveryPriority,
      }));
    },
  });
}
