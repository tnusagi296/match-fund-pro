import type { GitHubRepositorySeed } from "@/lib/graph/github-graph.server";
import { runtimeFetch } from "@/lib/runtime-fetch";
import type { Thesis } from "@/lib/thesis";
import { DiscoveryPlanner } from "./planner.server";
import {
  DISCOVERY_LIMITS,
  type DiscoveryAdapter,
  type DiscoveryPlan,
  type DiscoveryReason,
  type GitHubDiscoveryCandidate,
  type GitHubDiscoveryIssue,
  type GitHubDiscoveryResult,
  type SourceDiscoveryPlan,
} from "./types";

const GITHUB_API = "https://api.github.com";
const BOT_LOGIN = /(?:\[bot\]$|^bot[-_]|[-_]bot$|dependabot|renovate|github-actions)/i;

type GitHubSearchOwner = {
  id: number;
  login: string;
  html_url: string;
  type: string;
};

type GitHubSearchRepository = GitHubRepositorySeed & {
  owner: GitHubRepositorySeed["owner"] & GitHubSearchOwner;
};

type GitHubSearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchRepository[];
};

type GitHubDiscoveryAdapterOptions = {
  fetchImpl?: typeof fetch;
  token?: string;
};

export function isDiscoverableGitHubOwner(owner: GitHubSearchOwner): boolean {
  return (
    owner.type.toLowerCase() === "user" &&
    Number.isSafeInteger(owner.id) &&
    owner.id > 0 &&
    Boolean(owner.login.trim()) &&
    !BOT_LOGIN.test(owner.login)
  );
}

function issueFromResponse(
  query: string,
  response: Response,
  message: string,
): GitHubDiscoveryIssue {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  const rateLimited =
    response.status === 429 ||
    (response.status === 403 && (remaining === "0" || /rate limit/i.test(message)));
  const resetSeconds = reset ? Number(reset) : Number.NaN;
  return {
    source: "github",
    query,
    status: response.status,
    message: rateLimited
      ? "GitHub search rate limit reached. Add GITHUB_TOKEN or retry after the reset time."
      : `GitHub repository search failed with status ${response.status}.`,
    rateLimited,
    rateLimitResetAt: Number.isFinite(resetSeconds)
      ? new Date(resetSeconds * 1000).toISOString()
      : null,
  };
}

function selectedRepository(repository: GitHubSearchRepository): GitHubRepositorySeed {
  return {
    id: repository.id,
    name: repository.name,
    full_name: repository.full_name,
    owner: { id: repository.owner.id, login: repository.owner.login },
    private: repository.private,
    fork: repository.fork,
    archived: repository.archived,
    disabled: repository.disabled,
    html_url: repository.html_url,
    description: repository.description,
    language: repository.language,
    topics: repository.topics ?? [],
    created_at: repository.created_at,
    updated_at: repository.updated_at,
    pushed_at: repository.pushed_at,
    stargazers_count: repository.stargazers_count,
    forks_count: repository.forks_count,
    open_issues_count: repository.open_issues_count,
  };
}

