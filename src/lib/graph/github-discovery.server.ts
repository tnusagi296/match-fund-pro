import { GitHubGraphAdapter, GitHubGraphAdapterError } from "./github-graph.server";
import { createOrUpdateFounderProfile, persistGraphIngestion } from "./persistence.server";

const GITHUB_API = "https://api.github.com";

type SearchRepoOwner = {
  id: number;
  login: string;
  type: string; // "User" | "Organization"
};

type SearchRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string | null;
  owner: SearchRepoOwner;
};

type SearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: SearchRepo[];
};

export type DiscoveredCandidate = {
  login: string;
  githubUserId: number;
  profileId: string;
  publicRepos?: number;
  topRepo: {
    fullName: string;
    stars: number;
    url: string;
    description: string | null;
    topics: string[];
  };
  createdProfile: boolean;
  status: "ingested" | "failed";
  error?: string;
};

export type DiscoveryRunResult = {
  query: string;
  scanned: number;
  ingested: number;
  failed: number;
  candidates: DiscoveredCandidate[];
  rateLimit: {
    remaining: number | null;
    limit: number | null;
    resetAt: string | null;
  };
  authenticated: boolean;
};

function githubHeaders(): { headers: Record<string, string>; authed: boolean } {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MatchFund-discovery",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_API_KEY ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    return { headers, authed: true };
  }
  return { headers, authed: false };
}

export async function searchRepositories(
  query: string,
  limit: number,
): Promise<{ repos: SearchRepo[]; rateLimit: DiscoveryRunResult["rateLimit"]; authed: boolean }> {
  const { headers, authed } = githubHeaders();
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${Math.min(limit * 3, 50)}`;
  const response = await fetch(url, { headers });
  const rateLimit = {
    remaining: Number(response.headers.get("x-ratelimit-remaining") ?? "") || null,
    limit: Number(response.headers.get("x-ratelimit-limit") ?? "") || null,
    resetAt: response.headers.get("x-ratelimit-reset")
      ? new Date(Number(response.headers.get("x-ratelimit-reset")) * 1000).toISOString()
      : null,
  };
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub repo search failed [${response.status}]: ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as SearchResponse;
  return { repos: data.items, rateLimit, authed };
}

export async function runGitHubDiscovery(options: {
  query: string;
  limit?: number;
}): Promise<DiscoveryRunResult> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
  const { repos, rateLimit, authed } = await searchRepositories(options.query, limit);

  // Pick top N unique user owners (skip organizations).
  const seenLogins = new Set<string>();
  const picked: SearchRepo[] = [];
  for (const repo of repos) {
    if (repo.owner.type !== "User") continue;
    if (seenLogins.has(repo.owner.login.toLowerCase())) continue;
    seenLogins.add(repo.owner.login.toLowerCase());
    picked.push(repo);
    if (picked.length >= limit) break;
  }

  const adapter = new GitHubGraphAdapter({
    token: process.env.GITHUB_API_KEY ?? process.env.GITHUB_TOKEN,
  });
  const candidates: DiscoveredCandidate[] = [];
  let ingested = 0;
  let failed = 0;

  for (const repo of picked) {
    const login = repo.owner.login;
    try {
      const ingestion = await adapter.ingest({
        github: login,
        founderName: login,
        headline: "Potential builder — founder status unverified",
      });
      const profile = await createOrUpdateFounderProfile(ingestion, {
        name: login,
        headline: "Potential builder — founder status unverified",
        github: `https://github.com/${login}`,
        linkedin: "",
        site: "",
        profileOrigin: "public_scan",
        claimStatus: "unclaimed",
        visibilityState: "discoverable",
      });
      await persistGraphIngestion(ingestion, profile.id);

      candidates.push({
        login,
        githubUserId: repo.owner.id,
        profileId: profile.id,
        topRepo: {
          fullName: repo.full_name,
          stars: repo.stargazers_count,
          url: repo.html_url,
          description: repo.description,
          topics: repo.topics ?? [],
        },
        createdProfile: !profile.published,
        status: "ingested",
      });
      ingested += 1;
    } catch (error) {
      const message =
        error instanceof GitHubGraphAdapterError || error instanceof Error
          ? error.message
          : String(error);
      candidates.push({
        login,
        githubUserId: repo.owner.id,
        profileId: "",
        topRepo: {
          fullName: repo.full_name,
          stars: repo.stargazers_count,
          url: repo.html_url,
          description: repo.description,
          topics: repo.topics ?? [],
        },
        createdProfile: false,
        status: "failed",
        error: message,
      });
      failed += 1;
    }
  }

  return {
    query: options.query,
    scanned: repos.length,
    ingested,
    failed,
    candidates,
    rateLimit,
    authenticated: authed,
  };
}
