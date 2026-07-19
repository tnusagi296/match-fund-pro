import type { Json } from "@/integrations/supabase/types";
import type { GitHubRepositorySeed } from "@/lib/graph/github-graph.server";
import type { GraphIdentifierInput, GraphIngestionResult } from "@/lib/graph/types";
import type { Thesis as InvestorThesis } from "@/lib/thesis";

export const DISCOVERY_LIMITS = {
  maxQueries: 5,
  maxRepositories: 50,
  maxCandidates: 20,
  defaultCandidateLimit: 10,
  defaultRepositoriesPerQuery: 10,
  graphRepositoriesPerCandidate: 20,
  maxHackathonIndexes: 3,
  maxHackathonProjects: 30,
  maxProjectTeamMembers: 5,
  maxAcceleratorDirectories: 3,
  maxAcceleratorCompanies: 30,
  maxWebsitePages: 5,
  maxWebsiteDepth: 2,
  maxWebsiteResponseBytes: 1_000_000,
  maxRedirects: 3,
  fetchTimeoutMs: 8_000,
  maxRedditItems: 5,
} as const;

export type DiscoverySource = "github" | "hackathon" | "accelerator" | "german_register";
export type EnrichmentSource =
  "personal_website" | "company_website" | "linkedin_identifier" | "reddit";
export type SourceId = DiscoverySource | EnrichmentSource;
export type SourceRole = "discovery" | "enrichment";
export type SourceStatus =
  | "planned"
  | "running"
  | "completed"
  | "partial"
  | "disabled"
  | "unconfigured"
  | "disabled_unconfigured"
  | "failed";

export type SourceCapability = {
  id: SourceId;
  role: SourceRole;
  configured: boolean;
  enabled: boolean;
  supportsLiveAccess: boolean;
  disabledReason?: string;
};

export type DiscoveryQuery = {
  query: string;
  reason: string;
  limit: number;
};

export type SourceDiscoveryPlan = {
  source: DiscoverySource;
  role: "discovery";
  status: "planned" | "disabled_unconfigured" | "disabled";
  queries: DiscoveryQuery[];
  themes: string[];
  evidenceRequirements: string[];
  unsupportedFilters: Array<{ field: string; reason: string }>;
  disabledReason?: string;
};

export type DiscoveryPlan = {
  thesisId: string;
  capabilities: SourceCapability[];
  sources: SourceDiscoveryPlan[];
  rankingPreferences: string[];
  evidenceRequirements: string[];
  unsupportedFilters: Array<{
    field: string;
    reason: string;
  }>;
  candidateLimit: number;
};

export type DiscoveryReason = {
  source?: DiscoverySource;
  query: string;
  planReason: string;
  sourceName?: string;
  repositoryId?: number;
  repositoryName?: string;
  repositoryUrl?: string;
  resultName?: string;
  resultUrl?: string;
};

export type CandidateUrlSet = {
  github?: string | null;
  personalWebsite?: string | null;
  companyWebsite?: string | null;
  linkedin?: string | null;
  reddit?: string | null;
};

export type GitHubDiscoveryCandidate = {
  source: "github";
  sourceIdentifier: string;
  login: string;
  displayName?: string;
  sourceUrl: string;
  repositories: GitHubRepositorySeed[];
  graph?: GraphIngestionResult;
  identifiers?: GraphIdentifierInput[];
  urls?: CandidateUrlSet;
  discoveryReasons: DiscoveryReason[];
};

export type PublicDiscoveryCandidate = {
  source: Exclude<DiscoverySource, "github">;
  sourceIdentifier: string;
  displayName: string;
  sourceUrl: string;
  explicitFounderRole: boolean;
  identifiers: GraphIdentifierInput[];
  urls: CandidateUrlSet;
  discoveryReasons: DiscoveryReason[];
  graph: GraphIngestionResult;
  context: Json;
};