export class GitHubDiscoveryAdapter implements DiscoveryAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly token?: string;

  constructor(options: GitHubDiscoveryAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? runtimeFetch;
    this.token = options.token;
  }

  async plan(thesis: Thesis): Promise<SourceDiscoveryPlan> {
    const plan = new DiscoveryPlanner()
      .plan(thesis)
      .sources.find((item) => item.source === "github");
    if (!plan) throw new Error("GitHub discovery plan was not generated.");
    return plan;
  }

  async discover(plan: DiscoveryPlan | SourceDiscoveryPlan): Promise<GitHubDiscoveryResult> {
    const github =
      "sources" in plan
        ? plan.sources.find((source) => source.source === "github")
        : plan.source === "github"
          ? plan
          : null;
    const queries = (github?.queries ?? []).slice(0, DISCOVERY_LIMITS.maxQueries);
    const candidateLimit = Math.min(
      "candidateLimit" in plan ? plan.candidateLimit : DISCOVERY_LIMITS.defaultCandidateLimit,
      DISCOVERY_LIMITS.maxCandidates,
    );
    const candidates = new Map<string, GitHubDiscoveryCandidate>();
    const repositoryIds = new Set<number>();
    const skippedOwners = new Set<string>();
    const issues: GitHubDiscoveryIssue[] = [];
    let queriesExecuted = 0;

    for (const plannedQuery of queries) {
      const remainingRepositories = DISCOVERY_LIMITS.maxRepositories - repositoryIds.size;
      if (remainingRepositories <= 0) break;
      const limit = Math.max(1, Math.min(plannedQuery.limit, remainingRepositories, 100));
      const url = new URL(`${GITHUB_API}/search/repositories`);
      url.searchParams.set("q", plannedQuery.query);
      url.searchParams.set("sort", "updated");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", String(limit));

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "MatchFund-public-founder-discovery",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;

      let response: Response;
      try {
        response = await this.fetchImpl(url, { headers });
      } catch (error) {
        issues.push({
          source: "github",
          query: plannedQuery.query,
          status: null,
          message: error instanceof Error ? error.message : "GitHub search request failed.",
          rateLimited: false,
          rateLimitResetAt: null,
        });
        continue;
      }
      queriesExecuted += 1;
      if (!response.ok) {
        let message = "";
        try {
          const body = (await response.json()) as { message?: string };
          message = body.message ?? "";
        } catch {
          // The status and rate-limit headers are sufficient for a useful error.
        }
        const issue = issueFromResponse(plannedQuery.query, response, message);
        issues.push(issue);
        if (issue.rateLimited) break;
        continue;
      }

      const payload = (await response.json()) as GitHubSearchResponse;
      for (const repository of payload.items ?? []) {
        if (repositoryIds.size >= DISCOVERY_LIMITS.maxRepositories) break;
        if (!Number.isSafeInteger(repository.id) || repository.id <= 0) continue;
        repositoryIds.add(repository.id);
        if (repository.private || repository.fork || repository.archived || repository.disabled) {
          continue;
        }

        const owner = repository.owner;
        if (!isDiscoverableGitHubOwner(owner)) {
          skippedOwners.add(`${owner.type}:${owner.id}:${owner.login}`);
          continue;
        }

        const ownerId = String(owner.id);
        let candidate = candidates.get(ownerId);
        if (!candidate) {
          if (candidates.size >= candidateLimit) {
            skippedOwners.add(`limit:${ownerId}`);
            continue;
          }
          candidate = {
            source: "github",
            sourceIdentifier: ownerId,
            login: owner.login,
            sourceUrl: owner.html_url || `https://github.com/${owner.login}`,
            repositories: [],
            identifiers: [
              { scheme: "github_user_id", value: ownerId },
              { scheme: "github_login", value: owner.login.toLowerCase() },
            ],
            urls: { github: owner.html_url || `https://github.com/${owner.login}` },
            discoveryReasons: [],
          };
          candidates.set(ownerId, candidate);
        }

        if (!candidate.repositories.some((item) => item.id === repository.id)) {
          candidate.repositories.push(selectedRepository(repository));
        }
        const reason: DiscoveryReason = {
          source: "github",
          query: plannedQuery.query,
          planReason: plannedQuery.reason,
          repositoryId: repository.id,
          repositoryName: repository.full_name,
          repositoryUrl: repository.html_url,
        };
        if (
          !candidate.discoveryReasons.some(
            (item) => item.query === reason.query && item.repositoryId === reason.repositoryId,
          )
        ) {
          candidate.discoveryReasons.push(reason);
        }
      }
    }

    return {
      source: "github",
      status: issues.length > 0 ? (candidates.size > 0 ? "partial" : "failed") : "completed",
      candidates: [...candidates.values()],
      repositoriesEvaluated: repositoryIds.size,
      recordsEvaluated: repositoryIds.size,
      queriesExecuted,
      ownersSkipped: skippedOwners.size,
      skipped: skippedOwners.size,
      issues,
    };
  }
}