export type DiscoveryCandidate = GitHubDiscoveryCandidate | PublicDiscoveryCandidate;
export type Candidate = DiscoveryCandidate;

export type SourceDiscoveryIssue = {
  source?: SourceId;
  query: string;
  status: number | null;
  message: string;
  rateLimited: boolean;
  rateLimitResetAt: string | null;
};
export type GitHubDiscoveryIssue = SourceDiscoveryIssue;

export type GitHubDiscoveryResult = DiscoveryResult & {
  candidates: GitHubDiscoveryCandidate[];
  repositoriesEvaluated: number;
  ownersSkipped: number;
};

export type DiscoveryResult = {
  source: DiscoverySource;
  status: Exclude<SourceStatus, "planned" | "running">;
  candidates: DiscoveryCandidate[];
  queriesExecuted: number;
  recordsEvaluated: number;
  skipped: number;
  issues: SourceDiscoveryIssue[];
};

export type EnrichmentResult = {
  source: EnrichmentSource;
  status: Exclude<SourceStatus, "planned" | "running">;
  candidate: Candidate;
  graph: GraphIngestionResult;
  identifiers: GraphIdentifierInput[];
  pagesFetched: number;
  issues: SourceDiscoveryIssue[];
};

export interface DiscoveryAdapter {
  plan(thesis: InvestorThesis): Promise<SourceDiscoveryPlan>;
  discover(plan: SourceDiscoveryPlan): Promise<DiscoveryResult>;
}

export interface EnrichmentAdapter {
  supports(candidate: Candidate): boolean;
  enrich(candidate: Candidate): Promise<EnrichmentResult>;
}

export type DiscoveryRunStatus =
  "planned" | "running" | "completed" | "partial" | "failed" | "disabled_unconfigured";
export type DiscoveryCandidateStatus = "discovered" | "ingested" | "skipped" | "failed";

export type DiscoveryRunStats = {
  queriesPlanned: number;
  queriesExecuted: number;
  repositoriesEvaluated: number;
  recordsEvaluated: number;
  candidateFoundersDiscovered: number;
  candidatesEnriched: number;
  profilesIngested: number;
  skipped: number;
  failed: number;
  entitiesCreated: number;
  evidenceCreated: number;
  relationshipsCreated: number;
  claimsCreated: number;
};

export type DiscoveryResultProfile = {
  profileId: string;
  graphEntityId: string;
  name: string;
  thesisFit: number;
  discoveryPriority: number;
};

export type SourceRunSummary = {
  source: SourceId;
  status: SourceStatus;
  configured: boolean;
  live: boolean;
  queries: DiscoveryQuery[];
  recordsEvaluated: number;
  candidatesDiscovered: number;
  candidatesIngested: number;
  candidatesEnriched: number;
  skipped: number;
  failed: number;
  disabledReason?: string;
  issues: SourceDiscoveryIssue[];
};

export type DiscoveryRunSummary = {
  runId: string;
  status: DiscoveryRunStatus;
  plan: DiscoveryPlan;
  stats: DiscoveryRunStats;
  sourceResults: SourceRunSummary[];
  issues: SourceDiscoveryIssue[];
  results: DiscoveryResultProfile[];
  startedAt: string;
  completedAt: string;
};

export type PersistedDiscoveryCandidate = {
  id: string;
  status: DiscoveryCandidateStatus;
};

export type DiscoveryCandidateUpdate = {
  status: DiscoveryCandidateStatus;
  founderGraphEntityId?: string | null;
  founderProfileId?: string | null;
  errorSummary?: string | null;
};

export type DiscoveryRunUpdate = {
  status: DiscoveryRunStatus;
  stats: DiscoveryRunStats;
  sourceResults?: SourceRunSummary[];
  issues: SourceDiscoveryIssue[];
  completedAt: string;
};

export function discoveryReasonsJson(reasons: DiscoveryReason[]): Json {
  return reasons.map((reason) => ({ ...reason }));
}
